import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteUserStatement,
  getUserById,
  insertNewUserStatement,
} from "../../db/sql";
import { UpdateRecoveryEmailHandler } from "./update_recovery_email_handler";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdateRecoveryEmailHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewUserStatement(
              "user1",
              "username1",
              "signed_current_pass",
              "email",
            ),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_current_pass";
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            userId: "user1",
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdateRecoveryEmailHandler(
          SPANNER_DATABASE,
          signerMock,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            currentPassword: "current_pass",
            newEmail: "new_email",
          },
          "session1",
        );

        // Verify
        assertThat(signerMock.password, eq("current_pass"), "current password");
        let [user] = await getUserById(SPANNER_DATABASE, "user1");
        assertThat(user.userRecoveryEmail, eq("new_email"), "new email");
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteUserStatement("user1")]);
          await transaction.commit();
        });
      },
    },
    {
      name: "UserNotFound",
      execute: async () => {
        // Prepare
        let signerMock = new PasswordSignerMock();
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            userId: "user1",
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdateRecoveryEmailHandler(
          SPANNER_DATABASE,
          signerMock,
          clientMock,
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              currentPassword: "current_pass",
              newEmail: "new_email",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(newInternalServerErrorError("not found")),
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
            insertNewUserStatement(
              "user1",
              "username1",
              "signed_current_pass",
              "email",
            ),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "incorrect_signed_current_pass";
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            userId: "user1",
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdateRecoveryEmailHandler(
          SPANNER_DATABASE,
          signerMock,
          clientMock,
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              currentPassword: "current_pass",
              newEmail: "new_email",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(newBadRequestError("Password is incorrect")),
          "error",
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
