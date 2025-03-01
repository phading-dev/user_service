import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { deleteAccountStatement, insertAccountStatement } from "../db/sql";
import { GetAccountSummaryHandler } from "./get_account_summary_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { GET_ACCOUNT_SUMMARY_RESPONSE } from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertReject, assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetAccountSummaryHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              naturalName: "name1",
              avatarSmallFilename: "avatarS",
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new GetAccountSummaryHandler(
          SPANNER_DATABASE,
          "https://custom.domain/",
        );

        // Execute
        let response = await handler.handle("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              account: {
                accountId: "account1",
                naturalName: "name1",
                avatarSmallUrl: "https://custom.domain/avatarS",
              },
            },
            GET_ACCOUNT_SUMMARY_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountNotFound",
      execute: async () => {
        // Prepare
        let handler = new GetAccountSummaryHandler(
          SPANNER_DATABASE,
          "https://custom.domain/",
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(newBadRequestError("not found")),
          "error",
        );
      },
      tearDown: async () => {},
    },
  ],
});
