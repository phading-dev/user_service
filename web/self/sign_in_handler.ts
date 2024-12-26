import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { Account } from "../../db/schema";
import {
  getUserByUsername,
  listLastAccessedAccounts,
  updateAccountStatement,
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
    let { userData } = rows[0];
    let signedPassword = this.passwordSigner.sign(body.password);
    if (signedPassword !== userData.passwordHashV1) {
      console.log(
        `${loggingPrefix} password doesn't match for username ${body.username}.`,
      );
      throw newUnauthorizedError("Failed to sign in.");
    }
    let [accountRow] = await listLastAccessedAccounts(
      this.database,
      userData.userId,
      1,
    );
    let [_, response] = await Promise.all([
      this.updateLastAccessedTimestmap(accountRow.accountData),
      createSession(this.serviceClient, {
        userId: accountRow.accountData.userId,
        accountId: accountRow.accountData.accountId,
        accountType: accountRow.accountData.accountType,
      }),
    ]);
    return {
      signedSession: response.signedSession,
    };
  }

  private async updateLastAccessedTimestmap(
    accountData: Account,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      accountData.lastAccessedTimeMs = this.getNow();
      await transaction.batchUpdate([updateAccountStatement(accountData)]);
      await transaction.commit();
    });
  }
}
