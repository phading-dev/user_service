import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { updateAccountDescriptionStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  DESCRIPTION_LIMIT,
} from "@phading/constants/account";
import { UpdateAccountDescriptionHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateAccountDescriptionRequestBody,
  UpdateAccountDescriptionResponse,
} from "@phading/user_service_interface/web/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateAccountDescriptionHandler extends UpdateAccountDescriptionHandlerInterface {
  public static create(): UpdateAccountDescriptionHandler {
    return new UpdateAccountDescriptionHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdateAccountDescriptionRequestBody,
    sessionStr: string,
  ): Promise<UpdateAccountDescriptionResponse> {
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
        updateAccountDescriptionStatement(
          accountId,
          body.description,
        ),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
