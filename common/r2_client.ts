import {
  R2_ACCESS_KEY_ID,
  R2_ENDPOINT,
  R2_SECRET_ACCESS_KEY,
} from "./env_vars";
import { S3Client } from "@aws-sdk/client-s3";

export let R2_CLIENT = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});
