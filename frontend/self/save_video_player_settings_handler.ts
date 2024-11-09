import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  checkPresenceOfVideoPlayerSettings,
  insertNewVideoPlayerSettingsStatement,
  updateVideoPlayerSettingsStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SaveVideoPlayerSettingsHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  SaveVideoPlayerSettingsRequestBody,
  SaveVideoPlayerSettingsResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SaveVideoPlayerSettingsHandler extends SaveVideoPlayerSettingsHandlerInterface {
  public static create(): SaveVideoPlayerSettingsHandler {
    return new SaveVideoPlayerSettingsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SaveVideoPlayerSettingsRequestBody,
    sessionStr: string,
  ): Promise<SaveVideoPlayerSettingsResponse> {
    if (!body.settings) {
      throw newBadRequestError(`"settings" is required.`);
    }
    let { accountId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await checkPresenceOfVideoPlayerSettings(
        transaction,
        accountId,
      );
      if (rows.length === 0) {
        await transaction.batchUpdate([
          insertNewVideoPlayerSettingsStatement(accountId, body.settings),
        ]);
      } else {
        await transaction.batchUpdate([
          updateVideoPlayerSettingsStatement(body.settings, accountId),
        ]);
      }
      await transaction.commit();
    });
    return {};
  }
}
