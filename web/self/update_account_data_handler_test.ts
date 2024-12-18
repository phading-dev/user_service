import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_BY_ID_ROW,
  deleteAccountStatement,
  getAccountById,
  insertNewAccountStatement,
} from "../../db/sql";
import { UpdateAccountDataHandler } from "./update_account_data_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdateAccountDataHandlerTest",
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
              {
                naturalName: "name1",
                contactEmail: "email",
                avatarSmallFilename: "avatar",
                avatarLargeFilename: "avatar",
              },
              "",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdateAccountDataHandler(
          SPANNER_DATABASE,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            naturalName: "name2",
            contactEmail: "contact2@example.com",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getAccountById(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountType: AccountType.CONSUMER,
                accountData: {
                  naturalName: "name2",
                  contactEmail: "contact2@example.com",
                  avatarSmallFilename: "avatar",
                  avatarLargeFilename: "avatar",
                },
              },
              GET_ACCOUNT_BY_ID_ROW,
            ),
          ]),
          "account",
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
