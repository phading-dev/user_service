import crypto = require("crypto");

export class PasswordSigner {
  public static SECRET_KEY = "some secrets";
  private static ALGORITHM = "sha256";

  public sign(password: string): string {
    return crypto
      .createHmac(PasswordSigner.ALGORITHM, PasswordSigner.SECRET_KEY)
      .update(password)
      .digest("base64");
  }
}
