import { toCapabilities } from "../../common/capabilities_converter";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  ListLastAccessedAccountsRow,
  deleteEmailVerificationTokenStatement,
  getEmailVerificationToken,
  getUser,
  listLastAccessedAccounts,
  updateAccountLastAccessedTimeStatement,
  updateUserEmailVerifiedStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { VerifyEmailAndSignInHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  VerifyEmailAndSignInRequestBody,
  VerifyEmailAndSignInResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newCreateSessionRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class VerifyEmailAndSignInHandler extends VerifyEmailAndSignInHandlerInterface {
  public static create(): VerifyEmailAndSignInHandler {
    return new VerifyEmailAndSignInHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: VerifyEmailAndSignInRequestBody,
  ): Promise<VerifyEmailAndSignInResponse> {
    if (!body.verificationToken) {
      throw newBadRequestError(`"verificationToken" is required.`);
    }
    let account: ListLastAccessedAccountsRow;
    await this.database.runTransactionAsync(async (transaction) => {
      let tokenRows = await getEmailVerificationToken(transaction, {
        emailVerificationTokenTokenIdEq: body.verificationToken,
      });
      if (tokenRows.length === 0) {
        console.log(
          `${loggingPrefix} Email verification token ${body.verificationToken} is not found.`,
        );
        return;
      }
      let token = tokenRows[0];
      if (token.emailVerificationTokenExpiresTimeMs < this.getNow()) {
        console.log(
          `${loggingPrefix} Email verification token ${token.emailVerificationTokenTokenId} expired.`,
        );
        return;
      }
      let [userRows, accountRows] = await Promise.all([
        getUser(transaction, {
          userUserIdEq: token.emailVerificationTokenUserId,
        }),
        listLastAccessedAccounts(transaction, {
          accountUserIdEq: token.emailVerificationTokenUserId,
          limit: 1,
        }),
      ]);
      if (userRows.length === 0) {
        throw newBadRequestError(
          `User ${token.emailVerificationTokenUserId} not found for the provided token.`,
        );
      }
      let user = userRows[0];
      if (user.userUserEmail !== token.emailVerificationTokenUserEmail) {
        console.log(
          `${loggingPrefix} User ${user.userUserId} email ${user.userUserEmail} does not match the token email ${token.emailVerificationTokenUserEmail}.`,
        );
        return;
      }
      if (accountRows.length === 0) {
        throw newInternalServerErrorError(
          `No account found for user ${user.userUserId}.`,
        );
      }
      account = accountRows[0];
      await transaction.batchUpdate([
        updateUserEmailVerifiedStatement({
          userUserIdEq: user.userUserId,
          setEmailVerified: true,
        }),
        updateAccountLastAccessedTimeStatement({
          accountAccountIdEq: account.accountAccountId,
          setLastAccessedTimeMs: this.getNow(),
        }),
        deleteEmailVerificationTokenStatement({
          emailVerificationTokenTokenIdEq: body.verificationToken,
        }),
      ]);
      await transaction.commit();
    });
    if (!account) {
      return {
        tokenExpired: true,
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
