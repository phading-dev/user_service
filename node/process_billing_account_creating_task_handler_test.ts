import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_BILLING_ACCOUNT_CREATING_TASK_ROW,
  deleteBillingAccountCreatingTaskStatement,
  getBillingAccountCreatingTask,
  insertBillingAccountCreatingTaskStatement,
} from "../db/sql";
import { ProcessBillingAccountCreatingTaskHandler } from "./process_billing_account_creating_task_handler";
import {
  CREATE_BILLING_ACCOUNT,
  CREATE_BILLING_ACCOUNT_REQUEST_BODY,
} from "@phading/commerce_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessBillingAccountCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessBillingAccountCreatingTaskHandler(
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
          eq(CREATE_BILLING_ACCOUNT),
          "RC",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "account1",
            },
            CREATE_BILLING_ACCOUNT_REQUEST_BODY,
          ),
          "RC body",
        );
        assertThat(
          await getBillingAccountCreatingTask(SPANNER_DATABASE, {
            billingAccountCreatingTaskAccountIdEq: "account1",
          }),
          isArray([]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountCreatingTaskStatement({
              billingAccountCreatingTaskAccountIdEq: "account1",
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
            insertBillingAccountCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessBillingAccountCreatingTaskHandler(
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
          await getBillingAccountCreatingTask(SPANNER_DATABASE, {
            billingAccountCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                billingAccountCreatingTaskAccountId: "account1",
                billingAccountCreatingTaskRetryCount: 1,
                billingAccountCreatingTaskExecutionTimeMs: 302000,
              },
              GET_BILLING_ACCOUNT_CREATING_TASK_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountCreatingTaskStatement({
              billingAccountCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
