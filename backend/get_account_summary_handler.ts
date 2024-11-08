import { STORAGE } from "../common/cloud_storage";
import { ACCOUNT_AVATAR_BUCKET_NAME } from "../common/env_vars";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { getAccountById } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { Storage } from "@google-cloud/storage";
import { GetAccountSummaryHandlerInterface } from "@phading/user_service_interface/backend/handler";
import {
  GetAccountSummaryRequestBody,
  GetAccountSummaryResponse,
} from "@phading/user_service_interface/backend/interface";
import { newBadRequestError } from "@selfage/http_error";

export class GetAccountSummaryHandler extends GetAccountSummaryHandlerInterface {
  public static create(): GetAccountSummaryHandler {
    return new GetAccountSummaryHandler(SPANNER_DATABASE, STORAGE);
  }

  public constructor(
    private database: Database,
    private storage: Storage,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountSummaryRequestBody,
  ): Promise<GetAccountSummaryResponse> {
    let rows = await getAccountById(this.database, body.accountId);
    if (rows.length === 0) {
      throw newBadRequestError(`Account ${body.accountId} is not found.`);
    }
    let userRow = rows[0];
    return {
      account: {
        accountId: body.accountId,
        naturalName: userRow.accountNaturalName,
        avatarSmallUrl: this.storage
          .bucket(ACCOUNT_AVATAR_BUCKET_NAME)
          .file(userRow.accountAvatarSmallFilename)
          .publicUrl(),
      },
    };
  }
}
