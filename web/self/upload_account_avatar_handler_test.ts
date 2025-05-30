import "../../local/env";
import path from "path";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/constants";
import { S3_CLIENT, initS3Client } from "../../common/s3_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_ACCOUNT_ROW,
  deleteAccountStatement,
  getAccount,
  insertAccountStatement,
} from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { UploadAccountAvatarHandler } from "./upload_account_avatar_handler";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { createReadStream } from "fs";

async function cleanupFiles(files: Array<string>) {
  await S3_CLIENT.val.send(
    new DeleteObjectsCommand({
      Bucket: ENV_VARS.r2AvatarBucketName,
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
  environment: {
    async setUp() {
      await initS3Client();
    },
  },
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
              avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
              avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
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
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountAvatarSmallFilename: "account1s.png",
                accountAvatarLargeFilename: "account1l.png",
                accountCreatedTimeMs: 1000,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        let response = await S3_CLIENT.val.send(
          new ListObjectsV2Command({
            Bucket: ENV_VARS.r2AvatarBucketName,
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
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
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
              avatarSmallFilename: "account1s.png",
              avatarLargeFilename: "account1l.png",
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
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
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountAvatarSmallFilename: "account1s.png",
                accountAvatarLargeFilename: "account1l.png",
                accountCreatedTimeMs: 1000,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        let response = await S3_CLIENT.val.send(
          new ListObjectsV2Command({
            Bucket: ENV_VARS.r2AvatarBucketName,
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
          await transaction.batchUpdate([
            deleteAccountStatement({ accountAccountIdEq: "account1" }),
          ]);
          await transaction.commit();
        });
        await cleanupFiles(["account1l.png", "account1s.png"]);
      },
    },
    {
      name: "NonImageFileUpload",
      execute: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              avatarSmallFilename: "account1s.png",
              avatarLargeFilename: "account1l.png",
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
          clientMock,
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            createReadStream(path.join("test_data", "non_image.txt")),
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqError(new Error("Input buffer contains unsupported image format")),
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
