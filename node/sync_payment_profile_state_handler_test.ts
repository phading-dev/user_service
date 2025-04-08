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
import { SyncPaymentProfileStateHandler } from "./sync_payment_profile_state_handler";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
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
  name: "SyncPaymentProfileStateHandlerTest",
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
              paymentProfileStateVersion: 0,
              paymentProfileState: PaymentProfileState.HEALTHY,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncPaymentProfileStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          paymentProfileState: PaymentProfileState.SUSPENDED,
          paymentProfileStateVersion: 1,
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
                accountPaymentProfileStateVersion: 1,
                accountPaymentProfileState: PaymentProfileState.SUSPENDED,
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
              paymentProfileStateVersion: 1,
              paymentProfileState: PaymentProfileState.SUSPENDED,
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
        let handler = new SyncPaymentProfileStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          paymentProfileState: PaymentProfileState.HEALTHY,
          paymentProfileStateVersion: 2,
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
                accountPaymentProfileStateVersion: 2,
                accountPaymentProfileState: PaymentProfileState.HEALTHY,
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
              paymentProfileStateVersion: 1,
              paymentProfileState: PaymentProfileState.HEALTHY,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new SyncPaymentProfileStateHandler(
          SPANNER_DATABASE,
          () => 2000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          paymentProfileState: PaymentProfileState.SUSPENDED,
          paymentProfileStateVersion: 1,
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
                accountPaymentProfileStateVersion: 1,
                accountPaymentProfileState: PaymentProfileState.HEALTHY,
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
