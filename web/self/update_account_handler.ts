import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { updateAccountContentStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from "@phading/constants/account";
import { UpdateAccountHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateAccountRequestBody,
  UpdateAccountResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateAccountHandler extends UpdateAccountHandlerInterface {
  public static create(): UpdateAccountHandler {
    return new UpdateAccountHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdateAccountRequestBody,
    authStr: string,
  ): Promise<UpdateAccountResponse> {
    body.name = (body.name ?? "").trim();
    if (!body.name) {
      throw newBadRequestError(`"name" cannot be empty.`);
    }
    if (body.name.length > MAX_NAME_LENGTH) {
      throw newBadRequestError(`"name" is too long.`);
    }
    body.description = (body.description ?? "").trim();
    if (body.description.length > MAX_DESCRIPTION_LENGTH) {
      throw newBadRequestError(`"description" is too long.`);
    }
    let { accountId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateAccountContentStatement({
          accountAccountIdEq: accountId,
          setName: body.name,
          setDescription: body.description,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
