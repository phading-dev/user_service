import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentProfileCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentProfileCreatingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListPaymentProfileCreatingTasksRequestBody,
  ListPaymentProfileCreatingTasksResponse,
  ProcessPaymentProfileCreatingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListPaymentProfileCreatingTasksHandler extends ListPaymentProfileCreatingTasksHandlerInterface {
  public static create(): ListPaymentProfileCreatingTasksHandler {
    return new ListPaymentProfileCreatingTasksHandler(SPANNER_DATABASE, () =>
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
    body: ListPaymentProfileCreatingTasksRequestBody,
  ): Promise<ListPaymentProfileCreatingTasksResponse> {
    loggingPrefix = `${loggingPrefix} List payment account creating tasks:`;
    let rows = await listPendingPaymentProfileCreatingTasks(this.database, {
      paymentProfileCreatingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessPaymentProfileCreatingTaskRequestBody => ({
          accountId: row.paymentProfileCreatingTaskAccountId,
        }),
      ),
    };
  }
}
