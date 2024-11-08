import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccountById } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SwitchAccountHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  SwitchAccountRequestBody,
  SwitchAccountResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import {
  createSession,
  exchangeSessionAndCheckCapability,
} from "@phading/user_session_service_interface/backend/client";
import {
  newBadRequestError,
  newForbiddenError,
  newNotFoundError,
} from "@selfage/http_error";
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
    if (!body.accountId) {
      throw newBadRequestError(`"accountId" is required.`);
    }
    let { userSession } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = await getAccountById(this.database, body.accountId);
    if (rows.length === 0) {
      throw newNotFoundError(`Account ${body.accountId} is not found.`);
    }
    if (rows[0].accountUserId !== userSession.userId) {
      throw newForbiddenError(
        `Not authorized to switch to account ${body.accountId} owned by a different user.`,
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
