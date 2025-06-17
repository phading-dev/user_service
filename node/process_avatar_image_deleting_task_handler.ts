import { S3_CLIENT } from "../common/s3_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAvatarImageDeletingTaskStatement,
  deleteAvatarImageFileStatement,
  getAvatarImageDeletingTaskMetadata,
  updateAvatarImageDeletingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { Database } from "@google-cloud/spanner";
import { ProcessAvatarImageDeletingTaskHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ProcessAvatarImageDeletingTaskRequestBody,
  ProcessAvatarImageDeletingTaskResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessAvatarImageDeletingTaskHandler extends ProcessAvatarImageDeletingTaskHandlerInterface {
  public static create(): ProcessAvatarImageDeletingTaskHandler {
    return new ProcessAvatarImageDeletingTaskHandler(
      SPANNER_DATABASE,
      S3_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler = ProcessTaskHandlerWrapper.create(
    this.descriptor,
    5 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

  public constructor(
    private database: Database,
    private s3Client: Ref<S3Client>,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessAvatarImageDeletingTaskRequestBody,
  ): Promise<ProcessAvatarImageDeletingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Avatar image deleting task for account ${body.r2Filename}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessAvatarImageDeletingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAvatarImageDeletingTaskMetadata(transaction, {
        avatarImageDeletingTaskR2FilenameEq: body.r2Filename,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateAvatarImageDeletingTaskMetadataStatement({
          avatarImageDeletingTaskR2FilenameEq: body.r2Filename,
          setRetryCount: task.avatarImageDeletingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.avatarImageDeletingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessAvatarImageDeletingTaskRequestBody,
  ): Promise<void> {
    await this.s3Client.val.send(
      new DeleteObjectsCommand({
        Bucket: ENV_VARS.r2AvatarBucketName,
        Delete: {
          Objects: [
            {
              Key: body.r2Filename,
            },
          ],
        },
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteAvatarImageFileStatement({
          avatarImageFileR2FilenameEq: body.r2Filename,
        }),
        deleteAvatarImageDeletingTaskStatement({
          avatarImageDeletingTaskR2FilenameEq: body.r2Filename,
        }),
      ]);
      await transaction.commit();
    });
  }
}
