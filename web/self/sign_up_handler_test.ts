import "../../local/env";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/constants";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  GET_USER_ROW,
  deleteAccountStatement,
  deletePaymentProfileCreatingTaskStatement,
  deleteUserStatement,
  getAccount,
  getUser,
  insertUserStatement,
} from "../../db/sql";
import { SignUpHandler } from "./sign_up_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import { SIGN_UP_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SignUpHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_password";
        let uuid = 1;
        let handler = new SignUpHandler(
          SPANNER_DATABASE,
          signerMock,
          () => `id${uuid++}`,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          userEmail: "user@example.com",
          password: "pass1",
          name: "first second",
          accountType: AccountType.CONSUMER,
        });

        // Verify
        assertThat(response, eqMessage({}, SIGN_UP_RESPONSE), "response");
        assertThat(signerMock.password, eq("pass1"), "raw password");
        assertThat(
          await getUser(SPANNER_DATABASE, { userUserIdEq: "id1" }),
          isArray([
            eqMessage(
              {
                userUserId: "id1",
                userUserEmail: "user@example.com",
                userEmailVerified: false,
                userPasswordHashV1: "signed_password",
                userTotalAccounts: 1,
                userCreatedTimeMs: 1000,
              },
              GET_USER_ROW,
            ),
          ]),
          "user created",
        );
        assertThat(
          await getAccount(SPANNER_DATABASE, { accountAccountIdEq: "id2" }),
          isArray([
            eqMessage(
              {
                accountUserId: "id1",
                accountAccountId: "id2",
                accountAccountType: AccountType.CONSUMER,
                accountName: "first second",
                accountDescription: "",
                accountContactEmail: "user@example.com",
                accountAvatarSmallFilename:
                  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                accountAvatarLargeFilename:
                  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                accountCreatedTimeMs: 1000,
                accountLastAccessedTimeMs: 1000,
                accountCapabilitiesVersion: 0,
                accountPaymentProfileStateVersion: 0,
                accountPaymentProfileState: PaymentProfileState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account created",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "id1" }),
            deleteAccountStatement({ accountAccountIdEq: "id2" }),
            deletePaymentProfileCreatingTaskStatement({
              paymentProfileCreatingTaskAccountIdEq: "id2",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "UserEmailUnavailable",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "user@example.com",
            }),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_password";
        let uuid = 1;
        let handler = new SignUpHandler(
          SPANNER_DATABASE,
          signerMock,
          () => `id${uuid++}`,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          userEmail: "user@example.com",
          password: "pass1",
          name: "first second",
          accountType: AccountType.CONSUMER,
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              userEmailUnavailable: true,
            },
            SIGN_UP_RESPONSE,
          ),
          "response",
        );
        assertThat(
          (await getUser(SPANNER_DATABASE, { userUserIdEq: "id1" })).length,
          eq(0),
          "user not created",
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
