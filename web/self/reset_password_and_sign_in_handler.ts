import { toCapabilities } from "../../common/capabilities_converter";
import { PASSWORD_SIGNER, PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  ListLastAccessedAccountsRow,
  deletePasswordResetTokenStatement,
  getPasswordResetToken,
  getUser,
  listLastAccessedAccounts,
  updateAccountLastAccessedTimeStatement,
  updateUserPasswordHashStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { ResetPasswordAndSignInHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  ResetPasswordAndSignInRequestBody,
  ResetPasswordAndSignInResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newCreateSessionRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ResetPasswordAndSignInHandler extends ResetPasswordAndSignInHandlerInterface {
  public static create(): ResetPasswordAndSignInHandler {
    return new ResetPasswordAndSignInHandler(
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
    body: ResetPasswordAndSignInRequestBody,
  ): Promise<ResetPasswordAndSignInResponse> {
    if (!body.resetToken) {
      throw newBadRequestError(`"resetToken" is required.`);
    }
    if (!body.newPassword) {
      throw newBadRequestError(`"newPassword" is required.`);
    }
    let account: ListLastAccessedAccountsRow;
    await this.database.runTransactionAsync(async (transaction) => {
      let tokenRows = await getPasswordResetToken(transaction, {
        passwordResetTokenTokenIdEq: body.resetToken,
      });
      if (tokenRows.length === 0) {
        console.log(
          `${loggingPrefix} Password reset token ${body.resetToken} is not found.`,
        );
        return;
      }
      let token = tokenRows[0];
      if (token.passwordResetTokenExpiresTimeMs < this.getNow()) {
        console.log(
          `${loggingPrefix} Password reset token ${token.passwordResetTokenTokenId} expired.`,
        );
        return;
      }

      let [userRows, accountRows] = await Promise.all([
        getUser(transaction, {
          userUserIdEq: token.passwordResetTokenUserId,
        }),
        listLastAccessedAccounts(transaction, {
          accountUserIdEq: token.passwordResetTokenUserId,
          limit: 1,
        }),
      ]);
      if (userRows.length === 0) {
        throw newBadRequestError(
          `User ${token.passwordResetTokenUserId} not found for the provided token.`,
        );
      }
      let user = userRows[0];
      if (accountRows.length === 0) {
        throw newInternalServerErrorError(
          `No account found for user ${user.userUserId}.`,
        );
      }
      account = accountRows[0];
      let newPasswordHash = this.passwordSigner.sign(body.newPassword);
      await transaction.batchUpdate([
        updateUserPasswordHashStatement({
          userUserIdEq: user.userUserId,
          setPasswordHashV1: newPasswordHash,
        }),
        updateAccountLastAccessedTimeStatement({
          accountAccountIdEq: account.accountAccountId,
          setLastAccessedTimeMs: this.getNow(),
        }),
        deletePasswordResetTokenStatement({
          passwordResetTokenTokenIdEq: body.resetToken,
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
