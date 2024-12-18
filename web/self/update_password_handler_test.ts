import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_USER_BY_ID_ROW,
  deleteUserStatement,
  getUserById,
  insertNewUserStatement,
} from "../../db/sql";
import { UpdatePasswordHandler } from "./update_password_handler";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError, newNotFoundError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdatePasswordHandlerTest",
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
        let signerMock = new (class extends PasswordSignerMock {
          public sign(password: string): string {
            if (password === "current_pass") {
              return "signed_current_pass";
            } else if (password === "new_pass") {
              return "signed_new_pass";
            } else {
              throw new Error("Not handled");
            }
          }
        })();
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdatePasswordHandler(
          SPANNER_DATABASE,
          signerMock,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            currentPassword: "current_pass",
            newPassword: "new_pass",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getUserById(SPANNER_DATABASE, "user1"),
          isArray([
            eqMessage(
              {
                userUsername: "username1",
                userPasswordHashV1: "signed_new_pass",
                userRecoveryEmail: "email",
              },
              GET_USER_BY_ID_ROW,
            ),
          ]),
          "user",
        );
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
          userId: "user1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdatePasswordHandler(
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
              newPassword: "new_pass",
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
            insertNewUserStatement(
              "user1",
              "username1",
              "signed_current_pass",
              "email",
            ),
          ]);
          await transaction.commit();
        });
        let signerMock = new (class extends PasswordSignerMock {
          public sign(password: string): string {
            if (password === "current_pass") {
              return "incorrect_signed_current_pass";
            } else {
              throw new Error("Not handled");
            }
          }
        })();
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userId: "user1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdatePasswordHandler(
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
              newPassword: "new_pass",
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
