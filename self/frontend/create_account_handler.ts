import crypto = require("crypto");
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_PATH,
  DEFAULT_ACCOUNT_AVATAR_SMALL_PATH,
} from "../../common/constants";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { insertNewAccount } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreateAccountHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  CreateAccountRequestBody,
  CreateAccountResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import {
  createClientSession,
  exchangeSessionAndCheckCapability,
} from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class CreateAccountHandler extends CreateAccountHandlerInterface {
  public static create(): CreateAccountHandler {
    return new CreateAccountHandler(SPANNER_DATABASE, SERVICE_CLIENT, () =>
      crypto.randomUUID(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private generateUuid: () => string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreateAccountRequestBody,
    sessionStr: string,
  ): Promise<CreateAccountResponse> {
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    let accountId = this.generateUuid();
    await insertNewAccount(
      (query) => this.database.run(query),
      userSession.userId,
      accountId,
      body.accountType,
      body.naturalName,
      body.contactEmail,
      DEFAULT_ACCOUNT_AVATAR_SMALL_PATH,
      DEFAULT_ACCOUNT_AVATAR_LARGE_PATH,
    );

    let signedSession = (
      await createClientSession(this.serviceClient, {
        userId: userSession.userId,
        accountId,
        accountType: body.accountType,
      })
    ).signedSession;
    return {
      signedSession,
    };
  }
}
