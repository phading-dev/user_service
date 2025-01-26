import { toCapabilities } from "../../common/capabilities_converter";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getAccount } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SwitchAccountHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SwitchAccountRequestBody,
  SwitchAccountResponse,
} from "@phading/user_service_interface/web/self/interface";
import {
  createSession,
  exchangeSessionAndCheckCapability,
} from "@phading/user_session_service_interface/node/client";
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
    let { userId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = await getAccount(this.database, body.accountId);
    if (rows.length === 0) {
      throw newNotFoundError(`Account ${body.accountId} is not found.`);
    }
    let { accountData } = rows[0];
    if (accountData.userId !== userId) {
      throw newForbiddenError(
        `Not authorized to switch to account ${body.accountId} owned by a different user.`,
      );
    }
    let response = await createSession(this.serviceClient, {
      userId: userId,
      accountId: body.accountId,
      capabilitiesVersion: accountData.capabilitiesVersion,
      capabilities: toCapabilities(accountData),
    });
    return {
      signedSession: response.signedSession,
    };
  }
}
