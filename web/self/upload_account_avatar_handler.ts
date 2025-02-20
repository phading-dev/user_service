import getStream = require("get-stream");
import sharp = require("sharp");
import stream = require("stream");
import { DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME } from "../../common/params";
import { S3_CLIENT_PROMISE } from "../../common/s3_client";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccount, updateAccountStatement } from "../../db/sql";
import { ENV_VARS } from "../../env";
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
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { pipeline } from "node:stream/promises";
import { Readable } from "stream";

export class UploadAccountAvatarHandler extends UploadAccountAvatarHandlerInterface {
  public static async create(): Promise<UploadAccountAvatarHandler> {
    return new UploadAccountAvatarHandler(
      SPANNER_DATABASE,
      await S3_CLIENT_PROMISE,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private s3Client: S3Client,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    authStr: string,
  ): Promise<UploadAccountAvatarResponse> {
    let { accountId } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let avatarSmallFilename: string;
    let avatarLargeFilename: string;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccount(transaction, accountId);
      if (rows.length === 0) {
        throw newInternalServerErrorError(`Account ${accountId} is not found.`);
      }
      let { accountData } = rows[0];
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
      accountData.avatarSmallFilename = avatarSmallFilename;
      accountData.avatarLargeFilename = avatarLargeFilename;
      await transaction.batchUpdate([updateAccountStatement(accountData)]);
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
      client: this.s3Client,
      params: {
        Bucket: ENV_VARS.accountAvatarR2BucketName,
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
