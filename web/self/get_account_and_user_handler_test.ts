import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  deleteUserStatement,
  insertAccountStatement,
  insertUserStatement,
} from "../../db/sql";
import { GetAccountAndUserHandler } from "./get_account_and_user_handler";
import { GET_ACCOUNT_AND_USER_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetAccountAndUserHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              username: "username1",
              recoveryEmail: "recovery1",
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              naturalName: "name1",
              contactEmail: "contact1",
              description: "something something",
              avatarLargeFilename: "avatarL",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountAndUserHandler(
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
              account: {
                username: "username1",
                recoveryEmail: "recovery1",
                naturalName: "name1",
                description: "something something",
                contactEmail: "contact1",
                avatarLargeUrl: "https://custom.domain/avatarL",
              },
            },
            GET_ACCOUNT_AND_USER_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "NoUser",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountAndUserHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain/",
        );

        // Execute
        let error = await assertReject(handler.handle("", {}, "session1"));

        // Verify
        assertThat(
          error,
          eqHttpError(newInternalServerErrorError("is not found")),
          "",
        );
      },
      tearDown: async () => {},
    },
    {
      name: "NoAccount",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              username: "username1",
              recoveryEmail: "recovery1",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountAndUserHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain/",
        );

        // Execute
        let error = await assertReject(handler.handle("", {}, "session1"));

        // Verify
        assertThat(
          error,
          eqHttpError(newInternalServerErrorError("is not found")),
          "",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "NoMatchingAccount",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              username: "username1",
              recoveryEmail: "recovery1",
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account2",
              naturalName: "name1",
              contactEmail: "contact1",
              description: "something something",
              avatarLargeFilename: "avatarL",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountAndUserHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain/",
        );

        // Execute
        let error = await assertReject(handler.handle("", {}, "session1"));

        // Verify
        assertThat(
          error,
          eqHttpError(newInternalServerErrorError("is not found")),
          "",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountNotOwned",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              username: "username1",
              recoveryEmail: "recovery1",
            }),
            insertAccountStatement({
              userId: "user2",
              accountId: "account1",
              naturalName: "name1",
              contactEmail: "contact1",
              description: "something something",
              avatarLargeFilename: "avatarL",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountAndUserHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain/",
        );

        // Execute
        let error = await assertReject(handler.handle("", {}, "session1"));

        // Verify
        assertThat(
          error,
          eqHttpError(newInternalServerErrorError("is not found")),
          "",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
