import http = require("http");
import { initPasswordSigner } from "./common/password_signer";
import { initS3Client } from "./common/s3_client";
import { ENV_VARS } from "./env_vars";
import { GetAccountContactHandler } from "./node/get_account_contact_handler";
import { ListAccountCapabilitiesUpdatingTasksHandler } from "./node/list_account_capabilities_updating_tasks_handler";
import { ProcessAccountCapabilitiesUpdatingTaskHandler } from "./node/process_account_capabilities_updating_task_handler";
import { ProcessBillingAccountCreatingTaskHandler } from "./node/process_billing_account_creating_task_handler";
import { SyncBillingAccountStateHandler } from "./node/sync_billing_account_state_handler";
import { CreateAccountHandler } from "./web/self/create_account_handler";
import { GetAccountAndUserHandler } from "./web/self/get_account_and_user_handler";
import { GetVideoPlayerSettingsHandler } from "./web/self/get_video_player_settings_handler";
import { ListAccountsHandler } from "./web/self/list_accounts_handler";
import { SaveVideoPlayerSettingsHandler } from "./web/self/save_video_player_settings_handler";
import { SignInHandler } from "./web/self/sign_in_handler";
import { SignUpHandler } from "./web/self/sign_up_handler";
import { SwitchAccountHandler } from "./web/self/switch_account_handler";
import { UpdateAccountHandler } from "./web/self/update_account_handler";
import { UpdatePasswordHandler } from "./web/self/update_password_handler";
import { UploadAccountAvatarHandler } from "./web/self/upload_account_avatar_handler";
import { GetAccountSummaryHandler } from "./web/third_person/get_account_summary_handler";
import { SearchAccountsHandler } from "./web/third_person/search_accounts_handler";
import {
  USER_NODE_SERVICE,
  USER_WEB_SERVICE,
} from "@phading/user_service_interface/service";
import { ServiceHandler } from "@selfage/service_handler/service_handler";

async function main() {
  await Promise.all([initPasswordSigner(), initS3Client()]);
  let service = ServiceHandler.create(http.createServer())
    .addCorsAllowedPreflightHandler()
    .addHealthCheckHandler()
    .addMetricsHandler();
  service
    .addHandlerRegister(USER_NODE_SERVICE)
    .add(GetAccountContactHandler.create())
    .add(ListAccountCapabilitiesUpdatingTasksHandler.create())
    .add(ProcessAccountCapabilitiesUpdatingTaskHandler.create())
    .add(ProcessBillingAccountCreatingTaskHandler.create())
    .add(SyncBillingAccountStateHandler.create());
  service
    .addHandlerRegister(USER_WEB_SERVICE)
    .add(CreateAccountHandler.create())
    .add(GetAccountAndUserHandler.create())
    .add(GetVideoPlayerSettingsHandler.create())
    .add(ListAccountsHandler.create())
    .add(SaveVideoPlayerSettingsHandler.create())
    .add(SignInHandler.create())
    .add(SignUpHandler.create())
    .add(SwitchAccountHandler.create())
    .add(UpdateAccountHandler.create())
    .add(UpdatePasswordHandler.create())
    .add(UploadAccountAvatarHandler.create())
    .add(GetAccountSummaryHandler.create())
    .add(SearchAccountsHandler.create());
  await service.start(ENV_VARS.port);
}

main();
