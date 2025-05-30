import crypto = require("crypto");
import { PASSWORD_SIGNER, PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUserByUsername, insertUserStatement } from "../../db/sql";
import { createAccount } from "./common/create_account";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import {
  MAX_EMAIL_LENGTH,
  MAX_NATURAL_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
} from "@phading/constants/account";
import { SignUpHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SignUpRequestBody,
  SignUpResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newCreateSessionRequest } from "@phading/user_session_service_interface/node/client";
import { CreateSessionRequestBody } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SignUpHandler extends SignUpHandlerInterface {
  public static create(): SignUpHandler {
    return new SignUpHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      PASSWORD_SIGNER,
      () => crypto.randomUUID(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
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
    body.username = (body.username ?? "").trim();
    if (!body.username) {
      throw newBadRequestError(`"username" cannot be empty.`);
    }
    if (body.username.length > MAX_USERNAME_LENGTH) {
      throw newBadRequestError(`"username" is too long.`);
    }
    body.recoveryEmail = (body.recoveryEmail ?? "").trim();
    if (!body.recoveryEmail) {
      throw newBadRequestError(`"recoveryEmail" cannot be empty.`);
    }
    if (body.recoveryEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"recoveryEmail" is too long.`);
    }
    if (!body.password) {
      throw newBadRequestError(`"password" is required.`);
    }
    if (body.password.length > MAX_PASSWORD_LENGTH) {
      throw newBadRequestError(`"password" is too long.`);
    }
    body.naturalName = (body.naturalName ?? "").trim();
    if (!body.naturalName) {
      throw newBadRequestError(`"naturalName" cannot be empty.`);
    }
    if (body.naturalName.length > MAX_NATURAL_NAME_LENGTH) {
      throw newBadRequestError(`"naturalName" is too long.`);
    }
    body.contactEmail = (body.contactEmail ?? "").trim();
    if (!body.contactEmail) {
      throw newBadRequestError(`"contactEmail" cannot be empty.`);
    }
    if (body.contactEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"contactEmail" is too long.`);
    }
    if (!body.accountType) {
      throw newBadRequestError(`"accountType" is required.`);
    }
    let userId = this.generateUuid();
    let usernameIsAvailable = true;
    let request: CreateSessionRequestBody;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getUserByUsername(transaction, {
        userUsernameEq: body.username,
      });
      if (rows.length > 0) {
        usernameIsAvailable = false;
        return;
      }
      let passwordHash = this.passwordSigner.sign(body.password);
      let statements = new Array<Statement>();
      let now = this.getNow();
      statements.push(
        insertUserStatement({
          userId,
          username: body.username,
          passwordHashV1: passwordHash,
          recoveryEmail: body.recoveryEmail,
          totalAccounts: 1,
          createdTimeMs: now,
        }),
      );
      request = createAccount(
        userId,
        this.generateUuid(),
        body.accountType,
        body.naturalName,
        body.contactEmail,
        now,
        statements,
      );
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    if (!usernameIsAvailable) {
      return {
        usernameIsAvailable: false,
      };
    }

    let response = await this.serviceClient.send(
      newCreateSessionRequest(request),
    );
    return {
      signedSession: response.signedSession,
      usernameIsAvailable: true,
    };
  }
}
