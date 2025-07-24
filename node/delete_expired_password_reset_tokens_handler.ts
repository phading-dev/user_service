import { SPANNER_DATABASE } from "../common/spanner_database";
import { deleteExpiredPasswordResetTokensStatement } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { DeleteExpiredPasswordResetTokensHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  DeleteExpiredPasswordResetTokensRequestBody,
  DeleteExpiredPasswordResetTokensResponse,
} from "@phading/user_service_interface/node/interface";

export class DeleteExpiredPasswordResetTokensHandler extends DeleteExpiredPasswordResetTokensHandlerInterface {
  public static create(): DeleteExpiredPasswordResetTokensHandler {
    return new DeleteExpiredPasswordResetTokensHandler(SPANNER_DATABASE, () =>
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
    body: DeleteExpiredPasswordResetTokensRequestBody,
  ): Promise<DeleteExpiredPasswordResetTokensResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteExpiredPasswordResetTokensStatement({
          passwordResetTokenExpiresTimeMsLt: this.getNow(),
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
