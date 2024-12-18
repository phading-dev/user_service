import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  insertNewAccountStatement,
} from "../../db/sql";
import { SwitchAccountHandler } from "./switch_account_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { SWITCH_ACCOUNT_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
  EXCHANGE_SESSION_AND_CHECK_CAPABILITY,
  ExchangeSessionAndCheckCapabilityResponse,
} from "@phading/user_session_service_interface/node/interface";
import { newForbiddenError, newNotFoundError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SwitchAccountHandlerTest",
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
              {
                naturalName: "name1",
                contactEmail: "email",
                avatarSmallFilename: "avatar",
                avatarLargeFilename: "avatar",
              },
              "",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new (class extends NodeServiceClientMock {
          public async send(request: any): Promise<any> {
            if (request.descriptor === EXCHANGE_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as ExchangeSessionAndCheckCapabilityResponse;
            } else if (request.descriptor === CREATE_SESSION) {
              this.request = request;
              return {
                signedSession: "session2",
              } as CreateSessionResponse;
            } else {
              throw new Error("Not handled");
            }
          }
        })();
        let handler = new SwitchAccountHandler(SPANNER_DATABASE, clientMock);

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
          clientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
            },
            CREATE_SESSION_REQUEST_BODY,
          ),
          "create session request",
        );
        assertThat(
          response,
          eqMessage(
            {
              signedSession: "session2",
            },
            SWITCH_ACCOUNT_RESPONSE,
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
        let clientMock = new (class extends NodeServiceClientMock {
          public async send(request: any): Promise<any> {
            if (request.descriptor === EXCHANGE_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as ExchangeSessionAndCheckCapabilityResponse;
            } else {
              throw new Error("Not handled");
            }
          }
        })();
        let handler = new SwitchAccountHandler(SPANNER_DATABASE, clientMock);

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
          eqHttpError(newNotFoundError("Account account1 is not found")),
          "error",
        );
      },
      tearDown: async () => {},
    },
    {
      name: "AccountNotOwned",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewAccountStatement(
              "user2",
              "account1",
              AccountType.CONSUMER,
              {
                naturalName: "name1",
                contactEmail: "email",
                avatarSmallFilename: "avatar",
                avatarLargeFilename: "avatar",
              },
              "",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new (class extends NodeServiceClientMock {
          public async send(request: any): Promise<any> {
            if (request.descriptor === EXCHANGE_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as ExchangeSessionAndCheckCapabilityResponse;
            } else {
              throw new Error("Not handled");
            }
          }
        })();
        let handler = new SwitchAccountHandler(SPANNER_DATABASE, clientMock);

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
          eqHttpError(newForbiddenError("owned by a different user")),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
      },
    },
  ],
});
