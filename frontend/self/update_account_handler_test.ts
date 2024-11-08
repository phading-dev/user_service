import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  getFullAccountById,
  insertNewAccountStatement,
} from "../../db/sql";
import { UpdateAccountHandler } from "./update_account_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "UpdateAccountHandlerTest",
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
              "email",
              "avatar",
              "avatar",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            accountId: "account1",
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdateAccountHandler(SPANNER_DATABASE, clientMock);

        // Execute
        await handler.handle(
          "",
          {
            naturalName: "name2",
            contactEmail: "contact2@example.com",
            description: "something something",
          },
          "session1",
        );

        // Verify
        let [account] = await getFullAccountById(SPANNER_DATABASE, "account1");
        assertThat(account.accountNaturalName, eq("name2"), "natural name");
        assertThat(
          account.accountDescription,
          eq("something something"),
          "description",
        );
        assertThat(
          account.accountContactEmail,
          eq("contact2@example.com"),
          "contact email",
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
      name: "NoDescription",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewAccountStatement(
              "user1",
              "account1",
              AccountType.CONSUMER,
              "name1",
              "something something",
              "email",
              "avatar",
              "avatar",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            accountId: "account1",
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UpdateAccountHandler(SPANNER_DATABASE, clientMock);

        // Execute
        await handler.handle(
          "",
          {
            naturalName: "name2",
            contactEmail: "contact2@example.com",
          },
          "session1",
        );

        // Verify
        let [account] = await getFullAccountById(SPANNER_DATABASE, "account1");
        assertThat(account.accountNaturalName, eq("name2"), "natural name");
        assertThat(account.accountDescription, eq(""), "empty description");
        assertThat(
          account.accountContactEmail,
          eq("contact2@example.com"),
          "contact email",
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
