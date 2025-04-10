import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { deleteAccountStatement, insertAccountStatement } from "../../db/sql";
import { SearchPublishersHandler } from "./search_publishers_handler";
import { ACCOUNT_SUMMARY } from "@phading/user_service_interface/web/third_person/account";
import { SEARCH_PUBLISHERS_RESPONSE } from "@phading/user_service_interface/web/third_person/interface";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, gt } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { AccountType } from "@phading/user_service_interface/account_type";

TEST_RUNNER.run({
  name: "SearchPublishersHandlerTest",
  cases: [
    {
      name: "SearchOnce_SearchAgainButNoMore",
      async execute() {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.PUBLISHER,
              naturalName: "Alice",
              description:
                "Alice whimsical account with a penchant for Adventure, Adventure and Innovation.",
              avatarSmallFilename: "avatar1",
              createdTimeMs: 3000,
            }),
            insertAccountStatement({
              userId: "user2",
              accountId: "account2",
              accountType: AccountType.PUBLISHER,
              naturalName: "Bob",
              description:
                "Alice whimsical account with a penchant for and innovation and adventure.",
              avatarSmallFilename: "avatar2",
              createdTimeMs: 1000,
            }),
            insertAccountStatement({
              userId: "user3",
              accountId: "account3",
              accountType: AccountType.PUBLISHER,
              naturalName: "Charlie",
              description:
                "Alice whimsical account with a penchant for and innovation and adventure.",
              avatarSmallFilename: "avatar3",
              createdTimeMs: 2000,
            }),
            insertAccountStatement({
              userId: "user4",
              accountId: "account4",
              accountType: AccountType.PUBLISHER,
              naturalName: "David",
              description: "Alice whimsical account with a penchant.",
              avatarSmallFilename: "avatar4",
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {} as FetchSessionAndCheckCapabilityResponse;
        let handler = new SearchPublishersHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://test.com",
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            query: "Alice Adventure Innovation",
            limit: 2,
          },
          "session1",
        );

        // Verify
        assertThat(
          response.accounts.length,
          eq(2),
          "response 1.accounts.length",
        );
        assertThat(
          response.accounts[0],
          eqMessage(
            {
              accountId: "account1",
              naturalName: "Alice",
              avatarSmallUrl: "https://test.com/avatar1",
            },
            ACCOUNT_SUMMARY,
          ),
          "response 1.accounts[0].accountId",
        );
        assertThat(
          response.accounts[1],
          eqMessage(
            {
              accountId: "account2",
              naturalName: "Bob",
              avatarSmallUrl: "https://test.com/avatar2",
            },
            ACCOUNT_SUMMARY,
          ),
          "response 1.accounts[1].accountId",
        );
        assertThat(response.scoreCusor, gt(0), "response 1.scoreCusor");
        assertThat(
          response.createdTimeCursor,
          eq(1000),
          "response 1.createdTimeCursor",
        );

        // Execute
        response = await handler.handle(
          "",
          {
            query: "Alice Adventure Innovation",
            limit: 2,
            scoreCursor: response.scoreCusor,
            createdTimeCursor: response.createdTimeCursor,
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              accounts: [
                {
                  accountId: "account3",
                  naturalName: "Charlie",
                  avatarSmallUrl: "https://test.com/avatar3",
                },
              ],
            },
            SEARCH_PUBLISHERS_RESPONSE,
          ),
          "response 2",
        );
      },
      async tearDown() {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement({
              accountAccountIdEq: "account1",
            }),
            deleteAccountStatement({
              accountAccountIdEq: "account2",
            }),
            deleteAccountStatement({
              accountAccountIdEq: "account3",
            }),
            deleteAccountStatement({
              accountAccountIdEq: "account4",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
