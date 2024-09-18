import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getPasswordHashById, updateRecoveryEmail } from "../../db/sql";
import { PasswordSigner } from "./password_signer";
import { Database } from "@google-cloud/spanner";
import { UpdateRecoveryEmailHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  UpdateRecoveryEmailRequestBody,
  UpdateRecoveryEmailResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class UpdateRecoveryEmailHandler extends UpdateRecoveryEmailHandlerInterface {
  public static create(): UpdateRecoveryEmailHandler {
    return new UpdateRecoveryEmailHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      new PasswordSigner(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private passwordSigner: PasswordSigner,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: UpdateRecoveryEmailRequestBody,
    sessionStr: string,
  ): Promise<UpdateRecoveryEmailResponse> {
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
    await updateRecoveryEmail(
      (query) => this.database.run(query),
      body.newEmail,
      userSession.userId,
    );
    return {};
  }
}
