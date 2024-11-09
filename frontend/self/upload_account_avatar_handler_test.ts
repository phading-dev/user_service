import path from "path";
import { StorageFake } from "../../common/cloud_storage_fake";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  getAccountById,
  insertNewAccountStatement,
} from "../../db/sql";
import { UploadAccountAvatarHandler } from "./upload_account_avatar_handler";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { createReadStream, existsSync, unlinkSync } from "fs";

async function cleaUpFile(filePath: string) {
  try {
    unlinkSync(filePath);
  } catch (e) {}
}

TEST_RUNNER.run({
  name: "UploadAccountAvatarHandlerTest",
  cases: [
    {
      name: "FirstTimeUpload",
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
              "contact1",
              DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
              DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          new StorageFake() as any,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          createReadStream(path.join("test_data", "user_image.jpg")),
          "session1",
        );

        // Verify
        let [account] = await getAccountById(SPANNER_DATABASE, "account1");
        assertThat(
          account.accountAvatarSmallFilename,
          eq("account1s.png"),
          "avatar small filename",
        );
        assertThat(
          account.accountAvatarLargeFilename,
          eq("account1l.png"),
          "avatar large filename",
        );
        assertThat(
          existsSync(path.join("test_data", "account1s.png")),
          eq(true),
          "small avatar exists",
        );
        assertThat(
          existsSync(path.join("test_data", "account1l.png")),
          eq(true),
          "large avatar exists",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
        cleaUpFile(path.join("test_data", "account1s.png"));
        cleaUpFile(path.join("test_data", "account1l.png"));
      },
    },
    {
      name: "OverrideUpload",
      execute: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertNewAccountStatement(
              "user1",
              "account1",
              AccountType.CONSUMER,
              "name1",
              "",
              "contact1",
              "account1s.png",
              "account1l.png",
              1000,
              1000,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          new StorageFake() as any,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          createReadStream(path.join("test_data", "user_image.jpg")),
          "session1",
        );

        // Verify
        let [account] = await getAccountById(SPANNER_DATABASE, "account1");
        assertThat(
          account.accountAvatarSmallFilename,
          eq("account1s.png"),
          "avatar small filename",
        );
        assertThat(
          account.accountAvatarLargeFilename,
          eq("account1l.png"),
          "avatar large filename",
        );
        assertThat(
          existsSync(path.join("test_data", "account1s.png")),
          eq(true),
          "small avatar exists",
        );
        assertThat(
          existsSync(path.join("test_data", "account1l.png")),
          eq(true),
          "large avatar exists",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
        cleaUpFile(path.join("test_data", "account1s.png"));
        cleaUpFile(path.join("test_data", "account1l.png"));
      },
    },
  ],
});
