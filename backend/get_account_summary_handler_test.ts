import { StorageFake } from "../common/cloud_storage_fake";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { deleteAccountStatement, insertNewAccountStatement } from "../db/sql";
import { GetAccountSummaryHandler } from "./get_account_summary_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { GET_ACCOUNT_SUMMARY_RESPONSE } from "@phading/user_service_interface/backend/interface";
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
            insertNewAccountStatement(
              "user1",
              "account1",
              AccountType.CONSUMER,
              "name1",
              "",
              "contact",
              "avatarS",
              "avatarL",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new GetAccountSummaryHandler(
          SPANNER_DATABASE,
          new StorageFake() as any,
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
                avatarSmallUrl: "avatarS",
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
          new StorageFake() as any,
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
