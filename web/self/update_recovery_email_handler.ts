import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUser, updateUserStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MAX_EMAIL_LENGTH } from "@phading/constants/account";
import { UpdateRecoveryEmailHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdateRecoveryEmailRequestBody,
  UpdateRecoveryEmailResponse,
} from "@phading/user_service_interface/web/self/interface";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
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
    if (!body.newEmail) {
      throw newBadRequestError(`"newEmail" is required.`);
    }
    if (body.newEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"newEmail" is too long.`);
    }
    let { userId } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let rows = await getUser(this.database, userId);
    if (rows.length === 0) {
      throw newNotFoundError(`User ${userId} is not found.`);
    }
    let { userData } = rows[0];
    if (
      this.passwordSigner.sign(body.currentPassword) !== userData.passwordHashV1
    ) {
      throw newBadRequestError(`Password is incorrect.`);
    }
    userData.recoveryEmail = body.newEmail;
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([updateUserStatement(userData)]);
      await transaction.commit();
    });
    return {};
  }
}
