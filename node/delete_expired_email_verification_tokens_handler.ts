import { SPANNER_DATABASE } from "../common/spanner_database";
import { deleteExpiredEmailVerificationTokensStatement } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { DeleteExpiredEmailVerificationTokensHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  DeleteExpiredEmailVerificationTokensRequestBody,
  DeleteExpiredEmailVerificationTokensResponse,
} from "@phading/user_service_interface/node/interface";

export class DeleteExpiredEmailVerificationTokensHandler extends DeleteExpiredEmailVerificationTokensHandlerInterface {
  public static create(): DeleteExpiredEmailVerificationTokensHandler {
    return new DeleteExpiredEmailVerificationTokensHandler(
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
    body: DeleteExpiredEmailVerificationTokensRequestBody,
  ): Promise<DeleteExpiredEmailVerificationTokensResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteExpiredEmailVerificationTokensStatement({
          emailVerificationTokenExpiresTimeMsLt: this.getNow(),
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
