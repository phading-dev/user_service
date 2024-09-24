import crypto = require("crypto");
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getUserByUsername,
  insertNewAccount,
  insertNewUser,
} from "../../db/sql";
import { PasswordSigner } from "../../common/password_signer";
import { Database } from "@google-cloud/spanner";
import { SignUpHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  SignUpRequestBody,
  SignUpResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { createSession } from "@phading/user_session_service_interface/backend/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SignUpHandler extends SignUpHandlerInterface {
  public static create(): SignUpHandler {
    return new SignUpHandler(
      new PasswordSigner(),
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => crypto.randomUUID(),
    );
  }

  public constructor(
    private passwordSigner: PasswordSigner,
    private database: Database,
    private serviceClient: NodeServiceClient,
    private generateUuid: () => string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SignUpRequestBody,
  ): Promise<SignUpResponse> {
    let userId = this.generateUuid();
    let accountId = this.generateUuid();
    let passwordHash = this.passwordSigner.sign(body.password);
    let usernameIsNotAvailable = false;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getUserByUsername(
        (query) => transaction.run(query),
        body.username,
      );
      if (rows.length > 0) {
        usernameIsNotAvailable = true;
        await transaction.commit();
        return;
      }

      await Promise.all([
        insertNewUser(
          (query) => transaction.run(query),
          userId,
          body.username,
          passwordHash,
          body.recoveryEmail,
        ),
        insertNewAccount(
          (query) => transaction.run(query),
          userId,
          accountId,
          body.accountType,
          body.naturalName,
          body.contactEmail,
        ),
      ]);
      await transaction.commit();
    });
    if (usernameIsNotAvailable) {
      return {
        usernameIsNotAvailable,
      };
    }

    let response = await createSession(this.serviceClient, {
      userId,
      accountId,
      accountType: body.accountType,
    });
    return {
      signedSession: response.signedSession,
    };
  }
}
