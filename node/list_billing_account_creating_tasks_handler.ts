import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingBillingAccountCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingAccountCreatingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListBillingAccountCreatingTasksRequestBody,
  ListBillingAccountCreatingTasksResponse,
  ProcessBillingAccountCreatingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListBillingAccountCreatingTasksHandler extends ListBillingAccountCreatingTasksHandlerInterface {
  public static create(): ListBillingAccountCreatingTasksHandler {
    return new ListBillingAccountCreatingTasksHandler(SPANNER_DATABASE, () =>
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
    body: ListBillingAccountCreatingTasksRequestBody,
  ): Promise<ListBillingAccountCreatingTasksResponse> {
    loggingPrefix = `${loggingPrefix} List billing account creating tasks:`;
    let rows = await listPendingBillingAccountCreatingTasks(this.database, {
      billingAccountCreatingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessBillingAccountCreatingTaskRequestBody => ({
          accountId: row.billingAccountCreatingTaskAccountId,
        }),
      ),
    };
  }
}
