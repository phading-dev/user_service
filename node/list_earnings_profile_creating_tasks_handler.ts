import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingEarningsProfileCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListEarningsProfileCreatingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListEarningsProfileCreatingTasksRequestBody,
  ListEarningsProfileCreatingTasksResponse,
  ProcessEarningsProfileCreatingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListEarningsProfileCreatingTasksHandler extends ListEarningsProfileCreatingTasksHandlerInterface {
  public static create(): ListEarningsProfileCreatingTasksHandler {
    return new ListEarningsProfileCreatingTasksHandler(SPANNER_DATABASE, () =>
      Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListEarningsProfileCreatingTasksRequestBody,
  ): Promise<ListEarningsProfileCreatingTasksResponse> {
    loggingPrefix = `${loggingPrefix} List earnings account creating tasks:`;
    let rows = await listPendingEarningsProfileCreatingTasks(this.database, {
      earningsProfileCreatingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessEarningsProfileCreatingTaskRequestBody => ({
          accountId: row.earningsProfileCreatingTaskAccountId,
        }),
      ),
    };
  }
}
