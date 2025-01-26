import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  LIST_ACCOUNT_CAPABILITIES_UPDATING_TASKS_ROW,
  deleteAccountCapabilitiesUpdatingTaskStatement,
  deleteAccountStatement,
  insertAccountCapabilitiesUpdatingTaskStatement,
  insertAccountStatement,
  listAccountCapabilitiesUpdatingTasks,
} from "../db/sql";
import { ProcessAccountCapabilitiesUpdatingTaskHandler } from "./process_account_capabilities_updating_task_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import {
  UPDATE_ACCOUNT_CAPABILITIES,
  UPDATE_ACCOUNT_CAPABILITIES_REQUEST_BODY,
} from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER, TestCase } from "@selfage/test_runner";

class UpdateCapabilitiesCase implements TestCase {
  public constructor(
    public name: string,
    private accountType: AccountType,
    private billingAccountState: BillingAccountState,
    private expectedCapabilities: {
      canConsumeShows: boolean;
      canPublishShows: boolean;
      canBeBilled: boolean;
      canEarn: boolean;
    },
  ) {}

  public async execute(): Promise<void> {
    // Prepare
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        insertAccountStatement({
          userId: "user1",
          accountId: "account1",
          accountType: this.accountType,
          capabilitiesVersion: 1,
          billingAccountStateInfo: {
            state: this.billingAccountState,
          },
          createdTimeMs: 1000,
          lastAccessedTimeMs: 1000,
        }),
        insertAccountCapabilitiesUpdatingTaskStatement(
          "account1",
          1,
          1000,
          1000,
        ),
      ]);
      await transaction.commit();
    });
    let clientMock = new NodeServiceClientMock();
    let handler = new ProcessAccountCapabilitiesUpdatingTaskHandler(
      SPANNER_DATABASE,
      clientMock,
      () => 2000,
    );

    // Execute
    handler.handle("", {
      accountId: "account1",
      capabilitiesVersion: 1,
    });
    await new Promise<void>((resolve) => (handler.doneCallbackFn = resolve));

    // Verify
    assertThat(
      clientMock.request.descriptor,
      eq(UPDATE_ACCOUNT_CAPABILITIES),
      "RC",
    );
    assertThat(
      clientMock.request.body,
      eqMessage(
        {
          accountId: "account1",
          capabilitiesVersion: 1,
          capabilities: this.expectedCapabilities,
        },
        UPDATE_ACCOUNT_CAPABILITIES_REQUEST_BODY,
      ),
      "body",
    );
    assertThat(
      await listAccountCapabilitiesUpdatingTasks(SPANNER_DATABASE, 1000000),
      isArray([]),
      "tasks",
    );
  }

  public async tearDown(): Promise<void> {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteAccountStatement("account1"),
        deleteAccountCapabilitiesUpdatingTaskStatement("account1", 1),
      ]);
      await transaction.commit();
    });
  }
}

TEST_RUNNER.run({
  name: "ProcessAccountCapabilitiesUpdatingTaskHandlerTest",
  cases: [
    new UpdateCapabilitiesCase(
      "CONSUMER_HEALTHY",
      AccountType.CONSUMER,
      BillingAccountState.HEALTHY,
      {
        canConsumeShows: true,
        canPublishShows: false,
        canBeBilled: true,
        canEarn: false,
      },
    ),
    new UpdateCapabilitiesCase(
      "PUBLISHER_HEALTHY",
      AccountType.PUBLISHER,
      BillingAccountState.HEALTHY,
      {
        canConsumeShows: false,
        canPublishShows: true,
        canBeBilled: true,
        canEarn: true,
      },
    ),
    new UpdateCapabilitiesCase(
      "CONSUMER_SUSPENDED",
      AccountType.CONSUMER,
      BillingAccountState.SUSPENDED,
      {
        canConsumeShows: false,
        canPublishShows: false,
        canBeBilled: true,
        canEarn: false,
      },
    ),
    new UpdateCapabilitiesCase(
      "PUBLISHER_SUSPENDED",
      AccountType.PUBLISHER,
      BillingAccountState.SUSPENDED,
      {
        canConsumeShows: false,
        canPublishShows: false,
        canBeBilled: true,
        canEarn: true,
      },
    ),
    {
      name: "UpdateFailedAndRetrying",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 1,
              billingAccountStateInfo: {
                state: BillingAccountState.HEALTHY,
              },
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
            insertAccountCapabilitiesUpdatingTaskStatement(
              "account1",
              1,
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.error = new Error("Fake error");
        let handler = new ProcessAccountCapabilitiesUpdatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          accountId: "account1",
          capabilitiesVersion: 1,
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await listAccountCapabilitiesUpdatingTasks(SPANNER_DATABASE, 1000000),
          isArray([
            eqMessage(
              {
                accountCapabilitiesUpdatingTaskAccountId: "account1",
                accountCapabilitiesUpdatingTaskCapabilitiesVersion: 1,
                accountCapabilitiesUpdatingTaskExecutionTimeMs: 301000,
              },
              LIST_ACCOUNT_CAPABILITIES_UPDATING_TASKS_ROW,
            ),
          ]),
          "tasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement("account1"),
            deleteAccountCapabilitiesUpdatingTaskStatement("account1", 1),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "VersionMismatch",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 2,
              billingAccountStateInfo: {
                state: BillingAccountState.HEALTHY,
              },
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessAccountCapabilitiesUpdatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            accountId: "account1",
            capabilitiesVersion: 1,
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError("doesn't match the task with version 1"),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
      },
    },
  ],
});
