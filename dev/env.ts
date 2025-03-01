import "../env_const";
import "@phading/cluster/dev/env";
import { ENV_VARS } from "../env_vars";

ENV_VARS.spannerInstanceId = ENV_VARS.balancedSpannerInstanceId;
ENV_VARS.r2AvatarBucketName = "avatar-dev";
ENV_VARS.r2AvatarPublicAccessDomain = "avatar-dev.phading.org";
