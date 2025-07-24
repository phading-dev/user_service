import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PASSWORD_RESET_TOKEN_ROW,
  deletePasswordResetTokenStatement,
  getPasswordResetToken,
  insertPasswordResetTokenStatement,
} from "../db/sql";
import { DeleteExpiredPasswordResetTokensHandler } from "./delete_expired_password_reset_tokens_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "DeleteExpiredPasswordResetTokensHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPasswordResetTokenStatement({
              tokenId: "token1",
              expiresTimeMs: 100,
            }),
            insertPasswordResetTokenStatement({
              tokenId: "token2",
              expiresTimeMs: 500,
            }),
            insertPasswordResetTokenStatement({
              tokenId: "token3",
              expiresTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new DeleteExpiredPasswordResetTokensHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("test", {});

        // Verify
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token1",
          }),
          isArray([]),
          "token1",
        );
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token2",
          }),
          isArray([]),
          "token2",
        );
        assertThat(
          await getPasswordResetToken(SPANNER_DATABASE, {
            passwordResetTokenTokenIdEq: "token3",
          }),
          isArray([
            eqMessage(
              {
                passwordResetTokenTokenId: "token3",
                passwordResetTokenExpiresTimeMs: 1000,
              },
              GET_PASSWORD_RESET_TOKEN_ROW,
            ),
          ]),
          "token3",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token1",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token2",
            }),
            deletePasswordResetTokenStatement({
              passwordResetTokenTokenIdEq: "token3",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
