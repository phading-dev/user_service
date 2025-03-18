import { toCapabilities } from "../common/capabilities_converter";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteAccountCapabilitiesUpdatingTaskStatement,
  getAccountCapabilitiesUpdatingTaskMetadata,
  getAccountMain,
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
      () => Date.now(),
    );
  }

  private taskHandler = ProcessTaskHandlerWrapper.create(
    this.descriptor,
    5 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

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
    loggingPrefix = `${loggingPrefix} Account capabilities updating task for account ${body.accountId} version ${body.capabilitiesVersion}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getAccountCapabilitiesUpdatingTaskMetadata(transaction, {
        accountCapabilitiesUpdatingTaskAccountIdEq: body.accountId,
        accountCapabilitiesUpdatingTaskCapabilitiesVersionEq:
          body.capabilitiesVersion,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateAccountCapabilitiesUpdatingTaskMetadataStatement({
          accountCapabilitiesUpdatingTaskAccountIdEq: body.accountId,
          accountCapabilitiesUpdatingTaskCapabilitiesVersionEq:
            body.capabilitiesVersion,
          setRetryCount: task.accountCapabilitiesUpdatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.accountCapabilitiesUpdatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessAccountCapabilitiesUpdatingTaskRequestBody,
  ): Promise<void> {
    let rows = await getAccountMain(this.database, {
      accountAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `Account ${body.accountId} is not found.`,
      );
    }
    let row = rows[0];
    if (body.capabilitiesVersion !== row.accountCapabilitiesVersion) {
      throw newBadRequestError(
        `Account ${body.accountId} capability version is ${row.accountCapabilitiesVersion} which doesn't match the task with version ${body.capabilitiesVersion}.`,
      );
    }
    await this.serviceClient.send(
      newUpdateAccountCapabilitiesRequest({
        accountId: body.accountId,
        capabilitiesVersion: body.capabilitiesVersion,
        capabilities: toCapabilities(row.accountBillingAccountState),
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteAccountCapabilitiesUpdatingTaskStatement({
          accountCapabilitiesUpdatingTaskAccountIdEq: body.accountId,
          accountCapabilitiesUpdatingTaskCapabilitiesVersionEq:
            body.capabilitiesVersion,
        }),
      ]);
      await transaction.commit();
    });
  }
}
