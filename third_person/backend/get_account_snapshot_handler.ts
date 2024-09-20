import { ACCOUNT_AVATAR_BUCKET } from "../../common/cloud_storage";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountSnapshot } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Bucket } from "@google-cloud/storage";
import { GetAccountSnapshotHandlerInterface } from "@phading/user_service_interface/third_person/backend/handler";
import {
  GetAccountSnapshotRequestBody,
  GetAccountSnapshotResponse,
} from "@phading/user_service_interface/third_person/backend/interface";

export class GetAccountSnapshotHandler extends GetAccountSnapshotHandlerInterface {
  public static create(): GetAccountSnapshotHandler {
    return new GetAccountSnapshotHandler(
      SPANNER_DATABASE,
      ACCOUNT_AVATAR_BUCKET,
    );
  }

  public constructor(
    private database: Database,
    private accoutAvatarBucket: Bucket,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountSnapshotRequestBody,
  ): Promise<GetAccountSnapshotResponse> {
    let row = (
      await getAccountSnapshot(
        (query) => this.database.run(query),
        body.accountId,
      )
    )[0];
    this.accoutAvatarBucket.file(row.accountAvatarSmallFilename).publicUrl();
    return {
      account: {
        accountId: row.accountAccountId,
        naturalName: row.accountNaturalName,
        avatarSmallUrl: this.accoutAvatarBucket
          .file(row.accountAvatarSmallFilename)
          .publicUrl(),
      },
    };
  }
}
