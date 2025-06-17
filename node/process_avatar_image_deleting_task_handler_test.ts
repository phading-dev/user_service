import "../local/env";
import { S3_CLIENT, initS3Client } from "../common/s3_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_AVATAR_IMAGE_DELETING_TASK_METADATA_ROW,
  deleteAvatarImageDeletingTaskStatement,
  deleteAvatarImageFileStatement,
  getAvatarImageDeletingTaskMetadata,
  getAvatarImageFile,
  insertAvatarImageDeletingTaskStatement,
  insertAvatarImageFileStatement,
  listPendingAvatarImageDeletingTasks,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { ProcessAvatarImageDeletingTaskHandler } from "./process_avatar_image_deleting_task_handler";
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { createReadStream } from "fs";

TEST_RUNNER.run({
  name: "ProcessAvatarImageDeletingTaskHandlerTest",
  environment: {
    async setUp() {
      await initS3Client();
    },
  },
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await S3_CLIENT.val.send(
          new PutObjectCommand({
            Bucket: ENV_VARS.r2AvatarBucketName,
            Key: "image1",
            Body: createReadStream("test_data/user_image.jpg"),
          }),
        );
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAvatarImageFileStatement({
              r2Filename: "image1",
            }),
            insertAvatarImageDeletingTaskStatement({
              r2Filename: "image1",
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessAvatarImageDeletingTaskHandler(
          SPANNER_DATABASE,
          S3_CLIENT,
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          r2Filename: "image1",
        });

        // Verify
        assertThat(
          (
            await getAvatarImageFile(SPANNER_DATABASE, {
              avatarImageFileR2FilenameEq: "image1",
            })
          ).length,
          eq(0),
          "avatarImageFile",
        );
        assertThat(
          await listPendingAvatarImageDeletingTasks(SPANNER_DATABASE, {
            avatarImageDeletingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "listAvatarImageDeletingTasks",
        );
        assertThat(
          (
            await S3_CLIENT.val.send(
              new ListObjectsV2Command({
                Bucket: ENV_VARS.r2AvatarBucketName,
                Prefix: "image",
              }),
            )
          ).Contents,
          eq(undefined),
          "images",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAvatarImageFileStatement({
              avatarImageFileR2FilenameEq: "image1",
            }),
            deleteAvatarImageDeletingTaskStatement({
              avatarImageDeletingTaskR2FilenameEq: "image1",
            }),
          ]);
          await transaction.commit();
        });
        await S3_CLIENT.val.send(
          new DeleteObjectCommand({
            Bucket: ENV_VARS.r2AvatarBucketName,
            Key: "image1",
          }),
        );
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertAvatarImageDeletingTaskStatement({
              r2Filename: "image1",
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessAvatarImageDeletingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          r2Filename: "image1",
        });

        // Verify
        assertThat(
          await getAvatarImageDeletingTaskMetadata(SPANNER_DATABASE, {
            avatarImageDeletingTaskR2FilenameEq: "image1",
          }),
          isArray([
            eqMessage(
              {
                avatarImageDeletingTaskRetryCount: 1,
                avatarImageDeletingTaskExecutionTimeMs: 301000,
              },
              GET_AVATAR_IMAGE_DELETING_TASK_METADATA_ROW,
            ),
          ]),
          "avatarImageDeletingTask",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteAvatarImageDeletingTaskStatement({
              avatarImageDeletingTaskR2FilenameEq: "image1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
