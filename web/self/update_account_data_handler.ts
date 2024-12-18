import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountById, updateAccountDataStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  DESCRIPTION_LIMIT,
  EMAIL_LIMIT,
  NATURAL_NAME_LIMIT,
} from "@phading/constants/account";
import { UpdateAccountDataHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateAccountDataRequestBody,
  UpdateAccountDataResponse,
} from "@phading/user_service_interface/web/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newNotFoundError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateAccountDataHandler extends UpdateAccountDataHandlerInterface {
  public static create(): UpdateAccountDataHandler {
    return new UpdateAccountDataHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdateAccountDataRequestBody,
    sessionStr: string,
  ): Promise<UpdateAccountDataResponse> {
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
      let accountRows = await getAccountById(transaction, accountId);
      if (accountRows.length === 0) {
        throw newNotFoundError(`Account ${accountId} is not found.`);
      }
      let accountData = accountRows[0].accountData;
      await transaction.batchUpdate([
        updateAccountDataStatement(accountId, {
          naturalName: body.naturalName,
          contactEmail: body.contactEmail,
          avatarSmallFilename: accountData.avatarSmallFilename,
          avatarLargeFilename: accountData.avatarLargeFilename,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
