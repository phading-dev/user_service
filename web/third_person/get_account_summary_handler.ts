import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountMain } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { GetAccountSummaryHandlerInterface } from "@phading/user_service_interface/web/third_person/handler";
import {
  GetAccountSummaryRequestBody,
  GetAccountSummaryResponse,
} from "@phading/user_service_interface/web/third_person/interface";
import { newBadRequestError } from "@selfage/http_error";

export class GetAccountSummaryHandler extends GetAccountSummaryHandlerInterface {
  public static create(): GetAccountSummaryHandler {
    return new GetAccountSummaryHandler(
      SPANNER_DATABASE,
      ENV_VARS.r2AvatarPublicAccessDomain,
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
    if (!body.accountId) {
      throw newBadRequestError(`"accountId" is required.`);
    }
    let rows = await getAccountMain(this.database, {
      accountAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      throw newBadRequestError(`Account ${body.accountId} is not found.`);
    }
    let account = rows[0];
    return {
      account: {
        accountId: account.accountAccountId,
        naturalName: account.accountNaturalName,
        avatarSmallUrl: `${this.publicAccessDomain}/${account.accountAvatarSmallFilename}`,
      },
    };
  }
}
