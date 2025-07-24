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
              name: "name1",
              contactEmail: "email",
              description: "something something",
              createdTimeMs: 1000,
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
            name: "name2",
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
                accountName: "name2",
                accountContactEmail: "email",
                accountDescription: "",
                accountCreatedTimeMs: 1000,
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
              name: "name1",
              contactEmail: "email",
              description: "",
              createdTimeMs: 1000,
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
            name: "name2",
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
                accountName: "name2",
                accountContactEmail: "email",
                accountDescription: "something something",
                accountCreatedTimeMs: 1000,
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
