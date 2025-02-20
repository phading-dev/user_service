import path from "path";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { S3_CLIENT_PROMISE } from "../../common/s3_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  deleteAccountStatement,
  getAccount,
  insertAccountStatement,
} from "../../db/sql";
import { ENV_VARS } from "../../env";
import { UploadAccountAvatarHandler } from "./upload_account_avatar_handler";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { AccountType } from "@phading/user_service_interface/account_type";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { createReadStream } from "fs";

async function cleanupFiles(files: Array<string>) {
  await (
    await S3_CLIENT_PROMISE
  ).send(
    new DeleteObjectsCommand({
      Bucket: ENV_VARS.accountAvatarR2BucketName,
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
        // Prepar
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
              avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          await S3_CLIENT_PROMISE,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          createReadStream(path.join("test_data", "user_image.jpg")),
          "session1",
        );

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  avatarSmallFilename: "account1s.png",
                  avatarLargeFilename: "account1l.png",
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        let response = await (
          await S3_CLIENT_PROMISE
        ).send(
          new ListObjectsV2Command({
            Bucket: ENV_VARS.accountAvatarR2BucketName,
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
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              accountType: AccountType.CONSUMER,
              avatarSmallFilename: "account1s.png",
              avatarLargeFilename: "account1l.png",
              createdTimeMs: 1000,
              lastAccessedTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          await S3_CLIENT_PROMISE,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          createReadStream(path.join("test_data", "user_image.jpg")),
          "session1",
        );

        // Verify
        assertThat(
          await getAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                accountData: {
                  userId: "user1",
                  accountId: "account1",
                  accountType: AccountType.CONSUMER,
                  avatarSmallFilename: "account1s.png",
                  avatarLargeFilename: "account1l.png",
                  createdTimeMs: 1000,
                  lastAccessedTimeMs: 1000,
                },
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        let response = await (
          await S3_CLIENT_PROMISE
        ).send(
          new ListObjectsV2Command({
            Bucket: ENV_VARS.accountAvatarR2BucketName,
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
