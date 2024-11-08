import { PROJECT_ID } from "./env_vars";
import { Storage } from "@google-cloud/storage";

export let STORAGE = new Storage({
  projectId: PROJECT_ID,
});
