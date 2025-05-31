import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUser, updateUserRecoveryEmailStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MAX_EMAIL_LENGTH } from "@phading/constants/account";
import { UpdateRecoveryEmailHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateRecoveryEmailRequestBody,
  UpdateRecoveryEmailResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newNotFoundError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateRecoveryEmailHandler extends UpdateRecoveryEmailHandlerInterface {
  public static create(): UpdateRecoveryEmailHandler {
    return new UpdateRecoveryEmailHandler(
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
    body: UpdateRecoveryEmailRequestBody,
    authStr: string,
  ): Promise<UpdateRecoveryEmailResponse> {
    if (!body.currentPassword) {
      throw newBadRequestError(`"currentPassword" is required.`);
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
    let rows = await getUser(this.database, { userUserIdEq: userId });
    if (rows.length === 0) {
      throw newNotFoundError(`User ${userId} is not found.`);
    }
    let user = rows[0];
    if (
      this.passwordSigner.sign(body.currentPassword) !== user.userPasswordHashV1
    ) {
      throw newBadRequestError(`Password is incorrect.`);
    }
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateUserRecoveryEmailStatement({
          userUserIdEq: userId,
          setRecoveryEmail: body.newEmail,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
