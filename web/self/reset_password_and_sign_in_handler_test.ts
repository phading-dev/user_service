import "../../local/env";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  GET_USER_ROW,
  deleteAccountStatement,
  deletePasswordResetTokenStatement,
  deleteUserStatement,
  getAccount,
  getPasswordResetToken,
  getUser,
  insertAccountStatement,
  insertPasswordResetTokenStatement,
  insertUserStatement,
} from "../../db/sql";
import { ResetPasswordAndSignInHandler } from "./reset_password_and_sign_in_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import { RESET_PASSWORD_AND_SIGN_IN_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
} from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ResetPasswordAndSignInHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email1@user.com",
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              capabilitiesVersion: 1,
              accountType: AccountType.CONSUMER,
              paymentProfileState: PaymentProfileState.HEALTHY,
              lastAccessedTimeMs: 200,
              createdTimeMs: 100,
            }),
            insertPasswordResetTokenStatement({
              tokenId: "token1",
              userId: "user1",
              createdTimeMs: 100,
              expiresTimeMs: 2000,
            }),
          ]);
          await transaction.commit();
        });
        let serviceClientMock = new NodeServiceClientMock();
        let createSessionResponse: CreateSessionResponse = {
          signedSession: "signed_session",
        };
        serviceClientMock.response = createSessionResponse;
        let passwordSignerMock = new PasswordSignerMock();
        passwordSignerMock.signed = "signed_password";
        let handler = new ResetPasswordAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          passwordSignerMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          resetToken: "token1",
          newPassword: "newPassword123",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              signedSession: "signed_session",
            },
            RESET_PASSWORD_AND_SIGN_IN_RESPONSE,
          ),
          "response",
        );
        assertThat(
          passwordSignerMock.password,
          eq("newPassword123"),
          "password",
        );
        assertThat(
          serviceClientMock.request.descriptor,
          eq(CREATE_SESSION),
          "request descriptor",
        );
        assertThat(
          serviceClientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account1",
              capabilities: {
                canConsume: true,
                canPublish: false,
                canBeBilled: true,
                canEarn: false,
              },
              capabilitiesVersion: 1,
            },
            CREATE_SESSION_REQUEST_BODY,
          ),
          "request body",
        );
        assertThat(
          await getUser(SPANNER_DATABASE, {
            userUserIdEq: "user1",
          }),
          isArray([
            eqMessage(
              {
                userUserId: "user1",
                userUserEmail: "email1@user.com",
                userPasswordHashV1: "signed_password",
              },
              GET_USER_ROW,
            ),
          ]),
          "user",
        );
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountAccountId: "account1",
                accountUserId: "user1",
                accountCapabilitiesVersion: 1,
                accountAccountType: AccountType.CONSUMER,
                accountPaymentProfileState: PaymentProfileState.HEALTHY,
                accountLastAccessedTimeMs: 1000,
                accountCreatedTimeMs: 100,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token1",
          }),
          isArray([]),
          "token",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deleteAccountStatement({
              accountAccountIdEq: "account1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "TokenExpired",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email1@user.com",
            }),
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              capabilitiesVersion: 1,
              accountType: AccountType.CONSUMER,
              paymentProfileState: PaymentProfileState.HEALTHY,
              lastAccessedTimeMs: 200,
              createdTimeMs: 100,
            }),
            insertPasswordResetTokenStatement({
              tokenId: "token1",
              userId: "user1",
              createdTimeMs: 100,
              expiresTimeMs: 500,
            }),
          ]);
          await transaction.commit();
        });
        let serviceClientMock = new NodeServiceClientMock();
        let passwordSignerMock = new PasswordSignerMock();
        let handler = new ResetPasswordAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          passwordSignerMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          resetToken: "token1",
          newPassword: "newPassword123",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tokenExpired: true,
            },
            RESET_PASSWORD_AND_SIGN_IN_RESPONSE,
          ),
          "response",
        );
        assertThat(passwordSignerMock.password, eq(undefined), "password");
        assertThat(
          serviceClientMock.request,
          eq(undefined),
          "request descriptor",
        );
        assertThat(
          await getUser(SPANNER_DATABASE, {
            userUserIdEq: "user1",
          }),
          isArray([
            eqMessage(
              {
                userUserId: "user1",
                userUserEmail: "email1@user.com",
              },
              GET_USER_ROW,
            ),
          ]),
          "user",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deleteAccountStatement({
              accountAccountIdEq: "account1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "TokenNotFound",
      execute: async () => {
        // Prepare
        let serviceClientMock = new NodeServiceClientMock();
        let passwordSignerMock = new PasswordSignerMock();
        let handler = new ResetPasswordAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          passwordSignerMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          resetToken: "token1",
          newPassword: "newPassword123",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tokenExpired: true,
            },
            RESET_PASSWORD_AND_SIGN_IN_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {},
    },
  ],
});
