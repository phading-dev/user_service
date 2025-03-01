import "../env_const";
import "@phading/cluster/dev/env";
import { ENV_VARS } from "../env_vars";

ENV_VARS.spannerInstanceId = "test";
ENV_VARS.r2AvatarBucketName = "avatar-dev";
ENV_VARS.r2AvatarPublicAccessDomain = "avatar-dev.phading.org";
