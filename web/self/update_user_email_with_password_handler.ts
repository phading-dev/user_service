import { PasswordSigner } from "../../common/password_signer";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getUserByUserEmail,
  updateAccountsContactEmailByUserIdStatement,
  updateUserEmailStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MAX_EMAIL_LENGTH } from "@phading/constants/account";
import { UpdateUserEmailWithPasswordHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateUserEmailWithPasswordRequestBody,
  UpdateUserEmailWithPasswordResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newBadRequestError } from "@selfage/http_error";

export class UpdateUserEmailWithPasswordHandler extends UpdateUserEmailWithPasswordHandlerInterface {
  public static create(): UpdateUserEmailWithPasswordHandler {
    return new UpdateUserEmailWithPasswordHandler(
      SPANNER_DATABASE,
      new PasswordSigner(),
    );
  }

  public constructor(
    private database: Database,
    private passwordSigner: PasswordSigner,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdateUserEmailWithPasswordRequestBody,
  ): Promise<UpdateUserEmailWithPasswordResponse> {
    if (!body.currentEmail) {
      throw newBadRequestError(`"currentEmail" is required.`);
    }
    if (!body.password) {
      throw newBadRequestError(`"password" is required.`);
    }
    body.newEmail = (body.newEmail ?? "").trim();
    if (!body.newEmail) {
      throw newBadRequestError(`"newEmail" cannot be empty.`);
    }
    if (body.newEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"newEmail" is too long.`);
    }
    let notAuthenticated = false;
    let userEmailUnavailable = false;
    await this.database.runTransactionAsync(async (transaction) => {
      let [userRows, otherUserRows] = await Promise.all([
        getUserByUserEmail(transaction, {
          userUserEmailEq: body.currentEmail,
        }),
        getUserByUserEmail(transaction, {
          userUserEmailEq: body.newEmail,
        }),
      ]);
      if (userRows.length === 0) {
        console.log(`${loggingPrefix} User ${body.currentEmail} is not found.`);
        notAuthenticated = true;
        return;
      }
      let user = userRows[0];
      if (this.passwordSigner.sign(body.password) !== user.userPasswordHashV1) {
        console.log(
          `${loggingPrefix} password doesn't match for userEmail ${body.currentEmail}.`,
        );
        notAuthenticated = true;
        return;
      }
      if (otherUserRows.length > 0) {
        console.log(
          `${loggingPrefix} User ${body.currentEmail} is changing to userEmail ${body.newEmail} which is already taken by other users.`,
        );
        userEmailUnavailable = true;
        return;
      }
      await transaction.batchUpdate([
        updateUserEmailStatement({
          userUserIdEq: user.userUserId,
          setUserEmail: body.newEmail,
          setEmailVerified: false,
        }),
        updateAccountsContactEmailByUserIdStatement({
          accountUserIdEq: user.userUserId,
          setContactEmail: body.newEmail,
        }),
      ]);
      await transaction.commit();
    });
    if (notAuthenticated) {
      return {
        notAuthenticated: true,
      };
    }
    if (userEmailUnavailable) {
      return {
        userEmailUnavailable: true,
      };
    }
    return {};
  }
}
