import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getVideoPlayerSettings } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetVideoPlayerSettingsHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  GetVideoPlayerSettingsRequestBody,
  GetVideoPlayerSettingsResponse,
} from "@phading/user_service_interface/web/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class GetVideoPlayerSettingsHandler extends GetVideoPlayerSettingsHandlerInterface {
  public static create(): GetVideoPlayerSettingsHandler {
    return new GetVideoPlayerSettingsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetVideoPlayerSettingsRequestBody,
    sessionStr: string,
  ): Promise<GetVideoPlayerSettingsResponse> {
    let { accountId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = await getVideoPlayerSettings(this.database, accountId);
    if (rows.length === 0) {
      return {
        settings: {},
      };
    } else {
      return {
        settings: rows[0].videoPlayerSettingsSettings,
      };
    }
  }
}
