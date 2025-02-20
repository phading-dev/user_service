import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUserAndAccountAndMore } from "../../db/sql";
import { ENV_VARS } from "../../env";
import { Database } from "@google-cloud/spanner";
import { GetAccountAndUserHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  GetAccountAndUserRequestBody,
  GetAccountAndUserResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class GetAccountAndUserHandler extends GetAccountAndUserHandlerInterface {
  public static create(): GetAccountAndUserHandler {
    return new GetAccountAndUserHandler(
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
    body: GetAccountAndUserRequestBody,
    sessionStr: string,
  ): Promise<GetAccountAndUserResponse> {
    let { userId, accountId } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
      }),
    );
    let rows = await getUserAndAccountAndMore(this.database, userId, accountId);
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `User ${userId} or account ${accountId} is not found.`,
      );
    }
    let { aData, amData, uData } = rows[0];
    return {
      account: {
        username: uData.username,
        recoveryEmail: uData.recoveryEmail,
        naturalName: aData.naturalName,
        contactEmail: aData.contactEmail,
        description: amData.description,
        avatarLargeUrl: `${this.publicAccessDomain}${aData.avatarLargeFilename}`,
      },
    };
  }
}
