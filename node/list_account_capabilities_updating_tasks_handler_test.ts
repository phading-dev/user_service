import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  insertAccountCapabilitiesUpdatingTaskStatement,
} from "../db/sql";
import { ListAccountCapabilitiesUpdatingTasksHandler } from "./list_account_capabilities_updating_tasks_handler";
import { LIST_ACCOUNT_CAPABILITIES_UPDATING_TASKS_RESPONSE } from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListAccountCapabilitiesUpdatingTasksHandlerTest",
  cases: [
    {
      name: "Default",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountCapabilitiesUpdatingTaskStatement(
              "account1",
              1,
              100,
              0,
            ),
            insertAccountCapabilitiesUpdatingTaskStatement("account2", 1, 0, 0),
            insertAccountCapabilitiesUpdatingTaskStatement(
              "account3",
              1,
              1000,
              0,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ListAccountCapabilitiesUpdatingTasksHandler(
          SPANNER_DATABASE,
          () => 100,
        );

        // Execute
        let response = await handler.handle("", {});

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tasks: [
                {
                  accountId: "account2",
                  capabilitiesVersion: 1,
                },
                {
                  accountId: "account1",
                  capabilitiesVersion: 1,
                },
              ],
            },
            LIST_ACCOUNT_CAPABILITIES_UPDATING_TASKS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountCapabilitiesUpdatingTaskStatement("account1", 1),
            deleteAccountCapabilitiesUpdatingTaskStatement("account2", 1),
            deleteAccountCapabilitiesUpdatingTaskStatement("account3", 1),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
