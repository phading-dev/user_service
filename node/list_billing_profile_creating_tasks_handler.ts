import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingBillingProfileCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingProfileCreatingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListBillingProfileCreatingTasksRequestBody,
  ListBillingProfileCreatingTasksResponse,
  ProcessBillingProfileCreatingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListBillingProfileCreatingTasksHandler extends ListBillingProfileCreatingTasksHandlerInterface {
  public static create(): ListBillingProfileCreatingTasksHandler {
    return new ListBillingProfileCreatingTasksHandler(SPANNER_DATABASE, () =>
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
    body: ListBillingProfileCreatingTasksRequestBody,
  ): Promise<ListBillingProfileCreatingTasksResponse> {
    loggingPrefix = `${loggingPrefix} List billing account creating tasks:`;
    let rows = await listPendingBillingProfileCreatingTasks(this.database, {
      billingProfileCreatingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessBillingProfileCreatingTaskRequestBody => ({
          accountId: row.billingProfileCreatingTaskAccountId,
        }),
      ),
    };
  }
}
