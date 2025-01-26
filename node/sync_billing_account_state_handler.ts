import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccount,
  insertAccountCapabilitiesUpdatingTaskStatement,
  updateAccountStatement,
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
      let rows = await getAccount(transaction, body.accountId);
      if (rows.length === 0) {
        throw newBadRequestError(`Account ${body.accountId} is not found.`);
      }
      let { accountData } = rows[0];
      if (
        body.billingAccountStateVersion <=
        accountData.billingAccountStateInfo.version
      ) {
        return;
      }
      accountData.billingAccountStateInfo.version =
        body.billingAccountStateVersion;
      accountData.billingAccountStateInfo.state = body.billingAccountState;
      let oldVersion = accountData.capabilitiesVersion++;
      let now = this.getNow();
      await transaction.batchUpdate([
        updateAccountStatement(accountData),
        insertAccountCapabilitiesUpdatingTaskStatement(
          accountData.accountId,
          accountData.capabilitiesVersion,
          now,
          now,
        ),
        deleteAccountCapabilitiesUpdatingTaskStatement(
          accountData.accountId,
          oldVersion,
        ),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
