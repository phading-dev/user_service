import "../../local/env";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/constants";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  GET_BILLING_PROFILE_CREATING_TASK_ROW,
  GET_EARNINGS_PROFILE_CREATING_TASK_ROW,
  GET_USER_ROW,
  deleteAccountStatement,
  deleteBillingProfileCreatingTaskStatement,
  deleteEarningsProfileCreatingTaskStatement,
  deleteUserStatement,
  getAccount,
  getBillingProfileCreatingTask,
  getEarningsProfileCreatingTask,
  getUser,
  insertUserStatement,
} from "../../db/sql";
import { CreateAccountHandler } from "./create_account_handler";
import { MAX_ACCOUNTS_PER_USER } from "@phading/constants/account";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
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
      name: "CreateConsumer",
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
            accountType: AccountType.CONSUMER,
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
                accountAccountType: AccountType.CONSUMER,
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
                accountBillingProfileStateVersion: 0,
                accountBillingProfileState: BillingProfileState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getBillingProfileCreatingTask(SPANNER_DATABASE, {
            billingProfileCreatingTaskAccountIdEq: "account2",
          }),
          isArray([
            eqMessage(
              {
                billingProfileCreatingTaskAccountId: "account2",
                billingProfileCreatingTaskRetryCount: 0,
                billingProfileCreatingTaskExecutionTimeMs: 1000,
                billingProfileCreatingTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "billing profile creating task",
        );
        assertThat(
          await getEarningsProfileCreatingTask(SPANNER_DATABASE, {
            earningsProfileCreatingTaskAccountIdEq: "account2",
          }),
          isArray([]),
          "earnings profile creating task",
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
                canPublish: false,
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
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
            deleteBillingProfileCreatingTaskStatement({
              billingProfileCreatingTaskAccountIdEq: "account2",
            }),
            deleteEarningsProfileCreatingTaskStatement({
              earningsProfileCreatingTaskAccountIdEq: "account2",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "CreatePublisher",
      execute: async () => {
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
            accountType: AccountType.PUBLISHER,
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
                accountAccountType: AccountType.PUBLISHER,
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
                accountBillingProfileStateVersion: 0,
                accountBillingProfileState: BillingProfileState.HEALTHY,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getBillingProfileCreatingTask(SPANNER_DATABASE, {
            billingProfileCreatingTaskAccountIdEq: "account2",
          }),
          isArray([
            eqMessage(
              {
                billingProfileCreatingTaskAccountId: "account2",
                billingProfileCreatingTaskRetryCount: 0,
                billingProfileCreatingTaskExecutionTimeMs: 1000,
                billingProfileCreatingTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "billing profile creating task",
        );
        assertThat(
          await getEarningsProfileCreatingTask(SPANNER_DATABASE, {
            earningsProfileCreatingTaskAccountIdEq: "account2",
          }),
          isArray([
            eqMessage(
              {
                earningsProfileCreatingTaskAccountId: "account2",
                earningsProfileCreatingTaskRetryCount: 0,
                earningsProfileCreatingTaskExecutionTimeMs: 1000,
                earningsProfileCreatingTaskCreatedTimeMs: 1000,
              },
              GET_EARNINGS_PROFILE_CREATING_TASK_ROW,
            ),
          ]),
          "earnings profile creating task",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account2",
              capabilitiesVersion: 0,
              capabilities: {
                canConsume: false,
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
            deleteBillingProfileCreatingTaskStatement({
              billingProfileCreatingTaskAccountIdEq: "account2",
            }),
            deleteEarningsProfileCreatingTaskStatement({
              earningsProfileCreatingTaskAccountIdEq: "account2",
            }),
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
            deleteUserStatement({ userUserIdEq: "user1" }),
            deleteAccountStatement({ accountAccountIdEq: "account2" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
