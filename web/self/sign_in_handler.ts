import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getLastAccessedAccount,
  getUserByUsername,
  updateLastAccessedTimestmapStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SignInHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/web/self/interface";
import { createSession } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      new PasswordSigner(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private passwordSigner: PasswordSigner,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SignInRequestBody,
  ): Promise<SignInResponse> {
    if (!body.username) {
      throw newBadRequestError(`"username" is required.`);
    }
    if (!body.password) {
      throw newBadRequestError(`"password" is required.`);
    }

    let rows = await getUserByUsername(this.database, body.username);
    if (rows.length === 0) {
      console.log(`${loggingPrefix} username ${body.username} is not found.`);
      throw newUnauthorizedError("Failed to sign in.");
    }
    let userRow = rows[0];
    let signedPassword = this.passwordSigner.sign(body.password);
    if (signedPassword !== userRow.userPasswordHashV1) {
      console.log(
        `${loggingPrefix} password doesn't match for username ${body.username}.`,
      );
      throw newUnauthorizedError("Failed to sign in.");
    }
    let [accountRow] = await getLastAccessedAccount(
      this.database,
      userRow.userUserId,
      1
    );
    let [_, response] = await Promise.all([
      this.updateLastAccessedTimestmap(accountRow.accountAccountId),
      createSession(this.serviceClient, {
        userId: userRow.userUserId,
        accountId: accountRow.accountAccountId,
        accountType: accountRow.accountAccountType,
      }),
    ]);
    return {
      signedSession: response.signedSession,
    };
  }

  private async updateLastAccessedTimestmap(accountId: string): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateLastAccessedTimestmapStatement(accountId, this.getNow()),
      ]);
      await transaction.commit();
    });
  }
}
