import { SPANNER_DATABASE } from "../common/spanner_database";
import { deleteAccountStatement, insertNewAccountStatement } from "../db/sql";
import { ListAccountsHandler } from "./list_accounts_handler";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { AccountType } from "@phading/user_service_interface/account_type";
import { LIST_ACCOUNTS_RESPONSE } from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

function createNewAccountState(
  userId: string,
  accountId: string,
  accountType: AccountType,
  createdTimestamp: number,
): Statement {
  return insertNewAccountStatement(
    userId,
    accountId,
    accountType,
    {
      naturalName: "",
      contactEmail: "",
      avatarSmallFilename: "",
      avatarLargeFilename: "",
    },
    "",
    createdTimestamp,
    100,
  );
}

TEST_RUNNER.run({
  name: "ListAccountsHandlerTest",
  cases: [
    {
      name: "ListOnce_ListTwiceAndExhausted",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            createNewAccountState(
              "user1",
              "consumer1",
              AccountType.CONSUMER,
              100,
            ),
            createNewAccountState(
              "user1",
              "publisher1",
              AccountType.PUBLISHER,
              400,
            ),
            createNewAccountState(
              "user1",
              "publisher2",
              AccountType.PUBLISHER,
              900,
            ),
            createNewAccountState(
              "user2",
              "publisher3",
              AccountType.PUBLISHER,
              500,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ListAccountsHandler(SPANNER_DATABASE);

        // Execute
        let response = await handler.handle("", {
          accountType: AccountType.PUBLISHER,
          createdTimeMsCursor: 3000,
          limit: 2,
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              accountIds: ["publisher2", "publisher3"],
              createdTimeMsCursor: 500,
            },
            LIST_ACCOUNTS_RESPONSE,
          ),
          "response",
        );

        // Execute
        response = await handler.handle("", {
          accountType: AccountType.PUBLISHER,
          createdTimeMsCursor: 500,
          limit: 2,
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              accountIds: ["publisher1"],
            },
            LIST_ACCOUNTS_RESPONSE,
          ),
          "response 2",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement("consumer1"),
            deleteAccountStatement("publisher1"),
            deleteAccountStatement("publisher2"),
            deleteAccountStatement("publisher3"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
