import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccountMain,
  insertAccountCapabilitiesUpdatingTaskStatement,
  updateAccountBillingAccountStateStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { SyncBillingAccountStateHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  SyncBillingAccountStateRequestBody,
  SyncBillingAccountStateResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";

export class SyncBillingAccountStateHandler extends SyncBillingAccountStateHandlerInterface {
  public static create(): SyncBillingAccountStateHandler {
    return new SyncBillingAccountStateHandler(SPANNER_DATABASE, () =>
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
    body: SyncBillingAccountStateRequestBody,
  ): Promise<SyncBillingAccountStateResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountMain(transaction, {
        accountAccountIdEq: body.accountId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Account ${body.accountId} is not found.`);
      }
      let row = rows[0];
      if (
        body.billingAccountStateVersion <= row.accountBillingAccountStateVersion
      ) {
        return;
      }
      let oldVersion = row.accountCapabilitiesVersion;
      let newVersion = oldVersion + 1;
      let now = this.getNow();
      await transaction.batchUpdate([
        updateAccountBillingAccountStateStatement({
          accountAccountIdEq: row.accountAccountId,
          setBillingAccountState: body.billingAccountState,
          setBillingAccountStateVersion: body.billingAccountStateVersion,
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
