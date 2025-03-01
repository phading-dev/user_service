import crypto = require("crypto");
import getStream = require("get-stream");
import { ENV_VARS } from "../env_vars";
import { STORAGE_CLIENT } from "./storage_client";

export class PasswordSigner {
  public static create(): PasswordSigner {
    return new PasswordSigner();
  }

  public static SECRET_KEY = "some secrets";
  private static ALGORITHM = "sha256";

  public sign(password: string): string {
    return crypto
      .createHmac(PasswordSigner.ALGORITHM, PasswordSigner.SECRET_KEY)
      .update(password)
      .digest("base64");
  }
}

export let PASSWORD_SIGNER = PasswordSigner.create();

export async function initPasswordSigner(): Promise<void> {
  let passwordSignerSecret = await getStream(
    STORAGE_CLIENT.bucket(ENV_VARS.gcsSecretBucketName)
      .file(ENV_VARS.passwordSignerSecretFile)
      .createReadStream(),
  );
  PasswordSigner.SECRET_KEY = passwordSignerSecret;
}
