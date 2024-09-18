import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { GetAccountsRow, getAccounts } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { AccountOverview } from "@phading/user_service_interface/self/frontend/account";
import { ListAccountsHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  ListAccountsRequestBody,
  ListAccountsResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListAccountsHandler extends ListAccountsHandlerInterface {
  public static create(): ListAccountsHandler {
    return new ListAccountsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
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
      accounts: (await rows).map((row) =>
        ListAccountsHandler.convertRowToAccountOverview(row),
      ),
    };
  }

  private static convertRowToAccountOverview(
    row: GetAccountsRow,
  ): AccountOverview {
    return {
      accountId: row.accountAccountId,
      accountType: row.accountAccountType,
      naturalName: row.accountNaturalName,
      avatarSmallPath: row.accountAvatarSmallPath,
    };
  }
}
