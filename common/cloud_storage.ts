import { ACCOUNT_AVATAR_BUCKET_NAME } from "./constants";
import { Storage } from "@google-cloud/storage";

export let ACCOUNT_AVATAR_BUCKET = new Storage().bucket(
  ACCOUNT_AVATAR_BUCKET_NAME,
);
