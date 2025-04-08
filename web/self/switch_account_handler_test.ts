import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  deleteAccountStatement,
  getAccount,
  insertAccountStatement,
} from "../../db/sql";
import { SwitchAccountHandler } from "./switch_account_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import { SWITCH_ACCOUNT_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
  FETCH_SESSION_AND_CHECK_CAPABILITY,
  FetchSessionAndCheckCapabilityResponse,
} from "@phading/user_session_service_interface/node/interface";
import { newForbiddenError, newNotFoundError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, isArray } from "@selfage/test_matcher";
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
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              capabilitiesVersion: 0,
              paymentProfileState: PaymentProfileState.HEALTHY,
              lastAccessedTimeMs: 1000,
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
              throw new Error("Not handled");
            }
          }
        })();
        let handler = new SwitchAccountHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 2000,
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
              signedSession: "session2",
            },
            SWITCH_ACCOUNT_RESPONSE,
          ),
          "response",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account1",
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
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountAccountType: AccountType.CONSUMER,
                accountCapabilitiesVersion: 0,
                accountPaymentProfileState: PaymentProfileState.HEALTHY,
                accountLastAccessedTimeMs: 2000,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
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
        let clientMock = new (class extends NodeServiceClientMock {
          public async send(request: any): Promise<any> {
            if (request.descriptor === FETCH_SESSION_AND_CHECK_CAPABILITY) {
              return {
                userId: "user1",
              } as FetchSessionAndCheckCapabilityResponse;
            } else {
              throw new Error("Not handled");
            }
          }
        })();
        let handler = new SwitchAccountHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 2000,
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
            insertAccountStatement({
              userId: "user2",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              lastAccessedTimeMs: 1000,
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
              throw new Error("Not handled");
            }
          }
        })();
        let handler = new SwitchAccountHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 2000,
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
          eqHttpError(newForbiddenError("owned by a different user")),
          "error",
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
  ],
});
