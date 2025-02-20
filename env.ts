import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env";

export interface EnvVars extends ClusterEnvVars {
  databaseInstanceId?: string;
  databaseId?: string;
  passwordSignerSecretFile?: string;
  r2AvatarBucketName?: string;
  r2AvatarPublicAccessDomain?: string;
  releaseServiceName?: string;
  port?: number;
  builderAccount?: string;
  serviceAccount?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
