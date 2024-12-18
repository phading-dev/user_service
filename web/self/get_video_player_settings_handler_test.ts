import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteVideoPlaySettingsStatement,
  insertNewVideoPlayerSettingsStatement,
} from "../../db/sql";
import { GetVideoPlayerSettingsHandler } from "./get_video_player_settings_handler";
import { GET_VIDEO_PLAYER_SETTINGS_RESPONSE } from "@phading/user_service_interface/web/self/interface";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetVideoPlaySettignsHandlerTest",
  cases: [
    {
      name: "NoSettings",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new GetVideoPlayerSettingsHandler(
          SPANNER_DATABASE,
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              settings: {},
            },
            GET_VIDEO_PLAYER_SETTINGS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {},
    },
    {
      name: "ReturnSettings",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transction) => {
          await transction.batchUpdate([
            insertNewVideoPlayerSettingsStatement("account1", {
              videoSettings: {
                playbackSpeed: 10,
              },
            }),
          ]);
          await transction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new GetVideoPlayerSettingsHandler(
          SPANNER_DATABASE,
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              settings: {
                videoSettings: {
                  playbackSpeed: 10,
                },
              },
            },
            GET_VIDEO_PLAYER_SETTINGS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transction) => {
          await transction.batchUpdate([
            deleteVideoPlaySettingsStatement("account1"),
          ]);
          await transction.commit();
        });
      },
    },
  ],
});
