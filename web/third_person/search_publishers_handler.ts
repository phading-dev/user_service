import { AccountType } from "@phading/user_service_interface/account_type";
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
import { AccountSummary } from "@phading/user_service_interface/web/third_person/account";
import { SearchPublishersHandlerInterface } from "@phading/user_service_interface/web/third_person/handler";
import {
  SearchPublishersRequestBody,
  SearchPublishersResponse,
} from "@phading/user_service_interface/web/third_person/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SearchPublishersHandler extends SearchPublishersHandlerInterface {
  public static create(): SearchPublishersHandler {
    return new SearchPublishersHandler(
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
    body: SearchPublishersRequestBody,
    authStr: string,
  ): Promise<SearchPublishersResponse> {
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
    if (!body.scoreCursor) {
      rows = await searchAccounts(this.database, {
        accountAccountTypeEq: AccountType.PUBLISHER,
        accountFullTextSearch: body.query,
        accountFullTextScoreOrderBy: body.query,
        limit: body.limit,
        accountFullTextScoreSelect: body.query,
      });
    } else {
      rows = await continuedSearchAccounts(this.database, {
        accountAccountTypeEq: AccountType.PUBLISHER,
        accountFullTextSearch: body.query,
        accountFullTextScoreWhereLt: body.query,
        accountFullTextScoreLt: body.scoreCursor,
        accountFullTextScoreWhereEq: body.query,
        accountFullTextScoreEq: body.scoreCursor,
        accountCreatedTimeMsGt: body.createdTimeCursor,
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
          avatarSmallUrl: `${this.publicAccessDomain}/${row.accountAvatarSmallFilename}`,
        }),
      ),
      scoreCusor:
        rows.length === body.limit
          ? rows[rows.length - 1].accountFullTextScore
          : undefined,
      createdTimeCursor:
        rows.length === body.limit
          ? rows[rows.length - 1].accountCreatedTimeMs
          : undefined,
    };
  }
}
