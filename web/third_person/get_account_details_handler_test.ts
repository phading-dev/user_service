import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { deleteAccountStatement, insertAccountStatement } from "../../db/sql";
import { GetAccountDetailsHandler } from "./get_account_details_handler";
import { GET_ACCOUNT_DETAILS_RESPONSE } from "@phading/user_service_interface/web/third_person/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertReject, assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetAccountDetailsHandlerTest",
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
              name: "name1",
              avatarLargeFilename: "avatarL",
              description: "Some some long long description",
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new GetAccountDetailsHandler(
          SPANNER_DATABASE,
          "https://custom.domain",
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
                name: "name1",
                avatarLargeUrl: "https://custom.domain/avatarL",
                description: "Some some long long description",
              },
            },
            GET_ACCOUNT_DETAILS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountNotFound",
      execute: async () => {
        // Prepare
        let handler = new GetAccountDetailsHandler(
          SPANNER_DATABASE,
          "https://custom.domain",
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
