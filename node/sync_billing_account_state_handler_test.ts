import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW,
  GET_ACCOUNT_ROW,
  deleteAccountCapabilitiesUpdatingTaskStatement,
  deleteAccountStatement,
  getAccount,
  getAccountCapabilitiesUpdatingTaskMetadata,
  insertAccountCapabilitiesUpdatingTaskStatement,
  insertAccountStatement,
  listPendingAccountCapabilitiesUpdatingTasks,
} from "../db/sql";
import { SyncBillingAccountStateHandler } from "./sync_billing_account_state_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteAccountStatement("account1"),
      deleteAccountCapabilitiesUpdatingTaskStatement("account1", 10),
      deleteAccountCapabilitiesUpdatingTaskStatement("account1", 11),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "SyncBillingAccountStateHandlerTest",
  cases: [
    {
      name: "InitialSync",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 10,
              billingAccountStateInfo: {
                version: 0,
                state: BillingAccountState.HEALTHY,
              },
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncBillingAccountStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          billingAccountState: BillingAccountState.SUSPENDED,
          billingAccountStateVersion: 1,
        });

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  capabilitiesVersion: 11,
                  billingAccountStateInfo: {
                    version: 1,
                    state: BillingAccountState.SUSPENDED,
                  },
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getAccountCapabilitiesUpdatingTaskMetadata(
            SPANNER_DATABASE,
            "account1",
            11,
          ),
          isArray([
            eqMessage(
              {
                accountCapabilitiesUpdatingTaskRetryCount: 0,
                accountCapabilitiesUpdatingTaskExecutionTimeMs: 2000,
              },
              GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW,
            ),
          ]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "SyncAgainAndDeletePrevUpdateTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 10,
              billingAccountStateInfo: {
                version: 1,
                state: BillingAccountState.SUSPENDED,
              },
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
            insertAccountCapabilitiesUpdatingTaskStatement(
              "account1",
              10,
              0,
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new SyncBillingAccountStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          billingAccountState: BillingAccountState.HEALTHY,
          billingAccountStateVersion: 2,
        });

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  capabilitiesVersion: 11,
                  billingAccountStateInfo: {
                    version: 2,
                    state: BillingAccountState.HEALTHY,
                  },
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getAccountCapabilitiesUpdatingTaskMetadata(
            SPANNER_DATABASE,
            "account1",
            11,
          ),
          isArray([
            eqMessage(
              {
                accountCapabilitiesUpdatingTaskRetryCount: 0,
                accountCapabilitiesUpdatingTaskExecutionTimeMs: 2000,
              },
              GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW,
            ),
          ]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "SyncOutOfOrder",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 10,
              billingAccountStateInfo: {
                version: 1,
                state: BillingAccountState.HEALTHY,
              },
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncBillingAccountStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          billingAccountState: BillingAccountState.SUSPENDED,
          billingAccountStateVersion: 1,
        });

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  capabilitiesVersion: 10,
                  billingAccountStateInfo: {
                    version: 1,
                    state: BillingAccountState.HEALTHY,
                  },
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await listPendingAccountCapabilitiesUpdatingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
