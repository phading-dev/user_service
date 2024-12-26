import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUser, updateUserStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MAX_PASSWORD_LENGTH } from "@phading/constants/account";
import { UpdatePasswordHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  UpdatePasswordRequestBody,
  UpdatePasswordResponse,
} from "@phading/user_service_interface/web/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newNotFoundError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdatePasswordHandler extends UpdatePasswordHandlerInterface {
  public static create(): UpdatePasswordHandler {
    return new UpdatePasswordHandler(
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
    body: UpdatePasswordRequestBody,
    sessionStr: string,
  ): Promise<UpdatePasswordResponse> {
    if (!body.currentPassword) {
      throw newBadRequestError(`"currentPassword" is required.`);
    }
    if (!body.newPassword) {
      throw newBadRequestError(`"newPassword" is required.`);
    }
    if (body.newPassword.length > MAX_PASSWORD_LENGTH) {
      throw newBadRequestError(`"newPassword" is too long.`);
    }
    let { userId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
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
    let newPasswordHash = this.passwordSigner.sign(body.newPassword);
    userData.passwordHashV1 = newPasswordHash;
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([updateUserStatement(userData)]);
      await transaction.commit();
    });
    return {};
  }
}
