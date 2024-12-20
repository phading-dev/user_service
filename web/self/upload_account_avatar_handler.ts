import getStream = require("get-stream");
import sharp = require("sharp");
import stream = require("stream");
import { ACCOUNT_AVATAR_BUCKET_NAME } from "../../common/env_vars";
import { DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME } from "../../common/params";
import { S3_CLIENT } from "../../common/s3_client";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountById, updateAccountDataStatement } from "../../db/sql";
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
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { pipeline } from "node:stream/promises";
import { Readable } from "stream";

export class UploadAccountAvatarHandler extends UploadAccountAvatarHandlerInterface {
  public static create(): UploadAccountAvatarHandler {
    return new UploadAccountAvatarHandler(
      SPANNER_DATABASE,
      S3_CLIENT,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private r2Client: S3Client,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    sessionStr: string,
  ): Promise<UploadAccountAvatarResponse> {
    let { accountId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let avatarSmallFilename: string;
    let avatarLargeFilename: string;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountById(transaction, accountId);
      if (rows.length === 0) {
        throw newInternalServerErrorError(`Account ${accountId} is not found.`);
      }
      let accountData = rows[0].accountData;
      if (
        accountData.avatarSmallFilename !==
        DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME
      ) {
        avatarSmallFilename = accountData.avatarSmallFilename;
        avatarLargeFilename = accountData.avatarLargeFilename;
        return;
      }
      avatarSmallFilename = `${accountId}s.png`;
      avatarLargeFilename = `${accountId}l.png`;
      await transaction.batchUpdate([
        updateAccountDataStatement(accountId, {
          naturalName: accountData.naturalName,
          contactEmail: accountData.contactEmail,
          avatarSmallFilename,
          avatarLargeFilename,
        }),
      ]);
      await transaction.commit();
    });

    let imageBuffer = await getStream.buffer(body, {
      maxBuffer: MAX_AVATAR_SIZE,
    });
    await Promise.all([
      this.resizeAndUpload(
        imageBuffer,
        LARGE_AVATAR_SIZE,
        LARGE_AVATAR_SIZE,
        avatarLargeFilename,
      ),
      this.resizeAndUpload(
        imageBuffer,
        SMALL_AVATAR_SIZE,
        SMALL_AVATAR_SIZE,
        avatarSmallFilename,
      ),
    ]);
    return {};
  }

  private async resizeAndUpload(
    data: Buffer,
    width: number,
    height: number,
    outputFile: string,
  ): Promise<void> {
    let passThrough = new stream.PassThrough();
    let upload = new Upload({
      client: this.r2Client,
      params: {
        Bucket: ACCOUNT_AVATAR_BUCKET_NAME,
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
    );
    await upload.done();
  }
}
