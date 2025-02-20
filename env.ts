import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env";

export interface EnvVars extends ClusterEnvVars {
  databaseInstanceId?: string;
  databaseId?: string;
  passwordSignerSecretFile?: string;
  accountAvatarR2BucketName?: string;
  accountAvatarR2PublicAccessDomain?: string;
  releaseServiceName?: string;
  port?: number;
  builderAccount?: string;
  serviceAccount?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
