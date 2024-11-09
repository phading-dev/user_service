import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { deleteAccountStatement, getFullAccountById } from "../../db/sql";
import { CreateAccountHandler } from "./create_account_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { CREATE_ACCOUNT_RESPONSE } from "@phading/user_service_interface/frontend/self/interface";
import {
  CREATE_SESSION,
  CREATE_SESSION_REQUEST_BODY,
  CreateSessionResponse,
  EXCHANGE_SESSION_AND_CHECK_CAPABILITY,
  ExchangeSessionAndCheckCapabilityResponse,
} from "@phading/user_session_service_interface/backend/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "CreateAccountHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
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
        let [account] = await getFullAccountById(SPANNER_DATABASE, "account2");
        assertThat(account.accountUserId, eq("user1"), "associated user id");
        assertThat(
          account.accountAccountType,
          eq(AccountType.CONSUMER),
          "account type",
        );
        assertThat(account.accountNaturalName, eq("name2"), "natural name");
        assertThat(
          account.accountContactEmail,
          eq("contact@example.com"),
          "contact email",
        );
        assertThat(
          account.accountAvatarSmallFilename,
          eq(DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME),
          "small avatar filename",
        );
        assertThat(
          account.accountAvatarLargeFilename,
          eq(DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME),
          "large avatar filename",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              userId: "user1",
              accountId: "account2",
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
            CREATE_ACCOUNT_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account2")]);
          await transaction.commit();
        });
      },
    },
  ],
});
