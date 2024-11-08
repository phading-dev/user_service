import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  deleteUserStatement,
  insertNewAccountStatement,
  insertNewUserStatement,
} from "../../db/sql";
import { SignInHandler } from "./sign_in_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { SIGN_IN_RESPONSE } from "@phading/user_service_interface/frontend/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
} from "@phading/user_session_service_interface/backend/interface";
import { newUnauthorizedError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SignInHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewUserStatement(
              "user1",
              "username1",
              "signed_password",
              "email",
            ),
            insertNewAccountStatement(
              "user1",
              "account1",
              AccountType.CONSUMER,
              "name1",
              "",
              "email",
              "avatar",
              "avatar",
              100,
              100,
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
              100,
              200,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          signedSession: "session1",
        } as CreateSessionResponse;
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_password";
        let handler = new SignInHandler(
          SPANNER_DATABASE,
          clientMock,
          signerMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          username: "username1",
          password: "pass1",
        });

        // Verify
        assertThat(signerMock.password, eq("pass1"), "password");
        assertThat(
          response,
          eqMessage(
            {
              signedSession: "session1",
            },
            SIGN_IN_RESPONSE,
          ),
          "response",
        );
        assertThat(clientMock.request.descriptor, eq(CREATE_SESSION), "RC");
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account2",
              accountType: AccountType.PUBLISHER,
            },
            CREATE_SESSION_REQUEST_BODY,
          ),
          "create session request",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement("user1"),
            deleteAccountStatement("account1"),
            deleteAccountStatement("account2"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "UsernameNotFound",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        let signerMock = new PasswordSignerMock();
        let handler = new SignInHandler(
          SPANNER_DATABASE,
          clientMock,
          signerMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            username: "username1",
            password: "pass1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(newUnauthorizedError("Failed to sign in")),
          "error",
        );
      },
      tearDown: async () => {},
    },
    {
      name: "PasswordNotMatched",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewUserStatement(
              "user1",
              "username1",
              "signed_password",
              "email",
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "another_signed_password";
        let handler = new SignInHandler(
          SPANNER_DATABASE,
          clientMock,
          signerMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            username: "username1",
            password: "pass1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(newUnauthorizedError("Failed to sign in")),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteUserStatement("user1")]);
          await transaction.commit();
        });
      },
    },
  ],
});
