import { toCapabilities } from "../common/capabilities_converter";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { Account } from "../db/schema";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccount,
  updateAccountCapabilitiesUpdatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessAccountCapabilitiesUpdatingTaskHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ProcessAccountCapabilitiesUpdatingTaskResponse,
} from "@phading/user_service_interface/node/interface";
import { updateAccountCapabilities } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ProcessAccountCapabilitiesUpdatingTaskHandler extends ProcessAccountCapabilitiesUpdatingTaskHandlerInterface {
  public static create(): ProcessAccountCapabilitiesUpdatingTaskHandler {
    return new ProcessAccountCapabilitiesUpdatingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn: () => void = () => {};

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ): Promise<ProcessAccountCapabilitiesUpdatingTaskResponse> {
    let { account } = await this.getPayloadAndClaimTask(
      body.accountId,
      body.capabilitiesVersion,
    );
    loggingPrefix = `${loggingPrefix} Account capabilities updating task for account ${body.accountId} version ${body.capabilitiesVersion}:`;
    this.startProcessingAndCatchError(loggingPrefix, account);
    return {};
  }

  private async getPayloadAndClaimTask(
    accountId: string,
    version: number,
  ): Promise<{
    account: Account;
  }> {
    let account: Account;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccount(transaction, accountId);
      if (rows.length === 0) {
        throw newInternalServerErrorError(`Account ${accountId} is not found.`);
      }
      let { accountData } = rows[0];
      if (version !== accountData.capabilitiesVersion) {
        throw newBadRequestError(
          `Account ${accountId} capability version is ${accountData.capabilitiesVersion} which doesn't match the task with version ${version}.`,
        );
      }
      account = accountData;
      await transaction.batchUpdate([
        updateAccountCapabilitiesUpdatingTaskStatement(
          accountData.accountId,
          version,
          this.getNow() +
            ProcessAccountCapabilitiesUpdatingTaskHandler.RETRY_BACKOFF_MS,
        ),
      ]);
      await transaction.commit();
    });
    return { account };
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    account: Account,
  ): Promise<void> {
    try {
      await updateAccountCapabilities(this.serviceClient, {
        accountId: account.accountId,
        capabilitiesVersion: account.capabilitiesVersion,
        capabilities: toCapabilities(account),
      });
      await this.database.runTransactionAsync(async (transaction) => {
        await transaction.batchUpdate([
          deleteAccountCapabilitiesUpdatingTaskStatement(
            account.accountId,
            account.capabilitiesVersion,
          ),
        ]);
        await transaction.commit();
      });
    } catch (e) {
      console.error(`${loggingPrefix} Task failed! ${e.stack ?? e}`);
    }
    this.doneCallbackFn();
  }
}
