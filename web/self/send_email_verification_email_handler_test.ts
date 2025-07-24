import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_EMAIL_VERIFICATION_TOKEN_ROW,
  deleteEmailVerificationTokenStatement,
  deleteUserStatement,
  getEmailVerificationToken,
  insertEmailVerificationTokenStatement,
  insertUserStatement,
} from "../../db/sql";
import { SendEmailVerificationEmailHandler } from "./send_email_verification_email_handler";
import { SEND_EMAIL_VERIFICATION_EMAIL_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqMessage } from "@selfage/message/test_matcher";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SendEmailVerificationEmailHandlerTest",
  cases: [
    {
      name: "FirstTime",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email@user.com",
              emailVerified: false,
            }),
          ]);
          await transaction.commit();
        });
        let sendEmailParams: any;
        let sendgridClientMock = {
          send: async (params: any) => {
            sendEmailParams = params;
          },
        } as any;
        let handler = new SendEmailVerificationEmailHandler(
          SPANNER_DATABASE,
          sendgridClientMock,
          "https://example.com",
          () => "token1",
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          userEmail: "email@user.com",
        });

        // Verify
        assertThat(
          response,
          eqMessage({}, SEND_EMAIL_VERIFICATION_EMAIL_RESPONSE),
          "response",
        );
        assertThat(
          sendEmailParams.to,
          eq("email@user.com"),
          "sendEmailParams.to",
        );
        assertThat(
          sendEmailParams.dynamicTemplateData.expiringTimeInMinutes,
          eq("30"),
          "sendEmailParams.dynamicTemplateData.expiringTimeInMinutes",
        );
        assertThat(
          sendEmailParams.dynamicTemplateData.verificationUrl,
          eq(
            "https://example.com/?e=%7B%223%22%3A%7B%221%22%3A%22token1%22%7D%7D",
          ),
          "sendEmailParams.dynamicTemplateData.verificationUrl",
        );
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token1",
          }),
          isArray([
            eqMessage(
              {
                emailVerificationTokenTokenId: "token1",
                emailVerificationTokenUserId: "user1",
                emailVerificationTokenUserEmail: "email@user.com",
                emailVerificationTokenCreatedTimeMs: 1000,
                emailVerificationTokenExpiresTimeMs: 1000 + 30 * 60 * 1000,
              },
              GET_EMAIL_VERIFICATION_TOKEN_ROW,
            ),
          ]),
          "getEmailVerificationToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
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
      name: "SecondTime",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email@user.com",
              emailVerified: false,
            }),
            insertEmailVerificationTokenStatement({
              tokenId: "token1",
              userId: "user1",
              userEmail: "email@user.com",
              createdTimeMs: 1000,
              expiresTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let sendEmailParams: any;
        let sendgridClientMock = {
          send: async (params: any) => {
            sendEmailParams = params;
          },
        } as any;
        let handler = new SendEmailVerificationEmailHandler(
          SPANNER_DATABASE,
          sendgridClientMock,
          "https://example.com",
          () => "token2",
          () => 10 * 60 * 1000,
        );

        // Execute
        let response = await handler.handle("", {
          userEmail: "email@user.com",
        });

        // Verify
        assertThat(
          response,
          eqMessage({}, SEND_EMAIL_VERIFICATION_EMAIL_RESPONSE),
          "response",
        );
        assertThat(
          sendEmailParams.to,
          eq("email@user.com"),
          "sendEmailParams.to",
        );
        assertThat(
          sendEmailParams.dynamicTemplateData.verificationUrl,
          eq(
            "https://example.com/?e=%7B%223%22%3A%7B%221%22%3A%22token2%22%7D%7D",
          ),
          "sendEmailParams.dynamicTemplateData.verificationUrl",
        );
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token2",
          }),
          isArray([
            eqMessage(
              {
                emailVerificationTokenTokenId: "token2",
                emailVerificationTokenUserId: "user1",
                emailVerificationTokenUserEmail: "email@user.com",
                emailVerificationTokenCreatedTimeMs: 10 * 60 * 1000,
                emailVerificationTokenExpiresTimeMs: 40 * 60 * 1000,
              },
              GET_EMAIL_VERIFICATION_TOKEN_ROW,
            ),
          ]),
          "getEmailVerificationToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token2",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "RateLimited",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email@user.com",
              emailVerified: false,
            }),
            insertEmailVerificationTokenStatement({
              tokenId: "token1",
              userId: "user1",
              userEmail: "email@user.com",
              createdTimeMs: 1000,
              expiresTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let sendEmailParams: any;
        let sendgridClientMock = {
          send: async (params: any) => {
            sendEmailParams = params;
          },
        } as any;
        let handler = new SendEmailVerificationEmailHandler(
          SPANNER_DATABASE,
          sendgridClientMock,
          "https://example.com",
          () => "token2",
          () => 2000,
        );

        // Execute
        let response = await handler.handle("", {
          userEmail: "email@user.com",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              rateLimited: true,
            },
            SEND_EMAIL_VERIFICATION_EMAIL_RESPONSE,
          ),
          "response",
        );
        assertThat(sendEmailParams, eq(undefined), "sendEmailParams");
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token2",
          }),
          isArray([]),
          "getEmailVerificationToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token2",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AlreadyVerified",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email@user.com",
              emailVerified: true,
            }),
          ]);
          await transaction.commit();
        });
        let sendEmailParams: any;
        let sendgridClientMock = {
          send: async (params: any) => {
            sendEmailParams = params;
          },
        } as any;
        let handler = new SendEmailVerificationEmailHandler(
          SPANNER_DATABASE,
          sendgridClientMock,
          "https://example.com",
          () => "token1",
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            userEmail: "email@user.com",
          }),
        );

        // Verify
        assertThat(
          error,
          eqError(newBadRequestError("already has verified email.")),
          "error",
        );
        assertThat(sendEmailParams, eq(undefined), "sendEmailParams");
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token1",
          }),
          isArray([]),
          "getEmailVerificationToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
