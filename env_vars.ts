import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env_vars";

export interface EnvVars extends ClusterEnvVars {
  spannerInstanceId?: string;
  spannerDatabaseId?: string;
  passwordSignerSecretFile?: string;
  r2AvatarBucketName?: string;
  // Without trailing slash
  r2AvatarPublicAccessOrigin?: string;
  emailVerificationEmailTemplateId?: string;
  passwordResetEmailTemplateId?: string;
  releaseServiceName?: string;
  port?: number;
  builderAccount?: string;
  serviceAccount?: string;
  replicas?: number;
  cpu?: string;
  memory?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
