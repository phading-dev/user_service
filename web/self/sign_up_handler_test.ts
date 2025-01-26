import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_USER_AND_ACCOUNT_AND_MORE_ROW,
  deleteAccountMoreStatement,
  deleteAccountStatement,
  deleteUserStatement,
  getUser,
  getUserAndAccountAndMore,
  insertUserStatement,
} from "../../db/sql";
import { SignUpHandler } from "./sign_up_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
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
          await getUserAndAccountAndMore(SPANNER_DATABASE, "id1", "id2"),
          isArray([
            eqMessage(
              {
                uData: {
                  userId: "id1",
                  username: "username1",
                  passwordHashV1: "signed_password",
                  recoveryEmail: "recovery@example.com",
                  totalAccounts: 1,
                  createdTimeMs: 1000,
                },
                aData: {
                  userId: "id1",
                  accountId: "id2",
                  accountType: AccountType.CONSUMER,
                  naturalName: "first second",
                  contactEmail: "contact@example.com",
                  avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                  avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                  capabilitiesVersion: 0,
                  billingAccountStateInfo: {
                    version: 0,
                    state: BillingAccountState.HEALTHY,
                  },
                },
                amData: {
                  accountId: "id2",
                  description: "",
                },
              },
              GET_USER_AND_ACCOUNT_AND_MORE_ROW,
            ),
          ]),
          "user and account created",
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
                canConsumeShows: true,
                canPublishShows: false,
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
            deleteUserStatement("id1"),
            deleteAccountStatement("id2"),
            deleteAccountMoreStatement("id2"),
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
          (await getUser(SPANNER_DATABASE, "id1")).length,
          eq(0),
          "user not created",
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
