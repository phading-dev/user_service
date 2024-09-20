import { ACCOUNT_AVATAR_BUCKET } from "../../common/cloud_storage";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccounts } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Bucket } from "@google-cloud/storage";
import { ListAccountsHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  ListAccountsRequestBody,
  ListAccountsResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListAccountsHandler extends ListAccountsHandlerInterface {
  public static create(): ListAccountsHandler {
    return new ListAccountsHandler(
      SPANNER_DATABASE,
      ACCOUNT_AVATAR_BUCKET,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private avatarAccountBucket: Bucket,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListAccountsRequestBody,
    sessionStr: string,
  ): Promise<ListAccountsResponse> {
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    let rows = getAccounts(
      (query) => this.database.run(query),
      userSession.userId,
    );
    return {
      accounts: (await rows).map((row) => {
        return {
          accountId: row.accountAccountId,
          accountType: row.accountAccountType,
          naturalName: row.accountNaturalName,
          avatarSmallPath: this.avatarAccountBucket
            .file(row.accountAvatarSmallFilename)
            .publicUrl(),
        };
      }),
    };
  }
}
