import { STORAGE } from "../../common/cloud_storage";
import { ACCOUNT_AVATAR_BUCKET_NAME } from "../../common/env_vars";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccounts } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Storage } from "@google-cloud/storage";
import { ListAccountsHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  ListAccountsRequestBody,
  ListAccountsResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListAccountsHandler extends ListAccountsHandlerInterface {
  public static create(): ListAccountsHandler {
    return new ListAccountsHandler(SPANNER_DATABASE, STORAGE, SERVICE_CLIENT);
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
    body: ListAccountsRequestBody,
    sessionStr: string,
  ): Promise<ListAccountsResponse> {
    let { userSession } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = getAccounts(this.database, userSession.userId);
    return {
      accounts: (await rows).map((row) => {
        return {
          accountId: row.accountAccountId,
          accountType: row.accountAccountType,
          naturalName: row.accountNaturalName,
          avatarSmallUrl: this.storage
            .bucket(ACCOUNT_AVATAR_BUCKET_NAME)
            .file(row.accountAvatarSmallFilename)
            .publicUrl(),
        };
      }),
    };
  }
}
