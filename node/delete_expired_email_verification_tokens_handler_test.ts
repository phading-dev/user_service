import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_EMAIL_VERIFICATION_TOKEN_ROW,
  deleteEmailVerificationTokenStatement,
  getEmailVerificationToken,
  insertEmailVerificationTokenStatement,
} from "../db/sql";
import { DeleteExpiredEmailVerificationTokensHandler } from "./delete_expired_email_verification_tokens_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "DeleteExpiredEmailVerificationTokensHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEmailVerificationTokenStatement({
              tokenId: "token1",
              expiresTimeMs: 100,
            }),
            insertEmailVerificationTokenStatement({
              tokenId: "token2",
              expiresTimeMs: 500,
            }),
            insertEmailVerificationTokenStatement({
              tokenId: "token3",
              expiresTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new DeleteExpiredEmailVerificationTokensHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("test", {});

        // Verify
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token1",
          }),
          isArray([]),
          "token1",
        );
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token2",
          }),
          isArray([]),
          "token2",
        );
        assertThat(
          await getEmailVerificationToken(SPANNER_DATABASE, {
            emailVerificationTokenTokenIdEq: "token3",
          }),
          isArray([
            eqMessage(
              {
                emailVerificationTokenTokenId: "token3",
                emailVerificationTokenExpiresTimeMs: 1000,
              },
              GET_EMAIL_VERIFICATION_TOKEN_ROW,
            ),
          ]),
          "token3",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token1",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token2",
            }),
            deleteEmailVerificationTokenStatement({
              emailVerificationTokenTokenIdEq: "token3",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
