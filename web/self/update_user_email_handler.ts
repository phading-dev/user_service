import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getUser,
  getUserByUserEmail,
  updateAccountsContactEmailByUserIdStatement,
  updateUserEmailStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MAX_EMAIL_LENGTH } from "@phading/constants/account";
import { UpdateUserEmailHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateUserEmailRequestBody,
  UpdateUserEmailResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateUserEmailHandler extends UpdateUserEmailHandlerInterface {
  public static create(): UpdateUserEmailHandler {
    return new UpdateUserEmailHandler(
      SPANNER_DATABASE,
      new PasswordSigner(),
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private passwordSigner: PasswordSigner,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdateUserEmailRequestBody,
    authStr: string,
  ): Promise<UpdateUserEmailResponse> {
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
    let { userId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let notAuthenticated = false;
    let userEmailUnavailable = false;
    await this.database.runTransactionAsync(async (transaction) => {
      let [userRows, otherUserRows] = await Promise.all([
        getUser(this.database, { userUserIdEq: userId }),
        getUserByUserEmail(transaction, { userUserEmailEq: body.newEmail }),
      ]);
      if (userRows.length === 0) {
        throw newInternalServerErrorError(`User ${userId} is not found.`);
      }
      let user = userRows[0];
      if (this.passwordSigner.sign(body.password) !== user.userPasswordHashV1) {
        console.log(
          `${loggingPrefix} password doesn't match for userId ${userId}.`,
        );
        notAuthenticated = true;
        return;
      }
      if (otherUserRows.length > 0) {
        console.log(
          `${loggingPrefix} User ${userId} is changing to userEmail ${body.newEmail} which is already taken by other users.`,
        );
        userEmailUnavailable = true;
        return;
      }
      await transaction.batchUpdate([
        updateUserEmailStatement({
          userUserIdEq: userId,
          setUserEmail: body.newEmail,
          setEmailVerified: false,
        }),
        updateAccountsContactEmailByUserIdStatement({
          accountUserIdEq: userId,
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
