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
import { SyncBillingProfileStateHandler } from "./sync_billing_profile_state_handler";
import { BillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteAccountStatement({
        accountAccountIdEq: "account1",
      }),
      deleteAccountCapabilitiesUpdatingTaskStatement({
        accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
        accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 10,
      }),
      deleteAccountCapabilitiesUpdatingTaskStatement({
        accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
        accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 11,
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "SyncBillingProfileStateHandlerTest",
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
              capabilitiesVersion: 10,
              billingProfileStateVersion: 0,
              billingProfileState: BillingProfileState.HEALTHY,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncBillingProfileStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          billingProfileState: BillingProfileState.SUSPENDED,
          billingProfileStateVersion: 1,
        });

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountCapabilitiesVersion: 11,
                accountBillingProfileStateVersion: 1,
                accountBillingProfileState: BillingProfileState.SUSPENDED,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getAccountCapabilitiesUpdatingTaskMetadata(SPANNER_DATABASE, {
            accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
            accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 11,
          }),
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
              capabilitiesVersion: 10,
              billingProfileStateVersion: 1,
              billingProfileState: BillingProfileState.SUSPENDED,
            }),
            insertAccountCapabilitiesUpdatingTaskStatement({
              accountId: "account1",
              capabilitiesVersion: 10,
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncBillingProfileStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          billingProfileState: BillingProfileState.HEALTHY,
          billingProfileStateVersion: 2,
        });

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountCapabilitiesVersion: 11,
                accountBillingProfileStateVersion: 2,
                accountBillingProfileState: BillingProfileState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getAccountCapabilitiesUpdatingTaskMetadata(SPANNER_DATABASE, {
            accountCapabilitiesUpdatingTaskAccountIdEq: "account1",
            accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: 11,
          }),
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
              capabilitiesVersion: 10,
              billingProfileStateVersion: 1,
              billingProfileState: BillingProfileState.HEALTHY,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncBillingProfileStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          billingProfileState: BillingProfileState.SUSPENDED,
          billingProfileStateVersion: 1,
        });

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountCapabilitiesVersion: 10,
                accountBillingProfileStateVersion: 1,
                accountBillingProfileState: BillingProfileState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await listPendingAccountCapabilitiesUpdatingTasks(SPANNER_DATABASE, {
            accountCapabilitiesUpdatingTaskExecutionTimeMsLe: 1000000,
          }),
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
