import http = require("http");
import { initPasswordSigner } from "./common/password_signer";
import { initS3Client } from "./common/s3_client";
import { ENV_VARS } from "./env_vars";
import { GetAccountContactHandler } from "./node/get_account_contact_handler";
import { ListAccountCapabilitiesUpdatingTasksHandler } from "./node/list_account_capabilities_updating_tasks_handler";
import { ListAvatarImageDeletingTasksHandler } from "./node/list_avatar_image_deleting_tasks_handler";
import { ListPaymentProfileCreatingTasksHandler } from "./node/list_payment_profile_creating_tasks_handler";
import { ListPayoutProfileCreatingTasksHandler } from "./node/list_payout_profile_creating_tasks_handler";
import { ProcessAccountCapabilitiesUpdatingTaskHandler } from "./node/process_account_capabilities_updating_task_handler";
import { ProcessAvatarImageDeletingTaskHandler } from "./node/process_avatar_image_deleting_task_handler";
import { ProcessPaymentProfileCreatingTaskHandler } from "./node/process_payment_profile_creating_task_handler";
import { ProcessPayoutProfileCreatingTaskHandler } from "./node/process_payout_profile_creating_tasks_handler";
import { SyncPaymentProfileStateHandler } from "./node/sync_payment_profile_state_handler";
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
import { UpdateRecoveryEmailHandler } from "./web/self/update_recovery_email_handler";
import { UploadAccountAvatarHandler } from "./web/self/upload_account_avatar_handler";
import { GetAccountDetailsHandler } from "./web/third_person/get_account_details_handler";
import { GetAccountSummaryHandler } from "./web/third_person/get_account_summary_handler";
import { SearchPublishersHandler } from "./web/third_person/search_publishers_handler";
import {
  USER_NODE_SERVICE,
  USER_WEB_SERVICE,
} from "@phading/user_service_interface/service";
import { ServiceHandler } from "@selfage/service_handler/service_handler";

async function main() {
  await Promise.all([initPasswordSigner(), initS3Client()]);
  let service = ServiceHandler.create(
    http.createServer(),
    ENV_VARS.externalOrigin,
  )
    .addCorsAllowedPreflightHandler()
    .addHealthCheckHandler()
    .addReadinessHandler()
    .addMetricsHandler();
  service
    .addHandlerRegister(USER_NODE_SERVICE)
    .add(GetAccountContactHandler.create())
    .add(ListAccountCapabilitiesUpdatingTasksHandler.create())
    .add(ListAvatarImageDeletingTasksHandler.create())
    .add(ListPaymentProfileCreatingTasksHandler.create())
    .add(ListPayoutProfileCreatingTasksHandler.create())
    .add(ProcessAccountCapabilitiesUpdatingTaskHandler.create())
    .add(ProcessAvatarImageDeletingTaskHandler.create())
    .add(ProcessPaymentProfileCreatingTaskHandler.create())
    .add(ProcessPayoutProfileCreatingTaskHandler.create())
    .add(SyncPaymentProfileStateHandler.create());
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
    .add(UpdateRecoveryEmailHandler.create())
    .add(UploadAccountAvatarHandler.create())
    .add(GetAccountDetailsHandler.create())
    .add(GetAccountSummaryHandler.create())
    .add(SearchPublishersHandler.create());
  await service.start(ENV_VARS.port);
}

main();
