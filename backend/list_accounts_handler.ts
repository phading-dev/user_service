import { SPANNER_DATABASE } from "../common/spanner_database";
import { listAccountsByType } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListAccountsHandlerInterface } from "@phading/user_service_interface/backend/handler";
import {
  ListAccountsRequestBody,
  ListAccountsResponse,
} from "@phading/user_service_interface/backend/interface";

export class ListAccountsHandler extends ListAccountsHandlerInterface {
  public static create(): ListAccountsHandler {
    return new ListAccountsHandler(SPANNER_DATABASE);
  }

  public constructor(private database: Database) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListAccountsRequestBody,
  ): Promise<ListAccountsResponse> {
    let rows = await listAccountsByType(
      this.database,
      body.createdTimeMsCursor,
      body.accountType,
      body.limit,
    );
    let createdTimeMsCursor: number;
    let accountIds = rows.map((row) => {
      createdTimeMsCursor = row.accountCreatedTimestamp;
      return row.accountAccountId;
    });
    if (accountIds.length < body.limit) {
      createdTimeMsCursor = undefined;
    }
    return {
      accountIds,
      createdTimeMsCursor,
    };
  }
}
