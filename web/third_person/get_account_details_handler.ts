import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccount } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { GetAccountDetailsHandlerInterface } from "@phading/user_service_interface/web/third_person/handler";
import {
  GetAccountDetailsRequestBody,
  GetAccountDetailsResponse,
} from "@phading/user_service_interface/web/third_person/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class GetAccountDetailsHandler extends GetAccountDetailsHandlerInterface {
  public static create(): GetAccountDetailsHandler {
    return new GetAccountDetailsHandler(
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
    body: GetAccountDetailsRequestBody,
    authStr: string,
  ): Promise<GetAccountDetailsResponse> {
    if (!body.accountId) {
      throw newBadRequestError(`"accountId" is required.`);
    }
    await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
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
        naturalName: account.accountNaturalName,
        avatarLargeUrl: `${this.publicAccessDomain}/${account.accountAvatarLargeFilename}`,
        description: account.accountDescription,
      },
    };
  }
}
