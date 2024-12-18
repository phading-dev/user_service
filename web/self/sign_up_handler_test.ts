import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_WITH_DESCRIPTION_BY_ID_ROW,
  GET_USER_BY_ID_ROW,
  deleteAccountStatement,
  deleteUserStatement,
  getAccountWithDescriptionById,
  getUserById,
  insertNewUserStatement,
} from "../../db/sql";
import { SignUpHandler } from "./sign_up_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
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
          await getUserById(SPANNER_DATABASE, "id1"),
          isArray([
            eqMessage(
              {
                userUsername: "username1",
                userPasswordHashV1: "signed_password",
                userRecoveryEmail: "recovery@example.com",
              },
              GET_USER_BY_ID_ROW,
            ),
          ]),
          "user created",
        );
        assertThat(
          await getAccountWithDescriptionById(SPANNER_DATABASE, "id2"),
          isArray([
            eqMessage(
              {
                accountUserId: "id1",
                accountAccountType: AccountType.CONSUMER,
                accountData: {
                  naturalName: "first second",
                  contactEmail: "contact@example.com",
                  avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                  avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                },
                accountDescription: "",
              },
              GET_ACCOUNT_WITH_DESCRIPTION_BY_ID_ROW,
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
              accountType: AccountType.CONSUMER,
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
            insertNewUserStatement(
              "user1",
              "username1",
              "random_password",
              "random@example.com",
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
        assertThat(signerMock.password, eq("pass1"), "raw password");
        assertThat(
          (await getUserById(SPANNER_DATABASE, "id1")).length,
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