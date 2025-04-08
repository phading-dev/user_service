import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYOUT_PROFILE_CREATING_TASK_ROW,
  deletePayoutProfileCreatingTaskStatement,
  getPayoutProfileCreatingTask,
  insertPayoutProfileCreatingTaskStatement,
} from "../db/sql";
import { ProcessPayoutProfileCreatingTaskHandler } from "./process_payout_profile_creating_tasks_handler";
import {
  CREATE_PAYOUT_PROFILE,
  CREATE_PAYOUT_PROFILE_REQUEST_BODY,
} from "@phading/commerce_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessPayoutProfileCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessPayoutProfileCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 2000,
        );

        // Execute
        await handler.processTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          clientMock.request.descriptor,
          eq(CREATE_PAYOUT_PROFILE),
          "RC",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "account1",
            },
            CREATE_PAYOUT_PROFILE_REQUEST_BODY,
          ),
          "RC body",
        );
        assertThat(
          await getPayoutProfileCreatingTask(SPANNER_DATABASE, {
            payoutProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileCreatingTaskStatement({
              payoutProfileCreatingTaskAccountIdEq: "account1",
            }),
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
            insertPayoutProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessPayoutProfileCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 2000,
        );

        // Execute
        await handler.claimTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          await getPayoutProfileCreatingTask(SPANNER_DATABASE, {
            payoutProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                payoutProfileCreatingTaskAccountId: "account1",
                payoutProfileCreatingTaskRetryCount: 1,
                payoutProfileCreatingTaskExecutionTimeMs: 302000,
              },
              GET_PAYOUT_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileCreatingTaskStatement({
              payoutProfileCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
