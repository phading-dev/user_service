import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { deleteAccountStatement, insertAccountStatement } from "../../db/sql";
import { ListAccountsHandler } from "./list_accounts_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { LIST_ACCOUNTS_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
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
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              name: "name1",
              avatarLargeFilename: "avatar1",
              lastAccessedTimeMs: 1000,
              createdTimeMs: 1000,
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account2",
              accountType: AccountType.PUBLISHER,
              name: "name2",
              avatarLargeFilename: "avatar2",
              lastAccessedTimeMs: 3000,
              createdTimeMs: 1000,
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account3",
              accountType: AccountType.PUBLISHER,
              name: "name3",
              avatarLargeFilename: "avatar3",
              lastAccessedTimeMs: 2000,
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ListAccountsHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain",
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
                  name: "name2",
                  avatarLargeUrl: "https://custom.domain/avatar2",
                },
                {
                  accountId: "account3",
                  accountType: AccountType.PUBLISHER,
                  name: "name3",
                  avatarLargeUrl: "https://custom.domain/avatar3",
                },
                {
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  name: "name1",
                  avatarLargeUrl: "https://custom.domain/avatar1",
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
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
            deleteAccountStatement({ accountAccountIdEq: "account3" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
