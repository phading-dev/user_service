import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  GET_VIDEO_PLAYER_SETTINGS_ROW,
  deleteVideoPlayerSettingsStatement,
  getVideoPlayerSettings,
} from "../../db/sql";
import { SaveVideoPlayerSettingsHandler } from "./save_video_player_settings_handler";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, isArray } from "@selfage/test_matcher";
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
          accountId: "account1",
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
        assertThat(
          await getVideoPlayerSettings(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                videoPlayerSettingsSettings: {
                  videoSettings: {
                    playbackSpeed: 1,
                  },
                },
              },
              GET_VIDEO_PLAYER_SETTINGS_ROW,
            ),
          ]),
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
        assertThat(
          await getVideoPlayerSettings(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                videoPlayerSettingsSettings: {
                  videoSettings: {
                    playbackSpeed: 10,
                  },
                },
              },
              GET_VIDEO_PLAYER_SETTINGS_ROW,
            ),
          ]),
          "settings 2",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteVideoPlayerSettingsStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
