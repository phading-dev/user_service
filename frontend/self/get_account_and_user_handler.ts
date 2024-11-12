import { ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN } from "../../common/env_vars";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountAndUser } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetAccountAndUserHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  GetAccountAndUserRequestBody,
  GetAccountAndUserResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class GetAccountAndUserHandler extends GetAccountAndUserHandlerInterface {
  public static create(): GetAccountAndUserHandler {
    return new GetAccountAndUserHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN,
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
    let { userId, accountId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = await getAccountAndUser(this.database, userId, accountId);
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `User ${userId} or account ${accountId} is not found.`,
      );
    }
    let row = rows[0];
    return {
      account: {
        username: row.uUsername,
        recoveryEmail: row.uRecoveryEmail,
        naturalName: row.aNaturalName,
        contactEmail: row.aContactEmail,
        description: row.aDescription,
        avatarLargeUrl: `${this.publicAccessDomain}${row.aAvatarLargeFilename}`,
      },
    };
  }
}
