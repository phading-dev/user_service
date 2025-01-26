import { SPANNER_DATABASE } from "../common/spanner_database";
import { deleteAccountStatement, insertAccountStatement } from "../db/sql";
import { GetAccountContactHandler } from "./get_account_contact_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { GET_ACCOUNT_CONTACT_RESPONSE } from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetAccountContactHandlerTest",
  cases: [
    {
      name: "Default",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              naturalName: "name1",
              contactEmail: "email1",
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new GetAccountContactHandler(SPANNER_DATABASE);

        // Execute
        let response = await handler.handle("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              naturalName: "name1",
              contactEmail: "email1",
            },
            GET_ACCOUNT_CONTACT_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
      },
    },
  ],
});
