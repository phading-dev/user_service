import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountById } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SwitchAccountHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  SwitchAccountRequestBody,
  SwitchAccountResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import {
  createSession,
  exchangeSessionAndCheckCapability,
} from "@phading/user_session_service_interface/backend/client";
import { newForbiddenError, newNotFoundError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SwitchAccountHandler extends SwitchAccountHandlerInterface {
  public static create(): SwitchAccountHandler {
    return new SwitchAccountHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SwitchAccountRequestBody,
    sessionStr: string,
  ): Promise<SwitchAccountResponse> {
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    let rows = await getAccountById(
      (query) => this.database.run(query),
      body.accountId,
    );
    if (rows.length === 0) {
      throw newNotFoundError(`Account ${body.accountId} is not found.`);
    }
    if (rows[0].accountUserId !== userSession.userId) {
      throw newForbiddenError(
        `Not authorized to switch to account ${body.accountId}.`,
      );
    }
    let response = await createSession(this.serviceClient, {
      userId: userSession.userId,
      accountId: body.accountId,
      accountType: rows[0].accountAccountType,
    });
    return {
      signedSession: response.signedSession,
    };
  }
}
