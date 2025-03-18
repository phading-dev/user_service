import "../../local/env";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  GET_USER_ROW,
  deleteAccountStatement,
  deleteUserStatement,
  getAccount,
  getUser,
  insertUserStatement,
} from "../../db/sql";
import { CreateAccountHandler } from "./create_account_handler";
import { MAX_ACCOUNTS_PER_USER } from "@phading/constants/account";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { CREATE_ACCOUNT_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
  FETCH_SESSION_AND_CHECK_CAPABILITY,
  FetchSessionAndCheckCapabilityResponse,
} from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "CreateAccountHandlerTest",
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
              totalAccounts: 1,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new (class extends NodeServiceClientMock {
          public async send(request: any): Promise<any> {
            if (request.descriptor === FETCH_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as FetchSessionAndCheckCapabilityResponse;
            } else if (request.descriptor === CREATE_SESSION) {
              this.request = request;
              return {
                signedSession: "session2",
              } as CreateSessionResponse;
            } else {
              throw new Error("Not unhandled.");
            }
          }
        })();
        let handler = new CreateAccountHandler(
          SPANNER_DATABASE,
          clientMock,
          () => "account2",
          () => 1000,
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            contactEmail: "contact@example.com",
            naturalName: "name2",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getUser(SPANNER_DATABASE, {
            userUserIdEq: "user1",
          }),
          isArray([
            eqMessage(
              {
                userUserId: "user1",
                userUsername: "username1",
                userTotalAccounts: 2,
              },
              GET_USER_ROW,
            ),
          ]),
          "user",
        );
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account2",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account2",
                accountNaturalName: "name2",
                accountDescription: "",
                accountContactEmail: "contact@example.com",
                accountAvatarSmallFilename:
                  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                accountAvatarLargeFilename:
                  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                accountCreatedTimeMs: 1000,
                accountLastAccessedTimeMs: 1000,
                accountCapabilitiesVersion: 0,
                accountBillingAccountStateVersion: 0,
                accountBillingAccountState: BillingAccountState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account2",
              capabilitiesVersion: 0,
              capabilities: {
                canConsume: true,
                canPublish: true,
                canBeBilled: true,
                canEarn: true,
              },
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
            CREATE_ACCOUNT_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "TooManyAccounts",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUserStatement({
              userId: "user1",
              username: "username1",
              totalAccounts: MAX_ACCOUNTS_PER_USER,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new (class extends NodeServiceClientMock {
          public async send(request: any): Promise<any> {
            if (request.descriptor === FETCH_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as FetchSessionAndCheckCapabilityResponse;
            } else {
              throw new Error("Not unhandled.");
            }
          }
        })();
        let handler = new CreateAccountHandler(
          SPANNER_DATABASE,
          clientMock,
          () => "account2",
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              contactEmail: "contact@example.com",
              naturalName: "name2",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              "User user1 has reached the maximum number of accounts",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
