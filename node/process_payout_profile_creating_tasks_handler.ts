import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deletePayoutProfileCreatingTaskStatement,
  getPayoutProfileCreatingTaskMetadata,
  updatePayoutProfileCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { newCreatePayoutProfileRequest } from "@phading/commerce_service_interface/node/client";
import { ProcessPayoutProfileCreatingTaskHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  ProcessPayoutProfileCreatingTaskRequestBody,
  ProcessPayoutProfileCreatingTaskResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPayoutProfileCreatingTaskHandler extends ProcessPayoutProfileCreatingTaskHandlerInterface {
  public static create(): ProcessPayoutProfileCreatingTaskHandler {
    return new ProcessPayoutProfileCreatingTaskHandler(
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
    body: ProcessPayoutProfileCreatingTaskRequestBody,
  ): Promise<ProcessPayoutProfileCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payout profile creating task for account ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPayoutProfileCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPayoutProfileCreatingTaskMetadata(transaction, {
        payoutProfileCreatingTaskAccountIdEq: body.accountId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePayoutProfileCreatingTaskMetadataStatement({
          payoutProfileCreatingTaskAccountIdEq: body.accountId,
          setRetryCount: task.payoutProfileCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.payoutProfileCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPayoutProfileCreatingTaskRequestBody,
  ): Promise<void> {
    await this.serviceClient.send(
      newCreatePayoutProfileRequest({
        accountId: body.accountId,
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deletePayoutProfileCreatingTaskStatement({
          payoutProfileCreatingTaskAccountIdEq: body.accountId,
        }),
      ]);
      await transaction.commit();
    });
  }
}
