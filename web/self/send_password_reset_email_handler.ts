import crypto = require("crypto");
import { SENDGRID_CLIENT } from "../../common/sendgrid_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getUserByUserEmail,
  insertPasswordResetTokenStatement,
  listPasswordResetTokensByUserId,
} from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import {
  TOKEN_EXPIRATION_TIME_MS,
  TOKEN_RATE_LIMIT_INTERVAL_MS,
} from "@phading/constants/account";
import { SendPasswordResetEmailHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  SendPasswordResetEmailRequestBody,
  SendPasswordResetEmailResponse,
} from "@phading/user_service_interface/web/self/interface";
import { buildUrl } from "@phading/web_interface/url_builder";
import { newBadRequestError } from "@selfage/http_error";
import { MailService } from "@sendgrid/mail";

export class SendPasswordResetEmailHandler extends SendPasswordResetEmailHandlerInterface {
  public static create(): SendPasswordResetEmailHandler {
    return new SendPasswordResetEmailHandler(
      SPANNER_DATABASE,
      SENDGRID_CLIENT,
      ENV_VARS.externalOrigin,
      () => crypto.randomUUID(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private sendgridClient: MailService,
    private externalOrigin: string,
    private generateUuid: () => string,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SendPasswordResetEmailRequestBody,
  ): Promise<SendPasswordResetEmailResponse> {
    if (!body.userEmail) {
      throw newBadRequestError(`"userEmail" is required.`);
    }
    let tokenId: string;
    await this.database.runTransactionAsync(async (transaction) => {
      let userRows = await getUserByUserEmail(transaction, {
        userUserEmailEq: body.userEmail,
      });
      if (userRows.length === 0) {
        throw newBadRequestError(
          `User with email "${body.userEmail}" does not exist.`,
        );
      }
      let user = userRows[0];
      let passwordResetTokens = await listPasswordResetTokensByUserId(
        transaction,
        {
          passwordResetTokenUserIdEq: user.userUserId,
          limit: 1,
        },
      );
      let now = this.getNow();
      if (
        passwordResetTokens.length > 0 &&
        passwordResetTokens[0].passwordResetTokenCreatedTimeMs +
          TOKEN_RATE_LIMIT_INTERVAL_MS >
          now
      ) {
        console.log(
          `Password reset email cannot be re-sent too soon for user ${user.userUserId}.`,
        );
        return;
      }
      tokenId = this.generateUuid();
      await transaction.batchUpdate([
        insertPasswordResetTokenStatement({
          tokenId,
          userId: user.userUserId,
          createdTimeMs: now,
          expiresTimeMs: now + TOKEN_EXPIRATION_TIME_MS,
        }),
      ]);
      await transaction.commit();
    });
    if (!tokenId) {
      return {
        rateLimited: true,
      };
    }
    await this.sendgridClient.send({
      to: body.userEmail,
      from: {
        email: ENV_VARS.supportEmail,
        name: ENV_VARS.supportEmailName,
      },
      templateId: ENV_VARS.passwordResetEmailTemplateId,
      dynamicTemplateData: {
        platformName: ENV_VARS.platformName,
        expiringTimeInMinutes: `${Math.round(TOKEN_EXPIRATION_TIME_MS / 1000 / 60)}`,
        passwordResetUrl: buildUrl(this.externalOrigin, {
          resetPassword: {
            tokenId,
          },
        }),
        yearAndCompany: ENV_VARS.emailFooterYearAndCompany,
        companyAddress: ENV_VARS.emailFooterCompanyAddress,
      },
    });
    return {};
  }
}
