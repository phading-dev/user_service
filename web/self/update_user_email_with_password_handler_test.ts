import "../../local/env";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  GET_USER_ROW,
  deleteAccountStatement,
  deleteUserStatement,
  getAccount,
  getUser,
  insertAccountStatement,
  insertUserStatement,
} from "../../db/sql";
import { UpdateUserEmailWithPasswordHandler } from "./update_user_email_with_password_handler";
import { UPDATE_USER_EMAIL_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdateUserEmailWithPasswordHandlerTest",
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
              emailVerified: true,
              passwordHashV1: "signed_current_pass",
            }),
            insertAccountStatement({
              accountId: "account1",
              userId: "user1",
              contactEmail: "email1@user.com",
              createdTimeMs: 100,
            }),
            insertAccountStatement({
              accountId: "account2",
              userId: "user1",
              contactEmail: "email1@user.com",
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_current_pass";
        let handler = new UpdateUserEmailWithPasswordHandler(
          SPANNER_DATABASE,
          signerMock,
        );

        // Execute
        await handler.handle("", {
          currentEmail: "email1@user.com",
          password: "current_password",
          newEmail: "email2@user.com",
        });

        // Verify
        assertThat(
          signerMock.password,
          eq("current_password"),
          "current password",
        );
        assertThat(
          await getUser(SPANNER_DATABASE, { userUserIdEq: "user1" }),
          isArray([
            eqMessage(
              {
                userUserId: "user1",
                userUserEmail: "email2@user.com",
                userEmailVerified: false,
                userPasswordHashV1: "signed_current_pass",
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
                accountContactEmail: "email2@user.com",
                accountCreatedTimeMs: 100,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account1",
        );
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account2",
          }),
          isArray([
            eqMessage(
              {
                accountAccountId: "account2",
                accountUserId: "user1",
                accountContactEmail: "email2@user.com",
                accountCreatedTimeMs: 100,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account2",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "NewEmailUnavailable",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email1@user.com",
              emailVerified: true,
              passwordHashV1: "signed_current_pass",
            }),
            insertUserStatement({
              userId: "user2",
              userEmail: "new_email@user.com",
              emailVerified: true,
              passwordHashV1: "signed_current_pass_2",
            }),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_current_pass";
        let handler = new UpdateUserEmailWithPasswordHandler(
          SPANNER_DATABASE,
          signerMock,
        );

        // Execute
        let response = await handler.handle("", {
          currentEmail: "email1@user.com",
          password: "current_pass",
          newEmail: "new_email@user.com",
        });

        // Verify
        assertThat(
          response,
          eqMessage({ userEmailUnavailable: true }, UPDATE_USER_EMAIL_RESPONSE),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteUserStatement({ userUserIdEq: "user2" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "UserNotFound",
      execute: async () => {
        // Prepare
        let signerMock = new PasswordSignerMock();
        let handler = new UpdateUserEmailWithPasswordHandler(
          SPANNER_DATABASE,
          signerMock,
        );

        // Execute
        let response = await handler.handle("", {
          currentEmail: "email1@user.com",
          password: "current_pass",
          newEmail: "new_email",
        });

        // Verify
        assertThat(
          response,
          eqMessage({ notAuthenticated: true }, UPDATE_USER_EMAIL_RESPONSE),
          "error",
        );
      },
      tearDown: async () => {},
    },
    {
      name: "PasswordNotMatch",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "email1@user.com",
              passwordHashV1: "signed_current_pass",
            }),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "incorrect_signed_current_pass";
        let handler = new UpdateUserEmailWithPasswordHandler(
          SPANNER_DATABASE,
          signerMock,
        );

        // Execute
        let response = await handler.handle("", {
          currentEmail: "email1@user.com",
          password: "current_pass",
          newEmail: "new_email@user.com",
        });

        // Verify
        assertThat(
          response,
          eqMessage({ notAuthenticated: true }, UPDATE_USER_EMAIL_RESPONSE),
          "response",
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
  ],
});
