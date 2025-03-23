import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteBillingProfileCreatingTaskStatement,
  getBillingProfileCreatingTaskMetadata,
  updateBillingProfileCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { newCreateBillingProfileRequest } from "@phading/commerce_service_interface/node/client";
import { ProcessBillingProfileCreatingTaskHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ProcessBillingProfileCreatingTaskRequestBody,
  ProcessBillingProfileCreatingTaskResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessBillingProfileCreatingTaskHandler extends ProcessBillingProfileCreatingTaskHandlerInterface {
  public static create(): ProcessBillingProfileCreatingTaskHandler {
    return new ProcessBillingProfileCreatingTaskHandler(
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
    body: ProcessBillingProfileCreatingTaskRequestBody,
  ): Promise<ProcessBillingProfileCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing profile creating task for account ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessBillingProfileCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingProfileCreatingTaskMetadata(transaction, {
        billingProfileCreatingTaskAccountIdEq: body.accountId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateBillingProfileCreatingTaskMetadataStatement({
          billingProfileCreatingTaskAccountIdEq: body.accountId,
          setRetryCount: task.billingProfileCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.billingProfileCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessBillingProfileCreatingTaskRequestBody,
  ): Promise<void> {
    await this.serviceClient.send(
      newCreateBillingProfileRequest({
        accountId: body.accountId,
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingProfileCreatingTaskStatement({
          billingProfileCreatingTaskAccountIdEq: body.accountId,
        }),
      ]);
      await transaction.commit();
    });
  }
}
