import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_WITH_DESCRIPTION_BY_ID_ROW,
  deleteAccountStatement,
  getAccountWithDescriptionById,
  insertNewAccountStatement,
} from "../../db/sql";
import { UpdateAccountDescriptionHandler } from "./update_account_description_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdateAccountDescriptionHandlerTest",
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
        let handler = new UpdateAccountDescriptionHandler(
          SPANNER_DATABASE,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            description: "something something",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getAccountWithDescriptionById(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountType: AccountType.CONSUMER,
                accountData: {
                  naturalName: "name1",
                  contactEmail: "email",
                  avatarSmallFilename: "avatar",
                  avatarLargeFilename: "avatar",
                },
                accountDescription: "something something",
              },
              GET_ACCOUNT_WITH_DESCRIPTION_BY_ID_ROW,
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
    {
      name: "NoDescription",
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
              "something something",
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
        let handler = new UpdateAccountDescriptionHandler(
          SPANNER_DATABASE,
          clientMock,
        );

        // Execute
        await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          await getAccountWithDescriptionById(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountType: AccountType.CONSUMER,
                accountData: {
                  naturalName: "name1",
                  contactEmail: "email",
                  avatarSmallFilename: "avatar",
                  avatarLargeFilename: "avatar",
                },
                accountDescription: "",
              },
              GET_ACCOUNT_WITH_DESCRIPTION_BY_ID_ROW,
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
