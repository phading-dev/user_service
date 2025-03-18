import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountMain } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { GetAccountSummaryHandlerInterface } from "@phading/user_service_interface/web/third_person/handler";
import {
  GetAccountSummaryRequestBody,
  GetAccountSummaryResponse,
} from "@phading/user_service_interface/web/third_person/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class GetAccountSummaryHandler extends GetAccountSummaryHandlerInterface {
  public static create(): GetAccountSummaryHandler {
    return new GetAccountSummaryHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      ENV_VARS.r2AvatarPublicAccessDomain,
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private publicAccessDomain: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountSummaryRequestBody,
    authStr: string,
  ): Promise<GetAccountSummaryResponse> {
    if (!body.accountId) {
      throw newBadRequestError(`"accountId" is required.`);
    }
    await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
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
        avatarSmallUrl: `${this.publicAccessDomain}${account.accountAvatarSmallFilename}`,
      },
    };
  }
}
