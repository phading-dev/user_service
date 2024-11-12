import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  insertNewAccountStatement,
} from "../../db/sql";
import { ListAccountsHandler } from "./list_accounts_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { LIST_ACCOUNTS_RESPONSE } from "@phading/user_service_interface/frontend/self/interface";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListAccountsHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewAccountStatement(
              "user1",
              "account1",
              AccountType.CONSUMER,
              "name1",
              "",
              "email1",
              "avatar1",
              "avatar1",
              1000,
              1000,
            ),
            insertNewAccountStatement(
              "user1",
              "account2",
              AccountType.PUBLISHER,
              "name2",
              "",
              "email2",
              "avatar2",
              "avatar2",
              1000,
              3000,
            ),
            insertNewAccountStatement(
              "user1",
              "account3",
              AccountType.PUBLISHER,
              "name3",
              "",
              "email3",
              "avatar3",
              "avatar3",
              1000,
              2000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new ListAccountsHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain/",
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              accounts: [
                {
                  accountId: "account2",
                  accountType: AccountType.PUBLISHER,
                  naturalName: "name2",
                  avatarSmallUrl: "https://custom.domain/avatar2",
                },
                {
                  accountId: "account3",
                  accountType: AccountType.PUBLISHER,
                  naturalName: "name3",
                  avatarSmallUrl: "https://custom.domain/avatar3",
                },
                {
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  naturalName: "name1",
                  avatarSmallUrl: "https://custom.domain/avatar1",
                },
              ],
            },
            LIST_ACCOUNTS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement("account1"),
            deleteAccountStatement("account2"),
            deleteAccountStatement("account3"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
