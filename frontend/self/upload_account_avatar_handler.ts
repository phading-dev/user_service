import getStream = require("get-stream");
import sharp = require("sharp");
import stream = require("stream");
import util = require("util");
import { STORAGE } from "../../common/cloud_storage";
import { ACCOUNT_AVATAR_BUCKET_NAME } from "../../common/env_vars";
import { DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME } from "../../common/params";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountById, updateAvatarStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Storage } from "@google-cloud/storage";
import {
  AVATAR_SIZE_LIMIT,
  LARGE_AVATAR_SIZE,
  SMALL_AVATAR_SIZE,
} from "@phading/constants/account";
import { UploadAccountAvatarHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import { UploadAccountAvatarResponse } from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Readable } from "stream";
let pipeline = util.promisify(stream.pipeline);

export class UploadAccountAvatarHandler extends UploadAccountAvatarHandlerInterface {
  public static create(): UploadAccountAvatarHandler {
    return new UploadAccountAvatarHandler(
      SPANNER_DATABASE,
      STORAGE,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private storage: Storage,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    sessionStr: string,
  ): Promise<UploadAccountAvatarResponse> {
    let { userSession } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let avatarSmallFilename: string;
    let avatarLargeFilename: string;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountById(transaction, userSession.accountId);
      if (rows.length === 0) {
        throw newInternalServerErrorError(
          `Account ${userSession.accountId} is not found.`,
        );
      }
      let accountRow = rows[0];
      if (
        accountRow.accountAvatarSmallFilename !==
        DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME
      ) {
        avatarSmallFilename = accountRow.accountAvatarSmallFilename;
        avatarLargeFilename = accountRow.accountAvatarLargeFilename;
        return;
      }
      avatarSmallFilename = `${userSession.accountId}s.png`;
      avatarLargeFilename = `${userSession.accountId}l.png`;
      await transaction.batchUpdate([
        updateAvatarStatement(
          avatarSmallFilename,
          avatarLargeFilename,
          userSession.accountId,
        ),
      ]);
      await transaction.commit();
    });

    let imageBuffer = await getStream.buffer(body, {
      maxBuffer: AVATAR_SIZE_LIMIT,
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
    await pipeline(
      sharp(data).resize(width, height, { fit: "contain" }).png({
        progressive: true,
        compressionLevel: 9,
        palette: true,
        effort: 10,
      }),
      this.storage
        .bucket(ACCOUNT_AVATAR_BUCKET_NAME)
        .file(outputFile)
        .createWriteStream({
          resumable: false,
        }),
    );
  }
}
