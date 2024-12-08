import { ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN } from "../../common/env_vars";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccounts } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListAccountsHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  ListAccountsRequestBody,
  ListAccountsResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListAccountsHandler extends ListAccountsHandlerInterface {
  public static create(): ListAccountsHandler {
    return new ListAccountsHandler(
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
    body: ListAccountsRequestBody,
    sessionStr: string,
  ): Promise<ListAccountsResponse> {
    let { userId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = getAccounts(this.database, userId);
    return {
      accounts: (await rows).map((row) => {
        return {
          accountId: row.accountAccountId,
          accountType: row.accountAccountType,
          naturalName: row.accountNaturalName,
          avatarSmallUrl: `${this.publicAccessDomain}${row.accountAvatarSmallFilename}`,
        };
      }),
    };
  }
}
