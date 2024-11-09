import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { updateAccountInfoStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  DESCRIPTION_LIMIT,
  EMAIL_LIMIT,
  NATURAL_NAME_LIMIT,
} from "@phading/constants/account";
import { UpdateAccountHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  UpdateAccountRequestBody,
  UpdateAccountResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
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
    sessionStr: string,
  ): Promise<UpdateAccountResponse> {
    if (!body.naturalName) {
      throw newBadRequestError(`"naturalName" is required.`);
    }
    if (body.naturalName.length > NATURAL_NAME_LIMIT) {
      throw newBadRequestError(`"naturalName" is too long.`);
    }
    if (!body.contactEmail) {
      throw newBadRequestError(`"contactEmail" is required.`);
    }
    if (body.contactEmail.length > EMAIL_LIMIT) {
      throw newBadRequestError(`"contactEmail" is too long.`);
    }
    body.description ??= "";
    if (body.description.length > DESCRIPTION_LIMIT) {
      throw newBadRequestError(`"descrition" is too long.`);
    }
    let { accountId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateAccountInfoStatement(
          body.naturalName,
          body.contactEmail,
          body.description,
          accountId,
        ),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
