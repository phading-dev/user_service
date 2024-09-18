import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  checkPresenceVideoPlayerSettings,
  insertNewVideoPlayerSettings,
  updateVideoPlayerSettings,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SaveVideoPlayerSettingsHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  SaveVideoPlayerSettingsRequestBody,
  SaveVideoPlayerSettingsResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
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
    let { userSession } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await checkPresenceVideoPlayerSettings(
        (query) => transaction.run(query),
        userSession.accountId,
      );
      if (rows.length === 0) {
        await insertNewVideoPlayerSettings(
          (query) => transaction.run(query),
          userSession.accountId,
          body.settings,
        );
      } else {
        await updateVideoPlayerSettings(
          (query) => transaction.run(query),
          body.settings,
          userSession.accountId,
        );
      }
      await transaction.commit();
    });
    return {};
  }
}
