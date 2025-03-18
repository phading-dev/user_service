import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  ContinuedSearchAccountsRow,
  SearchAccountsRow,
  continuedSearchAccounts,
  searchAccounts,
} from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { AccountSummary } from "@phading/user_service_interface/web/third_person/account_summary";
import { SearchAccountsHandlerInterface } from "@phading/user_service_interface/web/third_person/handler";
import {
  SearchAccountsRequestBody,
  SearchAccountsResponse,
} from "@phading/user_service_interface/web/third_person/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SearchAccountsHandler extends SearchAccountsHandlerInterface {
  public static create(): SearchAccountsHandler {
    return new SearchAccountsHandler(
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
    body: SearchAccountsRequestBody,
    authStr: string,
  ): Promise<SearchAccountsResponse> {
    if (!body.query) {
      throw newBadRequestError(`"query" is required.`);
    }
    if (!body.limit) {
      throw newBadRequestError(`"limit" is required.`);
    }
    await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );

    let rows: Array<SearchAccountsRow | ContinuedSearchAccountsRow>;
    if (!body.scoreCusor) {
      rows = await searchAccounts(this.database, {
        accountFullTextSearch: body.query,
        accountFullTextScoreOrderBy: body.query,
        limit: body.limit,
        accountFullTextScoreSelect: body.query,
      });
    } else {
      rows = await continuedSearchAccounts(this.database, {
        accountFullTextSearch: body.query,
        accountFullTextScoreWhere: body.query,
        accountFullTextScoreLt: body.scoreCusor,
        accountFullTextScoreOrderBy: body.query,
        limit: body.limit,
        accountFullTextScoreSelect: body.query,
      });
    }
    return {
      accounts: rows.map(
        (row): AccountSummary => ({
          accountId: row.accountAccountId,
          naturalName: row.accountNaturalName,
          avatarSmallUrl: `${this.publicAccessDomain}${row.accountAvatarSmallFilename}`,
        }),
      ),
      scoreCusor:
        rows.length === body.limit
          ? rows[rows.length - 1].accountFullTextScore
          : undefined,
    };
  }
}
