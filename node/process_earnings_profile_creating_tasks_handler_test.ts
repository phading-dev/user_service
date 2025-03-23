import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_EARNINGS_PROFILE_CREATING_TASK_ROW,
  deleteEarningsProfileCreatingTaskStatement,
  getEarningsProfileCreatingTask,
  insertEarningsProfileCreatingTaskStatement,
} from "../db/sql";
import { ProcessEarningsProfileCreatingTaskHandler } from "./process_earnings_profile_creating_tasks_handler";
import {
  CREATE_EARNINGS_PROFILE,
  CREATE_EARNINGS_PROFILE_REQUEST_BODY,
} from "@phading/commerce_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessEarningsProfileCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessEarningsProfileCreatingTaskHandler(
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
          eq(CREATE_EARNINGS_PROFILE),
          "RC",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "account1",
            },
            CREATE_EARNINGS_PROFILE_REQUEST_BODY,
          ),
          "RC body",
        );
        assertThat(
          await getEarningsProfileCreatingTask(SPANNER_DATABASE, {
            earningsProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsProfileCreatingTaskStatement({
              earningsProfileCreatingTaskAccountIdEq: "account1",
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
            insertEarningsProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessEarningsProfileCreatingTaskHandler(
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
          await getEarningsProfileCreatingTask(SPANNER_DATABASE, {
            earningsProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                earningsProfileCreatingTaskAccountId: "account1",
                earningsProfileCreatingTaskRetryCount: 1,
                earningsProfileCreatingTaskExecutionTimeMs: 302000,
              },
              GET_EARNINGS_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsProfileCreatingTaskStatement({
              earningsProfileCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
