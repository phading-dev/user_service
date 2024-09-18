import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  getLastAccessedAccount,
  getUserByUsername,
  updateLastAccessedTimestmap,
} from "../../db/sql";
import { PasswordSigner } from "./password_signer";
import { Database } from "@google-cloud/spanner";
import { SignInHandlerInterface } from "@phading/user_service_interface/self/frontend/handler";
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { createClientSession } from "@phading/user_session_service_interface/backend/client";
import { newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(
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
    body: SignInRequestBody,
  ): Promise<SignInResponse> {
    let rows = await getUserByUsername(
      (query) => this.database.run(query),
      body.username,
    );
    if (rows.length === 0) {
      console.log(`${loggingPrefix} username ${body.username} is not found.`);
      throw newUnauthorizedError("Failed to sign in.");
    }
    let userRow = rows[0];
    let signedPassword = this.passwordSigner.sign(body.password);
    if (signedPassword !== userRow.userPasswordHashV1) {
      console.log(
        `${loggingPrefix} password doesn't match for username ${body.username}.`,
      );
      throw newUnauthorizedError("Failed to sign in.");
    }
    let accountRow = (
      await getLastAccessedAccount(
        (query) => this.database.run(query),
        userRow.userUserId,
      )
    )[0];
    let [, response] = await Promise.all([
      updateLastAccessedTimestmap(
        (query) => this.database.run(query),
        accountRow.accountAccountId,
      ),
      createClientSession(this.serviceClient, {
        userId: userRow.userUserId,
      }),
    ]);
    return {
      signedSession: response.signedSession,
    };
  }
}
