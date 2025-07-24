import crypto = require("crypto");
import { PASSWORD_SIGNER, PasswordSigner } from "../../common/password_signer";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUserByUserEmail, insertUserStatement } from "../../db/sql";
import { createAccount } from "./common/create_account";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@phading/constants/account";
import { SignUpHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SignUpRequestBody,
  SignUpResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newBadRequestError } from "@selfage/http_error";

export class SignUpHandler extends SignUpHandlerInterface {
  public static create(): SignUpHandler {
    return new SignUpHandler(
      SPANNER_DATABASE,
      PASSWORD_SIGNER,
      () => crypto.randomUUID(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private passwordSigner: PasswordSigner,
    private generateUuid: () => string,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SignUpRequestBody,
  ): Promise<SignUpResponse> {
    body.userEmail = (body.userEmail ?? "").trim();
    if (!body.userEmail) {
      throw newBadRequestError(`"userEmail" cannot be empty.`);
    }
    if (body.userEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"userEmail" is too long.`);
    }
    if (!body.password) {
      throw newBadRequestError(`"password" is required.`);
    }
    if (body.password.length > MAX_PASSWORD_LENGTH) {
      throw newBadRequestError(`"password" is too long.`);
    }
    body.name = (body.name ?? "").trim();
    if (!body.name) {
      throw newBadRequestError(`"name" cannot be empty.`);
    }
    if (body.name.length > MAX_NAME_LENGTH) {
      throw newBadRequestError(`"name" is too long.`);
    }
    if (!body.accountType) {
      throw newBadRequestError(`"accountType" is required.`);
    }
    let userId = this.generateUuid();
    let userEmailUnavailable = false;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getUserByUserEmail(transaction, {
        userUserEmailEq: body.userEmail,
      });
      if (rows.length > 0) {
        userEmailUnavailable = true;
        return;
      }
      let passwordHash = this.passwordSigner.sign(body.password);
      let statements = new Array<Statement>();
      let now = this.getNow();
      statements.push(
        insertUserStatement({
          userId,
          userEmail: body.userEmail,
          emailVerified: false,
          passwordHashV1: passwordHash,
          totalAccounts: 1,
          createdTimeMs: now,
        }),
      );
      createAccount(
        userId,
        this.generateUuid(),
        body.accountType,
        body.name,
        body.userEmail,
        now,
        statements,
      );
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    if (userEmailUnavailable) {
      return {
        userEmailUnavailable: true,
      };
    }
    return {};
  }
}
