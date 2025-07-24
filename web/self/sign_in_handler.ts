import { toCapabilities } from "../../common/capabilities_converter";
import { PASSWORD_SIGNER, PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  ListLastAccessedAccountsRow,
  getUserByUserEmail,
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
    body.userEmail = (body.userEmail ?? "").trim();
    if (!body.userEmail) {
      throw newBadRequestError(`"userEmail" cannot be empty.`);
    }
    if (!body.password) {
      throw newBadRequestError(`"password" is required.`);
    }

    let notAuthenticated = false;
    let needsEmailVerification = false;
    let account: ListLastAccessedAccountsRow;
    await this.database.runTransactionAsync(async (transaction) => {
      let userRows = await getUserByUserEmail(this.database, {
        userUserEmailEq: body.userEmail,
      });
      if (userRows.length === 0) {
        console.log(
          `${loggingPrefix} userEmail ${body.userEmail} is not found.`,
        );
        notAuthenticated = true;
        return;
      }
      let user = userRows[0];
      if (this.passwordSigner.sign(body.password) !== user.userPasswordHashV1) {
        console.log(
          `${loggingPrefix} password doesn't match for userEmail ${body.userEmail}.`,
        );
        notAuthenticated = true;
        return;
      }
      if (!user.userEmailVerified) {
        needsEmailVerification = true;
        return;
      }
      let accountRows = await listLastAccessedAccounts(this.database, {
        accountUserIdEq: user.userUserId,
        limit: 1,
      });
      if (accountRows.length === 0) {
        throw newInternalServerErrorError(
          `No account found for user ${user.userUserId}.`,
        );
      }
      account = accountRows[0];
      await transaction.batchUpdate([
        updateAccountLastAccessedTimeStatement({
          accountAccountIdEq: account.accountAccountId,
          setLastAccessedTimeMs: this.getNow(),
        }),
      ]);
      await transaction.commit();
    });
    if (notAuthenticated) {
      return {
        notAuthenticated: true,
      };
    }
    if (needsEmailVerification) {
      return {
        needsEmailVerification: true,
      };
    }
    let response = await this.serviceClient.send(
      newCreateSessionRequest({
        userId: account.accountUserId,
        accountId: account.accountAccountId,
        capabilitiesVersion: account.accountCapabilitiesVersion,
        capabilities: toCapabilities(
          account.accountAccountType,
          account.accountPaymentProfileState,
        ),
      }),
    );
    return {
      signedSession: response.signedSession,
    };
  }
}
