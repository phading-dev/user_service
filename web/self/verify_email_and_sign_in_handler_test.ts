import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  GET_USER_ROW,
  deleteAccountStatement,
  deleteEmailVerificationTokenStatement,
  deleteUserStatement,
  getAccount,
  getEmailVerificationToken,
  getUser,
  insertAccountStatement,
  insertEmailVerificationTokenStatement,
  insertUserStatement,
} from "../../db/sql";
import { VerifyEmailAndSignInHandler } from "./verify_email_and_sign_in_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import {
  RESET_PASSWORD_AND_SIGN_IN_RESPONSE,
  VERIFY_EMAIL_AND_SIGN_IN_RESPONSE,
} from "@phading/user_service_interface/web/self/interface";
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
  name: "VerifyEmailAndSignInHandlerTest",
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
              emailVerified: false,
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
            insertEmailVerificationTokenStatement({
              tokenId: "token1",
              userId: "user1",
              userEmail: "email1@user.com",
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
        let handler = new VerifyEmailAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          verificationToken: "token1",
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
                userEmailVerified: true,
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
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token1",
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
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
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
              emailVerified: false,
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
            insertEmailVerificationTokenStatement({
              tokenId: "token1",
              userId: "user1",
              userEmail: "email1@user.com",
              createdTimeMs: 100,
              expiresTimeMs: 500,
            }),
          ]);
          await transaction.commit();
        });
        let serviceClientMock = new NodeServiceClientMock();
        let handler = new VerifyEmailAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          verificationToken: "token1",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tokenExpired: true,
            },
            VERIFY_EMAIL_AND_SIGN_IN_RESPONSE,
          ),
          "response",
        );
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
                userEmailVerified: false,
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
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "EmailMismatch",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email2@user.com",
              emailVerified: false,
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
            insertEmailVerificationTokenStatement({
              tokenId: "token1",
              userId: "user1",
              userEmail: "email1@user.com",
              createdTimeMs: 100,
              expiresTimeMs: 2000,
            }),
          ]);
          await transaction.commit();
        });
        let serviceClientMock = new NodeServiceClientMock();
        let handler = new VerifyEmailAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          verificationToken: "token1",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tokenExpired: true,
            },
            VERIFY_EMAIL_AND_SIGN_IN_RESPONSE,
          ),
          "response",
        );
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
                userUserEmail: "email2@user.com",
                userEmailVerified: false,
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
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
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
        let handler = new VerifyEmailAndSignInHandler(
          SPANNER_DATABASE,
          serviceClientMock,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          verificationToken: "token1",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tokenExpired: true,
            },
            VERIFY_EMAIL_AND_SIGN_IN_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {},
    },
  ],
});
