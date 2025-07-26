import "../env_const";
import "@phading/cluster/prod/env";
import { ENV_VARS } from "../env_vars";

ENV_VARS.spannerInstanceId = ENV_VARS.balancedSpannerInstanceId;
ENV_VARS.r2AvatarBucketName = "avatar";
ENV_VARS.r2AvatarPublicAccessOrigin = "https://avatar-prod.secount.com";
ENV_VARS.emailVerificationEmailTemplateId = "d-6f063cbe264b4dfd877d6ecf3f5843cc";
ENV_VARS.passwordResetEmailTemplateId = "d-e5fe5fbe7e944f8981497009ba1cb8bc";
ENV_VARS.replicas = 2;
ENV_VARS.cpu = "200m";
ENV_VARS.memory = "256Mi";
