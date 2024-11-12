import { getEnvVar } from "@selfage/env_var_getter";

export let PROJECT_ID = getEnvVar("PROJECT_ID").required().asString();
export let INSTANCE_ID = getEnvVar("INSTANCE_ID").required().asString();
export let DATABASE_ID = getEnvVar("DATABASE_ID").required().asString();
export let R2_ENDPOINT = getEnvVar("R2_ENDPOINT").required().asString();
export let R2_ACCESS_KEY_ID = getEnvVar("R2_ACCESS_KEY_ID")
  .required()
  .asString();
export let R2_SECRET_ACCESS_KEY = getEnvVar("R2_SECRET_ACCESS_KEY")
  .required()
  .asString();
export let ACCOUNT_AVATAR_BUCKET_NAME = getEnvVar("ACCOUNT_AVATAR_BUCKET_NAME")
  .required()
  .asString();
// Includes https:// and trailing /
export let ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN = getEnvVar(
  "ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN",
)
  .required()
  .asString();
