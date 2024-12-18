import crypto = require("crypto");
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getUserByUsername,
  insertNewAccountStatement,
  insertNewUserStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  EMAIL_LIMIT,
  NATURAL_NAME_LIMIT,
  PASSWORD_LIMIT,
  USERNAME_LIMIT,
} from "@phading/constants/account";
import { SignUpHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SignUpRequestBody,
  SignUpResponse,
} from "@phading/user_service_interface/web/self/interface";
import { createSession } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SignUpHandler extends SignUpHandlerInterface {
  public static create(): SignUpHandler {
    return new SignUpHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      new PasswordSigner(),
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
    if (!body.username) {
      throw newBadRequestError(`"username" is required.`);
    }
    if (body.username.length > USERNAME_LIMIT) {
      throw newBadRequestError(`"username" is too long.`);
    }
    if (!body.recoveryEmail) {
      throw newBadRequestError(`"recoveryEmail" is required.`);
    }
    if (body.recoveryEmail.length > EMAIL_LIMIT) {
      throw newBadRequestError(`"recoveryEmail" is too long.`);
    }
    if (!body.password) {
      throw newBadRequestError(`"password" is required.`);
    }
    if (body.password.length > PASSWORD_LIMIT) {
      throw newBadRequestError(`"password" is too long.`);
    }
    if (!body.naturalName) {
      throw newBadRequestError(`"naturalName" is required.`);
    }
    if (body.naturalName.length > NATURAL_NAME_LIMIT) {
      throw newBadRequestError(`"naturalName" is too long.`);
    }
    if (!body.contactEmail) {
      throw newBadRequestError(`"contactEmail" is required.`);
    }
    if (body.contactEmail.length > EMAIL_LIMIT) {
      throw newBadRequestError(`"contactEmail" is too long.`);
    }
    if (!body.accountType) {
      throw newBadRequestError(`"accountType" is required.`);
    }

    let userId = this.generateUuid();
    let accountId = this.generateUuid();
    let passwordHash = this.passwordSigner.sign(body.password);
    let usernameIsAvailable = true;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getUserByUsername(transaction, body.username);
      if (rows.length > 0) {
        usernameIsAvailable = false;
        return;
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        insertNewUserStatement(
          userId,
          body.username,
          passwordHash,
          body.recoveryEmail,
        ),
        insertNewAccountStatement(
          userId,
          accountId,
          body.accountType,
          {
            naturalName: body.naturalName,
            contactEmail: body.contactEmail,
            avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
            avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
          },
          "",
          now,
          now,
        ),
      ]);
      await transaction.commit();
    });
    if (!usernameIsAvailable) {
      return {
        usernameIsAvailable: false,
      };
    }

    let response = await createSession(this.serviceClient, {
      userId,
      accountId,
      accountType: body.accountType,
    });
    return {
      signedSession: response.signedSession,
      usernameIsAvailable: true,
    };
  }
}
