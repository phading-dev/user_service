import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getAccountAndMoreById,
  updateAccountMoreStatement,
  updateAccountStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_NATURAL_NAME_LENGTH,
} from "@phading/constants/account";
import { UpdateAccountHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateAccountRequestBody,
  UpdateAccountResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newNotFoundError } from "@selfage/http_error";
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
    if (!body.naturalName) {
      throw newBadRequestError(`"naturalName" is required.`);
    }
    if (body.naturalName.length > MAX_NATURAL_NAME_LENGTH) {
      throw newBadRequestError(`"naturalName" is too long.`);
    }
    if (!body.contactEmail) {
      throw newBadRequestError(`"contactEmail" is required.`);
    }
    if (body.contactEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"contactEmail" is too long.`);
    }
    body.description ??= "";
    if (body.description.length > MAX_DESCRIPTION_LENGTH) {
      throw newBadRequestError(`"descrition" is too long.`);
    }
    let { accountId } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let accountRows = await getAccountAndMoreById(transaction, accountId);
      if (accountRows.length === 0) {
        throw newNotFoundError(`Account ${accountId} is not found.`);
      }
      let { aData, amData } = accountRows[0];
      aData.naturalName = body.naturalName;
      aData.contactEmail = body.contactEmail;
      amData.description = body.description;
      await transaction.batchUpdate([
        updateAccountStatement(aData),
        updateAccountMoreStatement(amData),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
