import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env";

export interface EnvVars extends ClusterEnvVars {
  releaseServiceName?: string;
  port?: number;
  databaseInstanceId?: string;
  databaseId?: string;
  passwordSignerSecretFile?: string;
  cloudflareAccountIdFile?: string;
  cloudflareR2AccessKeyIdFile?: string;
  cloudflareR2SecretAccessKeyFile?: string;
  accountAvatarR2BucketName?: string;
  accountAvatarR2PublicAccessDomain?: string;
  builderAccount?: string;
  serviceAccount?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
