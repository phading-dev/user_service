import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPayoutProfileCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPayoutProfileCreatingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListPayoutProfileCreatingTasksRequestBody,
  ListPayoutProfileCreatingTasksResponse,
  ProcessPayoutProfileCreatingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListPayoutProfileCreatingTasksHandler extends ListPayoutProfileCreatingTasksHandlerInterface {
  public static create(): ListPayoutProfileCreatingTasksHandler {
    return new ListPayoutProfileCreatingTasksHandler(SPANNER_DATABASE, () =>
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
    body: ListPayoutProfileCreatingTasksRequestBody,
  ): Promise<ListPayoutProfileCreatingTasksResponse> {
    loggingPrefix = `${loggingPrefix} List payout account creating tasks:`;
    let rows = await listPendingPayoutProfileCreatingTasks(this.database, {
      payoutProfileCreatingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessPayoutProfileCreatingTaskRequestBody => ({
          accountId: row.payoutProfileCreatingTaskAccountId,
        }),
      ),
    };
  }
}
