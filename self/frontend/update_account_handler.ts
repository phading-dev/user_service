import { USER_SESSION_SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  updateAccountDescription,
  updateContactEmail,
  updateNaturalName,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { UpdateAccountHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  UpdateAccountRequestBody,
  UpdateAccountResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateAccountHandler extends UpdateAccountHandlerInterface {
  public static create(): UpdateAccountHandler {
    return new UpdateAccountHandler(
      SPANNER_DATABASE,
      USER_SESSION_SERVICE_CLIENT,
    );
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
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    await this.database.runTransactionAsync(async (transaction) => {
      await Promise.all([
        updateNaturalName(
          (query) => transaction.run(query),
          body.naturalName,
          userSession.accountId,
        ),
        updateContactEmail(
          (query) => transaction.run(query),
          body.contactEmail,
          userSession.accountId,
        ),
        updateAccountDescription(
          (query) => transaction.run(query),
          body.description,
          userSession.accountId,
        ),
      ]);
      await transaction.commit();
    });
    return {};
  }
}