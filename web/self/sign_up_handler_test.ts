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
  deleteUserStatement,
  getAccount,
  getUser,
  insertUserStatement,
} from "../../db/sql";
import { SignUpHandler } from "./sign_up_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
import { SIGN_UP_RESPONSE } from "@phading/user_service_interface/web/self/interface";
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
  name: "SignUpHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          signedSession: "session1",
        } as CreateSessionResponse;
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_password";
        let uuid = 1;
        let handler = new SignUpHandler(
          SPANNER_DATABASE,
          clientMock,
          signerMock,
          () => `id${uuid++}`,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          username: "username1",
          password: "pass1",
          recoveryEmail: "recovery@example.com",
          naturalName: "first second",
          accountType: AccountType.CONSUMER,
          contactEmail: "contact@example.com",
        });

        // Verify
        assertThat(signerMock.password, eq("pass1"), "raw password");
        assertThat(
          await getUser(SPANNER_DATABASE, { userUserIdEq: "id1" }),
          isArray([
            eqMessage(
              {
                userUserId: "id1",
                userUsername: "username1",
                userPasswordHashV1: "signed_password",
                userRecoveryEmail: "recovery@example.com",
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
                accountNaturalName: "first second",
                accountDescription: "",
                accountContactEmail: "contact@example.com",
                accountAvatarSmallFilename:
                  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                accountAvatarLargeFilename:
                  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                accountCreatedTimeMs: 1000,
                accountLastAccessedTimeMs: 1000,
                accountCapabilitiesVersion: 0,
                accountBillingProfileStateVersion: 0,
                accountBillingProfileState: BillingProfileState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account created",
        );
        assertThat(
          response,
          eqMessage(
            {
              signedSession: "session1",
              usernameIsAvailable: true,
            },
            SIGN_UP_RESPONSE,
          ),
          "response",
        );
        assertThat(clientMock.request.descriptor, eq(CREATE_SESSION), "RC");
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              userId: "id1",
              accountId: "id2",
              capabilitiesVersion: 0,
              capabilities: {
                canConsume: true,
                canPublish: false,
                canBeBilled: true,
                canEarn: false,
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
            deleteUserStatement({ userUserIdEq: "id1" }),
            deleteAccountStatement({ accountAccountIdEq: "id2" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "UsernameNotAvailable",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              username: "username1",
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
        let uuid = 1;
        let handler = new SignUpHandler(
          SPANNER_DATABASE,
          clientMock,
          signerMock,
          () => `id${uuid++}`,
          () => 1000,
        );

        // Execute
        let response = await handler.handle("", {
          username: "username1",
          password: "pass1",
          recoveryEmail: "recovery@example.com",
          naturalName: "first second",
          accountType: AccountType.CONSUMER,
          contactEmail: "contact@example.com",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              usernameIsAvailable: false,
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
