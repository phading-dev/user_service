import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteBillingAccountCreatingTaskStatement,
  getBillingAccountCreatingTaskMetadata,
  updateBillingAccountCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { newCreateBillingAccountRequest } from "@phading/commerce_service_interface/node/client";
import { ProcessBillingAccountCreatingTaskHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ProcessBillingAccountCreatingTaskRequestBody,
  ProcessBillingAccountCreatingTaskResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessBillingAccountCreatingTaskHandler extends ProcessBillingAccountCreatingTaskHandlerInterface {
  public static create(): ProcessBillingAccountCreatingTaskHandler {
    return new ProcessBillingAccountCreatingTaskHandler(
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
    body: ProcessBillingAccountCreatingTaskRequestBody,
  ): Promise<ProcessBillingAccountCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing account creating task for account ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessBillingAccountCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingAccountCreatingTaskMetadata(transaction, {
        billingAccountCreatingTaskAccountIdEq: body.accountId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateBillingAccountCreatingTaskMetadataStatement({
          billingAccountCreatingTaskAccountIdEq: body.accountId,
          setRetryCount: task.billingAccountCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.billingAccountCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessBillingAccountCreatingTaskRequestBody,
  ): Promise<void> {
    await this.serviceClient.send(
      newCreateBillingAccountRequest({
        accountId: body.accountId,
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingAccountCreatingTaskStatement({
          billingAccountCreatingTaskAccountIdEq: body.accountId,
        }),
      ]);
      await transaction.commit();
    });
  }
}
