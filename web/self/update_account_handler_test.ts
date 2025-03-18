import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  deleteAccountStatement,
  getAccount,
  insertAccountStatement,
} from "../../db/sql";
import { UpdateAccountHandler } from "./update_account_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdateAccountHandlerTest",
  cases: [
    {
      name: "NoDescription",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              naturalName: "name1",
              contactEmail: "email",
              description: "something something",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new UpdateAccountHandler(SPANNER_DATABASE, clientMock);

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
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountNaturalName: "name2",
                accountContactEmail: "contact2@example.com",
                accountDescription: "",
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "WithDescription",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              naturalName: "name1",
              contactEmail: "email",
              description: "",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new UpdateAccountHandler(SPANNER_DATABASE, clientMock);

        // Execute
        await handler.handle(
          "",
          {
            naturalName: "name2",
            contactEmail: "contact2@example.com",
            description: "something something",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountNaturalName: "name2",
                accountContactEmail: "contact2@example.com",
                accountDescription: "something something",
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
