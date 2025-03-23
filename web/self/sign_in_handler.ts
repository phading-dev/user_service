import { toCapabilities } from "../../common/capabilities_converter";
import { PASSWORD_SIGNER, PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getUserByUsername,
  listLastAccessedAccounts,
  updateAccountLastAccessedTimeStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { SignInHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newCreateSessionRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      PASSWORD_SIGNER,
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

    let rows = await getUserByUsername(this.database, {
      userUsernameEq: body.username,
    });
    if (rows.length === 0) {
      console.log(`${loggingPrefix} username ${body.username} is not found.`);
      throw newUnauthorizedError("Failed to sign in.");
    }
    let row = rows[0];
    let signedPassword = this.passwordSigner.sign(body.password);
    if (signedPassword !== row.userPasswordHashV1) {
      console.log(
        `${loggingPrefix} password doesn't match for username ${body.username}.`,
      );
      throw newUnauthorizedError("Failed to sign in.");
    }
    let accountRows = await listLastAccessedAccounts(this.database, {
      accountUserIdEq: row.userUserId,
      limit: 1,
    });
    if (accountRows.length === 0) {
      throw newInternalServerErrorError(
        `No account found for user ${row.userUserId}.`,
      );
    }
    let account = accountRows[0];
    let [_, response] = await Promise.all([
      this.updateLastAccessedTimestmap(account.accountAccountId),
      this.serviceClient.send(
        newCreateSessionRequest({
          userId: account.accountUserId,
          accountId: account.accountAccountId,
          capabilitiesVersion: account.accountCapabilitiesVersion,
          capabilities: toCapabilities(
            account.accountAccountType,
            account.accountBillingProfileState,
          ),
        }),
      ),
    ]);
    return {
      signedSession: response.signedSession,
    };
  }

  private async updateLastAccessedTimestmap(accountId: string): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateAccountLastAccessedTimeStatement({
          accountAccountIdEq: accountId,
          setLastAccessedTimeMs: this.getNow(),
        }),
      ]);
      await transaction.commit();
    });
  }
}
