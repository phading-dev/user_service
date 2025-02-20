import { ENV_VARS } from "./env";
import "./env_const";
import "@phading/cluster/env_dev";

ENV_VARS.databaseInstanceId = "test";
ENV_VARS.accountAvatarR2BucketName = "avatar-dev";
ENV_VARS.accountAvatarR2PublicAccessDomain = "avatar-dev.phading.org";
