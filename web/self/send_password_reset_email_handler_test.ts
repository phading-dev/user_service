import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_PASSWORD_RESET_TOKEN_ROW,
  deletePasswordResetTokenStatement,
  deleteUserStatement,
  getPasswordResetToken,
  insertPasswordResetTokenStatement,
  insertUserStatement,
} from "../../db/sql";
import { SendPasswordResetEmailHandler } from "./send_password_reset_email_handler";
import { SEND_PASSWORD_RESET_EMAIL_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SendPasswordResetEmailHandlerTest",
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
        let handler = new SendPasswordResetEmailHandler(
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
          eqMessage({}, SEND_PASSWORD_RESET_EMAIL_RESPONSE),
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
          sendEmailParams.dynamicTemplateData.passwordResetUrl,
          eq(
            "https://example.com/?e=%7B%224%22%3A%7B%221%22%3A%22token1%22%7D%7D",
          ),
          "sendEmailParams.dynamicTemplateData.passwordResetUrl",
        );
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token1",
          }),
          isArray([
            eqMessage(
              {
                passwordResetTokenTokenId: "token1",
                passwordResetTokenUserId: "user1",
                passwordResetTokenCreatedTimeMs: 1000,
                passwordResetTokenExpiresTimeMs: 1000 + 30 * 60 * 1000,
              },
              GET_PASSWORD_RESET_TOKEN_ROW,
            ),
          ]),
          "getPasswordResetToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
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
      name: "SecondTime",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email@user.com",
            }),
            insertPasswordResetTokenStatement({
              tokenId: "token1",
              userId: "user1",
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
        let handler = new SendPasswordResetEmailHandler(
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
          eqMessage({}, SEND_PASSWORD_RESET_EMAIL_RESPONSE),
          "response",
        );
        assertThat(
          sendEmailParams.to,
          eq("email@user.com"),
          "sendEmailParams.to",
        );
        assertThat(
          sendEmailParams.dynamicTemplateData.passwordResetUrl,
          eq(
            "https://example.com/?e=%7B%224%22%3A%7B%221%22%3A%22token2%22%7D%7D",
          ),
          "sendEmailParams.dynamicTemplateData.passwordResetUrl",
        );
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token2",
          }),
          isArray([
            eqMessage(
              {
                passwordResetTokenTokenId: "token2",
                passwordResetTokenUserId: "user1",
                passwordResetTokenCreatedTimeMs: 10 * 60 * 1000,
                passwordResetTokenExpiresTimeMs: 40 * 60 * 1000,
              },
              GET_PASSWORD_RESET_TOKEN_ROW,
            ),
          ]),
          "getPasswordResetToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token2",
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
            }),
            insertPasswordResetTokenStatement({
              tokenId: "token1",
              userId: "user1",
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
        let handler = new SendPasswordResetEmailHandler(
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
            SEND_PASSWORD_RESET_EMAIL_RESPONSE,
          ),
          "response",
        );
        assertThat(sendEmailParams, eq(undefined), "sendEmailParams");
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token2",
          }),
          isArray([]),
          "getPasswordResetToken",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({
              userUserIdEq: "user1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token2",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
