import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccount } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { GetAccountDetailsHandlerInterface } from "@phading/user_service_interface/web/third_person/handler";
import {
  GetAccountDetailsRequestBody,
  GetAccountDetailsResponse,
} from "@phading/user_service_interface/web/third_person/interface";
import { newBadRequestError } from "@selfage/http_error";

export class GetAccountDetailsHandler extends GetAccountDetailsHandlerInterface {
  public static create(): GetAccountDetailsHandler {
    return new GetAccountDetailsHandler(
      SPANNER_DATABASE,
      ENV_VARS.r2AvatarPublicAccessOrigin,
    );
  }

  public constructor(
    private database: Database,
    private publicAccessOrigin: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountDetailsRequestBody,
  ): Promise<GetAccountDetailsResponse> {
    if (!body.accountId) {
      throw newBadRequestError(`"accountId" is required.`);
    }
    let rows = await getAccount(this.database, {
      accountAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      throw newBadRequestError(`Account ${body.accountId} is not found.`);
    }
    let account = rows[0];
    return {
      account: {
        accountId: account.accountAccountId,
        name: account.accountName,
        avatarLargeUrl: `${this.publicAccessOrigin}/${account.accountAvatarLargeFilename}`,
        description: account.accountDescription,
      },
    };
  }
}
