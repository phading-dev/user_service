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
  GET_AVATAR_IMAGE_DELETING_TASK_ROW,
  deleteAccountStatement,
  deleteAvatarImageDeletingTaskStatement,
  deleteAvatarImageFileStatement,
  getAccount,
  getAvatarImageDeletingTask,
  getAvatarImageFile,
  insertAccountStatement,
  listPendingAvatarImageDeletingTasks,
} from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { UploadAccountAvatarHandler } from "./upload_account_avatar_handler";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { createReadStream } from "fs";

let ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteAccountStatement({ accountAccountIdEq: "account1" }),
      deleteAvatarImageFileStatement({
        avatarImageFileR2FilenameEq: "uuid0",
      }),
      deleteAvatarImageFileStatement({
        avatarImageFileR2FilenameEq: "uuid1",
      }),
      deleteAvatarImageDeletingTaskStatement({
        avatarImageDeletingTaskR2FilenameEq: "uuid0",
      }),
      deleteAvatarImageDeletingTaskStatement({
        avatarImageDeletingTaskR2FilenameEq: "uuid1",
      }),
      deleteAvatarImageDeletingTaskStatement({
        avatarImageDeletingTaskR2FilenameEq: "avatars.png",
      }),
      deleteAvatarImageDeletingTaskStatement({
        avatarImageDeletingTaskR2FilenameEq: "avatarl.png",
      }),
    ]);
    await transaction.commit();
  });
  await S3_CLIENT.val.send(
    new DeleteObjectsCommand({
      Bucket: ENV_VARS.r2AvatarBucketName,
      Delete: {
        Objects: [
          {
            Key: "uuid0",
          },
          {
            Key: "uuid1",
          },
        ],
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
      name: "FirstTimeUpload_Stalled_Success",
      execute: async () => {
        // Prepar
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
              avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
              createdTimeMs: 0,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let id = 0;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
          clientMock,
          () => 1000,
          () => `uuid${id++}`,
        );
        let stallResolveFn: () => void;
        let firstEncounterPromise = new Promise<void>((resolve1) => {
          handler.interfereFn = async () => {
            resolve1();
            await new Promise<void>((resolve2) => {
              stallResolveFn = resolve2;
            });
          };
        });

        // Execute
        let responsePromise = handler.handle(
          "",
          createReadStream(path.join("test_data", "user_image.jpg")),
          "session1",
        );
        await firstEncounterPromise;

        // Verify
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "uuid0",
            })
          ).length,
          eq(1),
          "avatarImageFile small",
        );
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "uuid1",
            })
          ).length,
          eq(1),
          "avatarImageFile large",
        );
        assertThat(
          await getAvatarImageDeletingTask(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskR2Filename: "uuid0",
                avatarImageDeletingTaskRetryCount: 0,
                avatarImageDeletingTaskExecutionTimeMs: 1000 + ONE_YEAR_MS,
                avatarImageDeletingTaskCreatedTimeMs: 1000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_ROW,
            ),
          ]),
          "avatarImageDeletingTasks",
        );
        assertThat(
          await getAvatarImageDeletingTask(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "uuid1",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskR2Filename: "uuid1",
                avatarImageDeletingTaskRetryCount: 0,
                avatarImageDeletingTaskExecutionTimeMs: 1000 + ONE_YEAR_MS,
                avatarImageDeletingTaskCreatedTimeMs: 1000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_ROW,
            ),
          ]),
          "avatarImageDeletingTasks",
        );

        // Execute
        stallResolveFn();
        await responsePromise;

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
                accountAvatarSmallFilename: "uuid0",
                accountAvatarLargeFilename: "uuid1",
                accountCreatedTimeMs: 0,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await listPendingAvatarImageDeletingTasks(SPANNER_DATABASE, {
            avatarImageDeletingTaskExecutionTimeMsLe: 2000 + ONE_YEAR_MS,
          }),
          isArray([]),
          "avatarImageDeletingTasks",
        );
        let response = await S3_CLIENT.val.send(
          new ListObjectsV2Command({
            Bucket: ENV_VARS.r2AvatarBucketName,
          }),
        );
        assertThat(response.Contents.length, eq(2), "number of avatars");
        assertThat(
          response.Contents[0].Key,
          eq("uuid0"),
          "small avatar exists",
        );
        assertThat(
          response.Contents[1].Key,
          eq("uuid1"),
          "large avatar exists",
        );
      },
      tearDown: async () => {
        await cleanupAll();
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
              avatarSmallFilename: "avatars.png",
              avatarLargeFilename: "avatarl.png",
              createdTimeMs: 0,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let id = 0;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
          clientMock,
          () => 1000,
          () => `uuid${id++}`,
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
                accountAvatarSmallFilename: "uuid0",
                accountAvatarLargeFilename: "uuid1",
                accountCreatedTimeMs: 0,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "uuid0",
            })
          ).length,
          eq(1),
          "avatarImageFile small",
        );
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "uuid1",
            })
          ).length,
          eq(1),
          "avatarImageFile large",
        );
        assertThat(
          await getAvatarImageDeletingTask(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "avatars.png",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskR2Filename: "avatars.png",
                avatarImageDeletingTaskRetryCount: 0,
                avatarImageDeletingTaskExecutionTimeMs: 1000,
                avatarImageDeletingTaskCreatedTimeMs: 1000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_ROW,
            ),
          ]),
          "avatarImageDeletingTasks for old small avatar",
        );
        assertThat(
          await getAvatarImageDeletingTask(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "avatarl.png",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskR2Filename: "avatarl.png",
                avatarImageDeletingTaskRetryCount: 0,
                avatarImageDeletingTaskExecutionTimeMs: 1000,
                avatarImageDeletingTaskCreatedTimeMs: 1000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_ROW,
            ),
          ]),
          "avatarImageDeletingTasks for old large avatar",
        );
        let response = await S3_CLIENT.val.send(
          new ListObjectsV2Command({
            Bucket: ENV_VARS.r2AvatarBucketName,
          }),
        );
        assertThat(response.Contents.length, eq(2), "number of avatars");
        assertThat(
          response.Contents[0].Key,
          eq("uuid0"),
          "small avatar exists",
        );
        assertThat(
          response.Contents[1].Key,
          eq("uuid1"),
          "large avatar exists",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "NonImageFileUploadAndCleanup",
      execute: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAccountStatement({
              userId: "user1",
              accountId: "account1",
              avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
              avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
              createdTimeMs: 0,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let id = 0;
        let handler = new UploadAccountAvatarHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
          clientMock,
          () => 1000,
          () => `uuid${id++}`,
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
        assertThat(error.name, eq("AbortError"), "error");
        assertThat(
          await getAccount(SPANNER_DATABASE, {
            accountAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                accountUserId: "user1",
                accountAccountId: "account1",
                accountAvatarSmallFilename:
                  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
                accountAvatarLargeFilename:
                  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
                accountCreatedTimeMs: 0,
              },
              GET_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "uuid0",
            })
          ).length,
          eq(1),
          "avatarImageFile small",
        );
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "uuid1",
            })
          ).length,
          eq(1),
          "avatarImageFile large",
        );
        assertThat(
          await getAvatarImageDeletingTask(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskR2Filename: "uuid0",
                avatarImageDeletingTaskRetryCount: 0,
                avatarImageDeletingTaskExecutionTimeMs: 301000,
                avatarImageDeletingTaskCreatedTimeMs: 1000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_ROW,
            ),
          ]),
          "avatarImageDeletingTasks for small avatar",
        );
        assertThat(
          await getAvatarImageDeletingTask(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "uuid1",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskR2Filename: "uuid1",
                avatarImageDeletingTaskRetryCount: 0,
                avatarImageDeletingTaskExecutionTimeMs: 301000,
                avatarImageDeletingTaskCreatedTimeMs: 1000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_ROW,
            ),
          ]),
          "avatarImageDeletingTasks for large avatar",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
