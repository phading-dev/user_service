import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  deleteUserStatement,
  getFullAccountById,
  getUserById,
  insertNewUserStatement,
} from "../../db/sql";
import { SignUpHandler } from "./sign_up_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { SIGN_UP_RESPONSE } from "@phading/user_service_interface/frontend/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
} from "@phading/user_session_service_interface/backend/interface";
import { newConflictError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, eq } from "@selfage/test_matcher";
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
        let [user] = await getUserById(SPANNER_DATABASE, "id1");
        assertThat(user.userUsername, eq("username1"), "username");
        assertThat(user.userPasswordHashV1, eq("signed_password"), "password");
        assertThat(
          user.userRecoveryEmail,
          eq("recovery@example.com"),
          "recovery email",
        );
        let [account] = await getFullAccountById(SPANNER_DATABASE, "id2");
        assertThat(account.accountUserId, eq("id1"), "associated user id");
        assertThat(
          account.accountAccountType,
          eq(AccountType.CONSUMER),
          "account type",
        );
        assertThat(
          account.accountNaturalName,
          eq("first second"),
          "natural name",
        );
        assertThat(
          account.accountContactEmail,
          eq("contact@example.com"),
          "contact email",
        );
        assertThat(
          account.accountAvatarSmallFilename,
          eq(DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME),
          "small avatar filename",
        );
        assertThat(
          account.accountAvatarLargeFilename,
          eq(DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME),
          "large avatar filename",
        );
        assertThat(
          response,
          eqMessage(
            {
              signedSession: "session1",
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
        let error = await assertReject(
          handler.handle("", {
            username: "username1",
            password: "pass1",
            recoveryEmail: "recovery@example.com",
            naturalName: "first second",
            accountType: AccountType.CONSUMER,
            contactEmail: "contact@example.com",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(newConflictError("not available")),
          "error",
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
