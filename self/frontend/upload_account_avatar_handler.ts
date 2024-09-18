import getStream = require("get-stream");
import sharp = require("sharp");
import stream = require("stream");
import util = require("util");
import { CLOUD_STORAGE } from "../../common/cloud_storage";
import {
  ACCOUNT_AVATAR_BUCKET_NAME,
  LARGE_AVATAR_SIZE,
  MAX_AVATAR_BUFFER_SIZE,
  SMALL_AVATAR_SIZE,
} from "../../common/constants";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAvatarFilename, updateAvatar } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Storage } from "@google-cloud/storage";
import { UploadAccountAvatarHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import { UploadAccountAvatarResponse } from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Readable } from "stream";
let pipeline = util.promisify(stream.pipeline);

export class UploadAccountAvatarHandler extends UploadAccountAvatarHandlerInterface {
  public static create(): UploadAccountAvatarHandler {
    return new UploadAccountAvatarHandler(
      SPANNER_DATABASE,
      CLOUD_STORAGE,
      SERVICE_CLIENT,
      () => crypto.randomUUID(),
    );
  }

  public constructor(
    private database: Database,
    private storage: Storage,
    private serviceClient: NodeServiceClient,
    private generateUuid: () => string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    sessionStr: string,
  ): Promise<UploadAccountAvatarResponse> {
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    let avatarSmallFilename: string;
    let avatarLargeFilename: string;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAvatarFilename(
        (query) => transaction.run(query),
        userSession.accountId,
      );
      if (rows.length > 0) {
        avatarSmallFilename = rows[0].accountAvatarSmallFilename;
        avatarLargeFilename = rows[0].accountAvatarLargeFilename;
        await transaction.commit();
        return;
      }
      avatarSmallFilename = `${this.generateUuid()}.png`;
      avatarLargeFilename = `${this.generateUuid()}.png`;
      await updateAvatar(
        (query) => transaction.run(query),
        `${ACCOUNT_AVATAR_BUCKET_NAME}/${avatarSmallFilename}`,
        `${ACCOUNT_AVATAR_BUCKET_NAME}/${avatarLargeFilename}`,
        avatarSmallFilename,
        avatarLargeFilename,
        userSession.accountId,
      );
      await transaction.commit();
    });

    let imageBuffer = await getStream.buffer(body, {
      maxBuffer: MAX_AVATAR_BUFFER_SIZE,
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
        .createWriteStream(),
    );
  }
}
