import "../../local/env";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  deleteUserStatement,
  insertAccountStatement,
  insertUserStatement,
} from "../../db/sql";
import { SignInHandler } from "./sign_in_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { SIGN_IN_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
} from "@phading/user_session_service_interface/node/interface";
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
            insertUserStatement({
              userId: "user1",
              username: "username1",
              passwordHashV1: "signed_password",
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 0,
              billingAccountStateInfo: {
                state: BillingAccountState.HEALTHY,
              },
              createdTimeMs: 100,
              lastAccessedTimeMs: 100,
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account2",
              accountType: AccountType.PUBLISHER,
              capabilitiesVersion: 0,
              billingAccountStateInfo: {
                state: BillingAccountState.HEALTHY,
              },
              createdTimeMs: 100,
              lastAccessedTimeMs: 200,
            }),
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
              capabilitiesVersion: 0,
              capabilities: {
                canConsumeShows: false,
                canPublishShows: true,
                canBeBilled: true,
                canEarn: true,
              },
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
            insertUserStatement({
              userId: "user1",
              username: "username1",
              passwordHashV1: "signed_password",
              recoveryEmail: "email",
              createdTimeMs: 100,
            }),
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
