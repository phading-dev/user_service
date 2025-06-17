import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingAvatarImageDeletingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListAvatarImageDeletingTasksHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ListAvatarImageDeletingTasksRequestBody,
  ListAvatarImageDeletingTasksResponse,
  ProcessAvatarImageDeletingTaskRequestBody,
} from "@phading/user_service_interface/node/interface";

export class ListAvatarImageDeletingTasksHandler extends ListAvatarImageDeletingTasksHandlerInterface {
  public static create(): ListAvatarImageDeletingTasksHandler {
    return new ListAvatarImageDeletingTasksHandler(SPANNER_DATABASE, () =>
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
    body: ListAvatarImageDeletingTasksRequestBody,
  ): Promise<ListAvatarImageDeletingTasksResponse> {
    loggingPrefix = `${loggingPrefix} List avatar image deleting tasks:`;
    let rows = await listPendingAvatarImageDeletingTasks(this.database, {
      avatarImageDeletingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessAvatarImageDeletingTaskRequestBody => ({
          r2Filename: row.avatarImageDeletingTaskR2Filename,
        }),
      ),
    };
  }
}
