import { USER_SESSION_SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getPasswordHashById, updatePassword } from "../../db/sql";
import { PasswordSigner } from "./password_signer";
import { Database } from "@google-cloud/spanner";
import { UpdatePasswordHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  UpdatePasswordRequestBody,
  UpdatePasswordResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdatePasswordHandler extends UpdatePasswordHandlerInterface {
  public static create(): UpdatePasswordHandler {
    return new UpdatePasswordHandler(
      new PasswordSigner(),
      SPANNER_DATABASE,
      USER_SESSION_SERVICE_CLIENT,
    );
  }

  public constructor(
    private passwordSigner: PasswordSigner,
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdatePasswordRequestBody,
    sessionStr: string,
  ): Promise<UpdatePasswordResponse> {
    let userSession = (
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
      })
    ).userSession;
    let currentPasswordHash = (
      await getPasswordHashById(
        (query) => this.database.run(query),
        userSession.userId,
      )
    )[0].userPasswordHashV1;
    if (
      this.passwordSigner.sign(body.currentPassword) !== currentPasswordHash
    ) {
      throw newUnauthorizedError(`Password is incorrect.`);
    }
    let newPasswordHash = this.passwordSigner.sign(body.newPassword);
    await updatePassword(
      (query) => this.database.run(query),
      newPasswordHash,
      userSession.userId,
    );
    return {};
  }
}
