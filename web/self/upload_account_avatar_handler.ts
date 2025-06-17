import crypto = require("crypto");
import getStream = require("get-stream");
import sharp = require("sharp");
import stream = require("stream");
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/constants";
import { S3_CLIENT } from "../../common/s3_client";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteAvatarImageDeletingTaskStatement,
  getAccountMain,
  insertAvatarImageDeletingTaskStatement,
  insertAvatarImageFileStatement,
  updateAccountAvatarStatement,
  updateAvatarImageDeletingTaskMetadataStatement,
} from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Database } from "@google-cloud/spanner";
import {
  LARGE_AVATAR_SIZE,
  MAX_AVATAR_SIZE,
  SMALL_AVATAR_SIZE,
} from "@phading/constants/account";
import { UploadAccountAvatarHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import { UploadAccountAvatarResponse } from "@phading/user_service_interface/web/self/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";
import { pipeline } from "node:stream/promises";
import { Readable } from "stream";

export class UploadAccountAvatarHandler extends UploadAccountAvatarHandlerInterface {
  public static create(): UploadAccountAvatarHandler {
    return new UploadAccountAvatarHandler(
      SPANNER_DATABASE,
      S3_CLIENT,
      SERVICE_CLIENT,
      () => Date.now(),
      () => crypto.randomUUID(),
    );
  }

  private static ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000;
  private static DELAY_TO_CLEAN_UP_ON_ERROR_MS = 5 * 60 * 1000;
  public interfereFn: () => Promise<void> = () => Promise.resolve();

  public constructor(
    private database: Database,
    private s3Client: Ref<S3Client>,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
    private generateUuid: () => string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    authStr: string,
  ): Promise<UploadAccountAvatarResponse> {
    let { accountId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let avatarSmallFilename = this.generateUuid();
    let avatarLargeFilename = this.generateUuid();
    await this.database.runTransactionAsync(async (transaction) => {
      let now = this.getNow();
      await transaction.batchUpdate([
        insertAvatarImageFileStatement({
          r2Filename: avatarSmallFilename,
        }),
        insertAvatarImageFileStatement({
          r2Filename: avatarLargeFilename,
        }),
        insertAvatarImageDeletingTaskStatement({
          r2Filename: avatarSmallFilename,
          retryCount: 0,
          executionTimeMs: now + UploadAccountAvatarHandler.ONE_YEAR_IN_MS,
          createdTimeMs: now,
        }),
        insertAvatarImageDeletingTaskStatement({
          r2Filename: avatarLargeFilename,
          retryCount: 0,
          executionTimeMs: now + UploadAccountAvatarHandler.ONE_YEAR_IN_MS,
          createdTimeMs: now,
        }),
      ]);
      await transaction.commit();
    });

    try {
      await this.interfereFn();
      await this.uploadAndFinalize(
        loggingPrefix,
        body,
        avatarSmallFilename,
        avatarLargeFilename,
        accountId,
      );
    } catch (e) {
      await this.database.runTransactionAsync(async (transaction) => {
        await transaction.batchUpdate([
          updateAvatarImageDeletingTaskMetadataStatement({
            avatarImageDeletingTaskR2FilenameEq: avatarSmallFilename,
            setRetryCount: 0,
            setExecutionTimeMs:
              this.getNow() +
              UploadAccountAvatarHandler.DELAY_TO_CLEAN_UP_ON_ERROR_MS,
          }),
          updateAvatarImageDeletingTaskMetadataStatement({
            avatarImageDeletingTaskR2FilenameEq: avatarLargeFilename,
            setRetryCount: 0,
            setExecutionTimeMs:
              this.getNow() +
              UploadAccountAvatarHandler.DELAY_TO_CLEAN_UP_ON_ERROR_MS,
          }),
        ]);
        await transaction.commit();
      });
      throw e;
    }
    return {};
  }

  private async uploadAndFinalize(
    loggingPrefix: string,
    body: Readable,
    avatarSmallFilename: string,
    avatarLargeFilename: string,
    accountId: string,
  ): Promise<void> {
    let imageBuffer = await getStream.buffer(body, {
      maxBuffer: MAX_AVATAR_SIZE,
    });
    await Promise.all([
      this.resizeAndUpload(
        loggingPrefix,
        imageBuffer,
        LARGE_AVATAR_SIZE,
        LARGE_AVATAR_SIZE,
        avatarLargeFilename,
      ),
      this.resizeAndUpload(
        loggingPrefix,
        imageBuffer,
        SMALL_AVATAR_SIZE,
        SMALL_AVATAR_SIZE,
        avatarSmallFilename,
      ),
    ]);
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountMain(transaction, {
        accountAccountIdEq: accountId,
      });
      if (rows.length === 0) {
        throw newInternalServerErrorError(`Account ${accountId} is not found.`);
      }
      let account = rows[0];
      let now = this.getNow();
      await transaction.batchUpdate([
        updateAccountAvatarStatement({
          accountAccountIdEq: accountId,
          setAvatarSmallFilename: avatarSmallFilename,
          setAvatarLargeFilename: avatarLargeFilename,
        }),
        deleteAvatarImageDeletingTaskStatement({
          avatarImageDeletingTaskR2FilenameEq: avatarSmallFilename,
        }),
        deleteAvatarImageDeletingTaskStatement({
          avatarImageDeletingTaskR2FilenameEq: avatarLargeFilename,
        }),
        ...(account.accountAvatarSmallFilename !==
        DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME
          ? [
              insertAvatarImageDeletingTaskStatement({
                r2Filename: account.accountAvatarSmallFilename,
                retryCount: 0,
                executionTimeMs: now,
                createdTimeMs: now,
              }),
            ]
          : []),
        ...(account.accountAvatarLargeFilename !==
        DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME
          ? [
              insertAvatarImageDeletingTaskStatement({
                r2Filename: account.accountAvatarLargeFilename,
                retryCount: 0,
                executionTimeMs: now,
                createdTimeMs: now,
              }),
            ]
          : []),
      ]);
      await transaction.commit();
    });
  }

  private async resizeAndUpload(
    loggingPrefix: string,
    data: Buffer,
    width: number,
    height: number,
    outputFile: string,
  ): Promise<void> {
    let passThrough = new stream.PassThrough();
    let upload = new Upload({
      client: this.s3Client.val,
      params: {
        Bucket: ENV_VARS.r2AvatarBucketName,
        Key: outputFile,
        Body: passThrough,
        ContentType: "image/png",
      },
    });
    pipeline(
      sharp(data).resize(width, height, { fit: "contain" }).png({
        progressive: true,
        compressionLevel: 9,
        palette: true,
        effort: 10,
      }),
      passThrough,
    ).catch((e) => {
      console.error(
        `${loggingPrefix} Error while processing and uploading to ${outputFile}:`,
        e,
      );
      upload.abort();
    });
    await upload.done();
  }
}
