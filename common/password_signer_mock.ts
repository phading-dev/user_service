import { PasswordSigner } from "./password_signer";

export class PasswordSignerMock extends PasswordSigner {
  public password: string;
  public signed: string;

  public sign(password: string): string {
    this.password = password;
    return this.signed;
  }
}
