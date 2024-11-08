import { PasswordSigner } from "../../common/password_signer";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUserById, updatePasswordStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { PASSWORD_LIMIT } from "@phading/constants/account";
import { UpdatePasswordHandlerInterface } from "@phading/user_service_interface/frontend/self/handler";
import {
  UpdatePasswordRequestBody,
  UpdatePasswordResponse,
} from "@phading/user_service_interface/frontend/self/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
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
    if (body.newPassword.length > PASSWORD_LIMIT) {
      throw newBadRequestError(`"newPassword" is too long.`);
    }
    let { userSession } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let rows = await getUserById(this.database, userSession.userId);
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `User ${userSession.userId} is not found.`,
      );
    }
    let userRow = rows[0];
    if (
      this.passwordSigner.sign(body.currentPassword) !==
      userRow.userPasswordHashV1
    ) {
      throw newBadRequestError(`Password is incorrect.`);
    }
    let newPasswordHash = this.passwordSigner.sign(body.newPassword);
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updatePasswordStatement(newPasswordHash, userSession.userId),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
