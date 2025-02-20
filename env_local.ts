import { ENV_VARS } from "./env";
import "./env_const";
import "@phading/cluster/env_dev";

ENV_VARS.databaseInstanceId = "test";
ENV_VARS.r2AvatarBucketName = "avatar-dev";
ENV_VARS.r2AvatarPublicAccessDomain = "avatar-dev.phading.org";
