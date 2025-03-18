import "../../local/env";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_USER_ROW,
  deleteUserStatement,
  getUser,
  insertUserStatement,
} from "../../db/sql";
import { UpdateRecoveryEmailHandler } from "./update_recovery_email_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError, newNotFoundError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
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
            insertUserStatement({
              userId: "user1",
              username: "username1",
              passwordHashV1: "signed_current_pass",
              recoveryEmail: "email",
            }),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "signed_current_pass";
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as FetchSessionAndCheckCapabilityResponse;
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
        assertThat(
          await getUser(SPANNER_DATABASE, { userUserIdEq: "user1" }),
          isArray([
            eqMessage(
              {
                userUserId: "user1",
                userUsername: "username1",
                userPasswordHashV1: "signed_current_pass",
                userRecoveryEmail: "new_email",
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
            deleteUserStatement({ userUserIdEq: "user1" }),
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
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as FetchSessionAndCheckCapabilityResponse;
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
        assertThat(error, eqHttpError(newNotFoundError("not found")), "error");
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
              username: "username1",
              passwordHashV1: "signed_current_pass",
              recoveryEmail: "email",
            }),
          ]);
          await transaction.commit();
        });
        let signerMock = new PasswordSignerMock();
        signerMock.signed = "incorrect_signed_current_pass";
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as FetchSessionAndCheckCapabilityResponse;
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
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
