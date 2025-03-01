import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_AND_MORE_BY_ID_ROW,
  deleteAccountMoreStatement,
  deleteAccountStatement,
  getAccountAndMoreById,
  insertAccountMoreStatement,
  insertAccountStatement,
} from "../../db/sql";
import { UpdateAccountHandler } from "./update_account_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
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
              accountType: AccountType.CONSUMER,
              naturalName: "name1",
              contactEmail: "email",
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
            insertAccountMoreStatement({
              accountId: "account1",
              description: "something something",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
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
          await getAccountAndMoreById(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                aData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  naturalName: "name2",
                  contactEmail: "contact2@example.com",
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
                amData: {
                  accountId: "account1",
                  description: "",
                },
              },
              GET_ACCOUNT_AND_MORE_BY_ID_ROW,
            ),
          ]),
          "account",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement("account1"),
            deleteAccountMoreStatement("account1"),
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
              accountType: AccountType.CONSUMER,
              naturalName: "name1",
              contactEmail: "email",
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
            insertAccountMoreStatement({
              accountId: "account1",
              description: "",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
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
          await getAccountAndMoreById(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                aData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  naturalName: "name2",
                  contactEmail: "contact2@example.com",
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
                amData: {
                  accountId: "account1",
                  description: "something something",
                },
              },
              GET_ACCOUNT_AND_MORE_BY_ID_ROW,
            ),
          ]),
          "account",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement("account1"),
            deleteAccountMoreStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
