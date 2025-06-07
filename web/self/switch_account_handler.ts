import { toCapabilities } from "../../common/capabilities_converter";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getOwnedAccountMain,
  updateAccountLastAccessedTimeStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SwitchAccountHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SwitchAccountRequestBody,
  SwitchAccountResponse,
} from "@phading/user_service_interface/web/self/interface";
import {
  newCreateSessionRequest,
  newFetchSessionAndCheckCapabilityRequest,
} from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SwitchAccountHandler extends SwitchAccountHandlerInterface {
  public static create(): SwitchAccountHandler {
    return new SwitchAccountHandler(SPANNER_DATABASE, SERVICE_CLIENT, () =>
      Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SwitchAccountRequestBody,
    authStr: string,
  ): Promise<SwitchAccountResponse> {
    if (!body.accountId) {
      throw newBadRequestError(`"accountId" is required.`);
    }
    let { userId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let rows = await getOwnedAccountMain(this.database, {
      accountUserIdEq: userId,
      accountAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      return {
        notFound: true,
      };
    }
    let row = rows[0];
    let [_, response] = await Promise.all([
      this.updateLastAccessedTimestmap(body.accountId),
      this.serviceClient.send(
        newCreateSessionRequest({
          userId: userId,
          accountId: body.accountId,
          capabilitiesVersion: row.accountCapabilitiesVersion,
          capabilities: toCapabilities(
            row.accountAccountType,
            row.accountPaymentProfileState,
          ),
        }),
      ),
    ]);
    return {
      signedSession: response.signedSession,
    };
  }

  private async updateLastAccessedTimestmap(accountId: string): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateAccountLastAccessedTimeStatement({
          accountAccountIdEq: accountId,
          setLastAccessedTimeMs: this.getNow(),
        }),
      ]);
      await transaction.commit();
    });
  }
}
