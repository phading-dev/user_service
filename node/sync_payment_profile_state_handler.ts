import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccountMain,
  insertAccountCapabilitiesUpdatingTaskStatement,
  updateAccountPaymentProfileStateStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { SyncPaymentProfileStateHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  SyncPaymentProfileStateRequestBody,
  SyncPaymentProfileStateResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";

export class SyncPaymentProfileStateHandler extends SyncPaymentProfileStateHandlerInterface {
  public static create(): SyncPaymentProfileStateHandler {
    return new SyncPaymentProfileStateHandler(SPANNER_DATABASE, () =>
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
    body: SyncPaymentProfileStateRequestBody,
  ): Promise<SyncPaymentProfileStateResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountMain(transaction, {
        accountAccountIdEq: body.accountId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Account ${body.accountId} is not found.`);
      }
      let row = rows[0];
      if (
        body.paymentProfileStateVersion <= row.accountPaymentProfileStateVersion
      ) {
        return;
      }
      let oldVersion = row.accountCapabilitiesVersion;
      let newVersion = oldVersion + 1;
      let now = this.getNow();
      await transaction.batchUpdate([
        updateAccountPaymentProfileStateStatement({
          accountAccountIdEq: row.accountAccountId,
          setPaymentProfileState: body.paymentProfileState,
          setPaymentProfileStateVersion: body.paymentProfileStateVersion,
          setCapabilitiesVersion: newVersion,
        }),
        insertAccountCapabilitiesUpdatingTaskStatement({
          accountId: row.accountAccountId,
          capabilitiesVersion: newVersion,
          retryCount: 0,
          executionTimeMs: now,
          createdTimeMs: now,
        }),
        deleteAccountCapabilitiesUpdatingTaskStatement({
          accountCapabilitiesUpdatingTaskAccountIdEq: row.accountAccountId,
          accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: oldVersion,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
