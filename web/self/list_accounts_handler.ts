import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { listLastAccessedAccounts } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { MAX_ACCOUNTS_PER_USER } from "@phading/constants/account";
import { AccountSummary } from "@phading/user_service_interface/web/self/account";
import { ListAccountsHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  ListAccountsRequestBody,
  ListAccountsResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListAccountsHandler extends ListAccountsHandlerInterface {
  public static create(): ListAccountsHandler {
    return new ListAccountsHandler(
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
    body: ListAccountsRequestBody,
    authStr: string,
  ): Promise<ListAccountsResponse> {
    let { userId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let rows = await listLastAccessedAccounts(this.database, {
      accountUserIdEq: userId,
      limit: MAX_ACCOUNTS_PER_USER,
    });
    return {
      accounts: rows.map((row): AccountSummary => {
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
