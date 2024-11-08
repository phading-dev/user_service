import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteVideoPlaySettingsStatement,
  getVideoPlayerSettings,
} from "../../db/sql";
import { SaveVideoPlayerSettingsHandler } from "./save_video_player_settings_handler";
import { VIDEO_PLAYER_SETTINGS } from "@phading/user_service_interface/frontend/self/video_player_settings";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SaveVideoPlayerSettingsHandlerTest",
  cases: [
    {
      name: "AddNewSettings_UpdateSettings",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            accountId: "account1",
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new SaveVideoPlayerSettingsHandler(
          SPANNER_DATABASE,
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            settings: {
              videoSettings: {
                playbackSpeed: 1,
              },
            },
          },
          "session1",
        );

        // Verify
        let [settings] = await getVideoPlayerSettings(
          SPANNER_DATABASE,
          "account1",
        );
        assertThat(
          settings.videoPlayerSettingsSettings,
          eqMessage(
            {
              videoSettings: {
                playbackSpeed: 1,
              },
            },
            VIDEO_PLAYER_SETTINGS,
          ),
          "settings",
        );

        // Execute
        await handler.handle(
          "",
          {
            settings: {
              videoSettings: {
                playbackSpeed: 10,
              },
            },
          },
          "session1",
        );

        // Verify
        [settings] = await getVideoPlayerSettings(SPANNER_DATABASE, "account1");
        assertThat(
          settings.videoPlayerSettingsSettings,
          eqMessage(
            {
              videoSettings: {
                playbackSpeed: 10,
              },
            },
            VIDEO_PLAYER_SETTINGS,
          ),
          "settings 2",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteVideoPlaySettingsStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
