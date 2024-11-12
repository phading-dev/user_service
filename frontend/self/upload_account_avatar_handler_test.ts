import path from "path";
import { ACCOUNT_AVATAR_BUCKET_NAME } from "../../common/env_vars";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { R2_CLIENT } from "../../common/r2_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAccountStatement,
  getAccountById,
  insertNewAccountStatement,
} from "../../db/sql";
import { UploadAccountAvatarHandler } from "./upload_account_avatar_handler";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { createReadStream } from "fs";

async function cleanupFiles(files: Array<string>) {
  await R2_CLIENT.send(
    new DeleteObjectsCommand({
      Bucket: ACCOUNT_AVATAR_BUCKET_NAME,
      Delete: {
        Objects: files.map((file) => {
          return {
            Key: file,
          };
        }),
        Quiet: true,
      },
    }),
  );
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
          R2_CLIENT,
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
        let response = await R2_CLIENT.send(
          new ListObjectsV2Command({
            Bucket: ACCOUNT_AVATAR_BUCKET_NAME,
          }),
        );
        assertThat(response.Contents.length, eq(2), "number of avatars");
        assertThat(
          response.Contents[0].Key,
          eq("account1l.png"),
          "large avatar exists",
        );
        assertThat(
          response.Contents[1].Key,
          eq("account1s.png"),
          "small avatar exists",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
        await cleanupFiles(["account1l.png", "account1s.png"]);
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
          R2_CLIENT,
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
        let response = await R2_CLIENT.send(
          new ListObjectsV2Command({
            Bucket: ACCOUNT_AVATAR_BUCKET_NAME,
          }),
        );
        assertThat(response.Contents.length, eq(2), "number of avatars");
        assertThat(
          response.Contents[0].Key,
          eq("account1l.png"),
          "large avatar exists",
        );
        assertThat(
          response.Contents[1].Key,
          eq("account1s.png"),
          "small avatar exists",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteAccountStatement("account1")]);
          await transaction.commit();
        });
        await cleanupFiles(["account1l.png", "account1s.png"]);
      },
    },
  ],
});
