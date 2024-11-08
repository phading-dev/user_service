import { STORAGE } from "../../common/cloud_storage";
import { ACCOUNT_AVATAR_BUCKET_NAME } from "../../common/env_vars";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountAndUser } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Storage } from "@google-cloud/storage";
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
      STORAGE,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private storage: Storage,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountAndUserRequestBody,
    sessionStr: string,
  ): Promise<GetAccountAndUserResponse> {
    let { userSession } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = await getAccountAndUser(
      this.database,
      userSession.userId,
      userSession.accountId,
    );
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `User ${userSession.userId} or account ${userSession.accountId} is not found.`,
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
        avatarLargeUrl: this.storage
          .bucket(ACCOUNT_AVATAR_BUCKET_NAME)
          .file(row.aAvatarLargeFilename)
          .publicUrl(),
      },
    };
  }
}
