import { toCapabilities } from "../common/capabilities_converter";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccount,
  getAccountCapabilitiesUpdatingTaskMetadata,
  updateAccountCapabilitiesUpdatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessAccountCapabilitiesUpdatingTaskHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ProcessAccountCapabilitiesUpdatingTaskResponse,
} from "@phading/user_service_interface/node/interface";
import { newUpdateAccountCapabilitiesRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessAccountCapabilitiesUpdatingTaskHandler extends ProcessAccountCapabilitiesUpdatingTaskHandlerInterface {
  public static create(): ProcessAccountCapabilitiesUpdatingTaskHandler {
    return new ProcessAccountCapabilitiesUpdatingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
    this.taskHandler = ProcessTaskHandlerWrapper.create(
      this.descriptor,
      5 * 60 * 1000,
      24 * 60 * 60 * 1000,
    );
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ): Promise<ProcessAccountCapabilitiesUpdatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Account capabilities updating task for account ${body.accountId} version ${body.capabilitiesVersion}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    body: ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountCapabilitiesUpdatingTaskMetadata(
        transaction,
        body.accountId,
        body.capabilitiesVersion,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateAccountCapabilitiesUpdatingTaskMetadataStatement(
          body.accountId,
          body.capabilitiesVersion,
          task.accountCapabilitiesUpdatingTaskRetryCount + 1,
          task.accountCapabilitiesUpdatingTaskExecutionTimeMs +
            this.taskHandler.getBackoffTime(
              task.accountCapabilitiesUpdatingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ): Promise<void> {
    let rows = await getAccount(this.database, body.accountId);
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `Account ${body.accountId} is not found.`,
      );
    }
    let { accountData } = rows[0];
    if (body.capabilitiesVersion !== accountData.capabilitiesVersion) {
      throw newBadRequestError(
        `Account ${body.accountId} capability version is ${accountData.capabilitiesVersion} which doesn't match the task with version ${body.capabilitiesVersion}.`,
      );
    }
    await this.serviceClient.send(
      newUpdateAccountCapabilitiesRequest({
        accountId: body.accountId,
        capabilitiesVersion: body.capabilitiesVersion,
        capabilities: toCapabilities(accountData),
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteAccountCapabilitiesUpdatingTaskStatement(
          body.accountId,
          body.capabilitiesVersion,
        ),
      ]);
      await transaction.commit();
    });
  }
}
