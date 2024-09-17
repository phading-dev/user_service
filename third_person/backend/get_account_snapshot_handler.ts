import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountSnapshot } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetAccountSnapshotHandlerInterface } from "@phading/user_service_interface/third_person/backend/handler";
import {
  GetAccountSnapshotRequestBody,
  GetAccountSnapshotResponse,
} from "@phading/user_service_interface/third_person/backend/interface";

export class GetAccountSnapshotHandler extends GetAccountSnapshotHandlerInterface {
  public static create(): GetAccountSnapshotHandler {
    return new GetAccountSnapshotHandler(SPANNER_DATABASE);
  }

  public constructor(private database: Database) {
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
    return {
      account: {
        accountId: row.accountAccountId,
        naturalName: row.accountNaturalName,
        avatarSmallPath: row.accountAvatarSmallPath,
      },
    };
  }
}
