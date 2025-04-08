import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYMENT_PROFILE_CREATING_TASK_ROW,
  deletePaymentProfileCreatingTaskStatement,
  getPaymentProfileCreatingTask,
  insertPaymentProfileCreatingTaskStatement,
} from "../db/sql";
import { ProcessPaymentProfileCreatingTaskHandler } from "./process_payment_profile_creating_task_handler";
import {
  CREATE_PAYMENT_PROFILE,
  CREATE_PAYMENT_PROFILE_REQUEST_BODY,
} from "@phading/commerce_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessPaymentProfileCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessPaymentProfileCreatingTaskHandler(
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
          eq(CREATE_PAYMENT_PROFILE),
          "RC",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "account1",
            },
            CREATE_PAYMENT_PROFILE_REQUEST_BODY,
          ),
          "RC body",
        );
        assertThat(
          await getPaymentProfileCreatingTask(SPANNER_DATABASE, {
            paymentProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileCreatingTaskStatement({
              paymentProfileCreatingTaskAccountIdEq: "account1",
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
            insertPaymentProfileCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let handler = new ProcessPaymentProfileCreatingTaskHandler(
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
          await getPaymentProfileCreatingTask(SPANNER_DATABASE, {
            paymentProfileCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileCreatingTaskAccountId: "account1",
                paymentProfileCreatingTaskRetryCount: 1,
                paymentProfileCreatingTaskExecutionTimeMs: 302000,
              },
              GET_PAYMENT_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileCreatingTaskStatement({
              paymentProfileCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
