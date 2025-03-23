import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_BILLING_PROFILE_CREATING_TASK_ROW,
  deleteBillingProfileCreatingTaskStatement,
  getBillingProfileCreatingTask,
  insertBillingProfileCreatingTaskStatement,
} from "../db/sql";
import { ProcessBillingProfileCreatingTaskHandler } from "./process_billing_profile_creating_task_handler";
import {
  CREATE_BILLING_PROFILE,
  CREATE_BILLING_PROFILE_REQUEST_BODY,
} from "@phading/commerce_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessBillingProfileCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessBillingProfileCreatingTaskHandler(
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
          eq(CREATE_BILLING_PROFILE),
          "RC",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "account1",
            },
            CREATE_BILLING_PROFILE_REQUEST_BODY,
          ),
          "RC body",
        );
        assertThat(
          await getBillingProfileCreatingTask(SPANNER_DATABASE, {
            billingProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileCreatingTaskStatement({
              billingProfileCreatingTaskAccountIdEq: "account1",
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
            insertBillingProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessBillingProfileCreatingTaskHandler(
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
          await getBillingProfileCreatingTask(SPANNER_DATABASE, {
            billingProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                billingProfileCreatingTaskAccountId: "account1",
                billingProfileCreatingTaskRetryCount: 1,
                billingProfileCreatingTaskExecutionTimeMs: 302000,
              },
              GET_BILLING_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileCreatingTaskStatement({
              billingProfileCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
