import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { deleteAccountStatement, insertAccountStatement } from "../../db/sql";
import { GetAccountSummaryHandler } from "./get_account_summary_handler";
import { GET_ACCOUNT_SUMMARY_RESPONSE } from "@phading/user_service_interface/web/third_person/interface";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
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
              naturalName: "name1",
              avatarSmallFilename: "avatarS",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {} as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountSummaryHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain",
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            accountId: "account1",
          },
          "session1",
        );

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
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetAccountSummaryHandler(
          SPANNER_DATABASE,
          clientMock,
          "https://custom.domain",
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              accountId: "account1",
            },
            "session1",
          ),
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
