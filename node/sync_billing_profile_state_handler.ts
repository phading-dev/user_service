import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccountMain,
  insertAccountCapabilitiesUpdatingTaskStatement,
  updateAccountBillingProfileStateStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { SyncBillingProfileStateHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  SyncBillingProfileStateRequestBody,
  SyncBillingProfileStateResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";

export class SyncBillingProfileStateHandler extends SyncBillingProfileStateHandlerInterface {
  public static create(): SyncBillingProfileStateHandler {
    return new SyncBillingProfileStateHandler(SPANNER_DATABASE, () =>
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
    body: SyncBillingProfileStateRequestBody,
  ): Promise<SyncBillingProfileStateResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountMain(transaction, {
        accountAccountIdEq: body.accountId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Account ${body.accountId} is not found.`);
      }
      let row = rows[0];
      if (
        body.billingProfileStateVersion <= row.accountBillingProfileStateVersion
      ) {
        return;
      }
      let oldVersion = row.accountCapabilitiesVersion;
      let newVersion = oldVersion + 1;
      let now = this.getNow();
      await transaction.batchUpdate([
        updateAccountBillingProfileStateStatement({
          accountAccountIdEq: row.accountAccountId,
          setBillingProfileState: body.billingProfileState,
          setBillingProfileStateVersion: body.billingProfileStateVersion,
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
