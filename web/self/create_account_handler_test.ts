import "../../local/env";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_USER_AND_ACCOUNT_AND_MORE_ROW,
  deleteAccountMoreStatement,
  deleteAccountStatement,
  deleteUserStatement,
  getUserAndAccountAndMore,
  insertUserStatement,
} from "../../db/sql";
import { CreateAccountHandler } from "./create_account_handler";
import { MAX_ACCOUNTS_PER_USER } from "@phading/constants/account";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { CREATE_ACCOUNT_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
  EXCHANGE_SESSION_AND_CHECK_CAPABILITY,
  ExchangeSessionAndCheckCapabilityResponse,
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
            accountType: AccountType.CONSUMER,
            contactEmail: "contact@example.com",
            naturalName: "name2",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getUserAndAccountAndMore(SPANNER_DATABASE, "user1", "account2"),
          isArray([
            eqMessage(
              {
                uData: {
                  userId: "user1",
                  username: "username1",
                  totalAccounts: 2,
                },
                aData: {
                  userId: "user1",
                  accountId: "account2",
                  accountType: AccountType.CONSUMER,
                  naturalName: "name2",
                  contactEmail: "contact@example.com",
                  avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                  avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                  capabilitiesVersion: 0,
                  billingAccountStateInfo: {
                    version: 0,
                    state: BillingAccountState.HEALTHY,
                  },
                },
                amData: {
                  accountId: "account2",
                  description: "",
                },
              },
              GET_USER_AND_ACCOUNT_AND_MORE_ROW,
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
                canConsumeShows: true,
                canPublishShows: false,
                canBeBilled: true,
                canEarn: false,
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
            deleteUserStatement("user1"),
            deleteAccountStatement("account2"),
            deleteAccountMoreStatement("account2"),
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
            if (request.descriptor === EXCHANGE_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as ExchangeSessionAndCheckCapabilityResponse;
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
              accountType: AccountType.CONSUMER,
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
            deleteUserStatement("user1"),
            deleteAccountStatement("account2"),
            deleteAccountMoreStatement("account2"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
