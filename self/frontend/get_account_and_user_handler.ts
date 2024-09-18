import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountAndUser } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetAccountAndUserHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  GetAccountAndUserRequestBody,
  GetAccountAndUserResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class GetAccountAndUserHandler extends GetAccountAndUserHandlerInterface {
  public static create(): GetAccountAndUserHandler {
    return new GetAccountAndUserHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountAndUserRequestBody,
    sessionStr: string,
  ): Promise<GetAccountAndUserResponse> {
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    let row = (
      await getAccountAndUser(
        (query) => this.database.run(query),
        userSession.userId,
        userSession.accountId,
      )
    )[0];
    return {
      account: {
        username: row.uUsername,
        recoveryEmail: row.uRecoveryEmail,
        naturalName: row.aNaturalName,
        contactEmail: row.aContactEmail,
        description: row.aDescription,
      },
    };
  }
}
