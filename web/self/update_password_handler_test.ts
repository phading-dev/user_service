import "../../local/env";
import { PasswordSignerMock } from "../../common/password_signer_mock";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_USER_ROW,
  deleteUserStatement,
  getUser,
  insertUserStatement,
} from "../../db/sql";
import { UpdatePasswordHandler } from "./update_password_handler";
import { UPDATE_PASSWORD_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, isArray } from "@selfage/test_matcher";
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
            insertUserStatement({
              userId: "user1",
              userEmail: "user@example.com",
              passwordHashV1: "signed_current_pass",
            }),
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
        } as FetchSessionAndCheckCapabilityResponse;
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
          await getUser(SPANNER_DATABASE, { userUserIdEq: "user1" }),
          isArray([
            eqMessage(
              {
                userUserId: "user1",
                userUserEmail: "user@example.com",
                userPasswordHashV1: "signed_new_pass",
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
      name: "PasswordNotMatch",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              userEmail: "user@example.com",
              passwordHashV1: "signed_current_pass",
            }),
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
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new UpdatePasswordHandler(
          SPANNER_DATABASE,
          signerMock,
          clientMock,
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            currentPassword: "current_pass",
            newPassword: "new_pass",
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              notAuthenticated: true,
            },
            UPDATE_PASSWORD_RESPONSE,
          ),
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
