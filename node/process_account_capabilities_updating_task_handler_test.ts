import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW,
  deleteAccountCapabilitiesUpdatingTaskStatement,
  deleteAccountStatement,
  getAccountCapabilitiesUpdatingTaskMetadata,
  insertAccountCapabilitiesUpdatingTaskStatement,
  insertAccountStatement,
  listPendingAccountCapabilitiesUpdatingTasks,
} from "../db/sql";
import { ProcessAccountCapabilitiesUpdatingTaskHandler } from "./process_account_capabilities_updating_task_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import {
  UPDATE_ACCOUNT_CAPABILITIES,
  UPDATE_ACCOUNT_CAPABILITIES_REQUEST_BODY,
} from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER, TestCase } from "@selfage/test_runner";

class UpdateCapabilitiesCase implements TestCase {
  public constructor(
    public name: string,
    private accountType: AccountType,
    private paymentProfileState: PaymentProfileState,
    private expectedCapabilities: {
      canConsume: boolean;
      canPublish: boolean;
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
          paymentProfileState: this.paymentProfileState,
        }),
        insertAccountCapabilitiesUpdatingTaskStatement({
          accountId: "account1",
          capabilitiesVersion: 1,
          retryCount: 0,
          executionTimeMs: 1000,
        }),
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
    await handler.processTask("", {
      accountId: "account1",
      capabilitiesVersion: 1,
    });

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
      await listPendingAccountCapabilitiesUpdatingTasks(SPANNER_DATABASE, {
        accountCapabilitiesUpdatingTaskExecutionTimeMsLe: 1000000,
      }),
      isArray([]),
      "tasks",
    );
  }

  public async tearDown(): Promise<void> {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteAccountStatement({
          accountAccountIdEq: "account1",
        }),
        deleteAccountCapabilitiesUpdatingTaskStatement({
          accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
          accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 1,
        }),
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
      PaymentProfileState.HEALTHY,
      {
        canConsume: true,
        canPublish: false,
        canBeBilled: true,
        canEarn: false,
      },
    ),
    new UpdateCapabilitiesCase(
      "PUBLISHER_HEALTHY",
      AccountType.PUBLISHER,
      PaymentProfileState.HEALTHY,
      {
        canConsume: false,
        canPublish: true,
        canBeBilled: true,
        canEarn: true,
      },
    ),
    new UpdateCapabilitiesCase(
      "CONSUMER_SUSPENDED",
      AccountType.CONSUMER,
      PaymentProfileState.SUSPENDED,
      {
        canConsume: false,
        canPublish: false,
        canBeBilled: true,
        canEarn: false,
      },
    ),
    new UpdateCapabilitiesCase(
      "PUBLISHER_SUSPENDED",
      AccountType.PUBLISHER,
      PaymentProfileState.SUSPENDED,
      {
        canConsume: false,
        canPublish: false,
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
              paymentProfileState: PaymentProfileState.HEALTHY,
            }),
            insertAccountCapabilitiesUpdatingTaskStatement({
              accountId: "account1",
              capabilitiesVersion: 1,
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.error = new Error("Fake error");
        let handler = new ProcessAccountCapabilitiesUpdatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 2000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
            capabilitiesVersion: 1,
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
        assertThat(
          await getAccountCapabilitiesUpdatingTaskMetadata(SPANNER_DATABASE, {
            accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
            accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 1,
          }),
          isArray([
            eqMessage(
              {
                accountCapabilitiesUpdatingTaskRetryCount: 0,
                accountCapabilitiesUpdatingTaskExecutionTimeMs: 1000,
              },
              GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
            deleteAccountCapabilitiesUpdatingTaskStatement({
              accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
              accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 1,
            }),
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
              paymentProfileState: PaymentProfileState.HEALTHY,
            }),
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
        let error = await assertReject(
          handler.processTask("", {
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
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountCapabilitiesUpdatingTaskStatement({
              accountId: "account1",
              capabilitiesVersion: 1,
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessAccountCapabilitiesUpdatingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 2000,
        );

        // Execute
        await handler.claimTask("", {
          accountId: "account1",
          capabilitiesVersion: 1,
        });

        // Verify
        assertThat(
          await getAccountCapabilitiesUpdatingTaskMetadata(SPANNER_DATABASE, {
            accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
            accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 1,
          }),
          isArray([
            eqMessage(
              {
                accountCapabilitiesUpdatingTaskRetryCount: 1,
                accountCapabilitiesUpdatingTaskExecutionTimeMs: 302000,
              },
              GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountCapabilitiesUpdatingTaskStatement({
              accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
              accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 1,
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
