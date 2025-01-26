import { SPANNER_DATABASE } from "../common/spanner_database";
import { listAccountCapabilitiesUpdatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListAccountCapabilitiesUpdatingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListAccountCapabilitiesUpdatingTasksRequestBody,
  ListAccountCapabilitiesUpdatingTasksResponse,
  ProcessAccountCapabilitiesUpdatingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListAccountCapabilitiesUpdatingTasksHandler extends ListAccountCapabilitiesUpdatingTasksHandlerInterface {
  public static create(): ListAccountCapabilitiesUpdatingTasksHandler {
    return new ListAccountCapabilitiesUpdatingTasksHandler(
      SPANNER_DATABASE,
      () => Date.now(),
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
    body: ListAccountCapabilitiesUpdatingTasksRequestBody,
  ): Promise<ListAccountCapabilitiesUpdatingTasksResponse> {
    let rows = await listAccountCapabilitiesUpdatingTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: rows.map(
        (row): ProcessAccountCapabilitiesUpdatingTaskRequestBody => ({
          accountId: row.accountCapabilitiesUpdatingTaskAccountId,
          capabilitiesVersion:
            row.accountCapabilitiesUpdatingTaskCapabilitiesVersion,
        }),
      ),
    };
  }
}
