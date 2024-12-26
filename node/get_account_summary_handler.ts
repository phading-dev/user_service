import { ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN } from "../common/env_vars";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { getAccount } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetAccountSummaryHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  GetAccountSummaryRequestBody,
  GetAccountSummaryResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";

export class GetAccountSummaryHandler extends GetAccountSummaryHandlerInterface {
  public static create(): GetAccountSummaryHandler {
    return new GetAccountSummaryHandler(
      SPANNER_DATABASE,
      ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN,
    );
  }

  public constructor(
    private database: Database,
    private publicAccessDomain: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountSummaryRequestBody,
  ): Promise<GetAccountSummaryResponse> {
    let rows = await getAccount(this.database, body.accountId);
    if (rows.length === 0) {
      throw newBadRequestError(`Account ${body.accountId} is not found.`);
    }
    let { accountData } = rows[0];
    return {
      account: {
        accountId: accountData.accountId,
        naturalName: accountData.naturalName,
        avatarSmallUrl: `${this.publicAccessDomain}${accountData.avatarSmallFilename}`,
      },
    };
  }
}
