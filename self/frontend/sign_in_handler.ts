import promClient = require("prom-client");
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { SignInHandlerInterface } from "@phading/user_service_interface/self/frontend/server_handlers";
import { ClientSession } from "@phading/user_session_service_interface/client_session";
import { SessionBuilder } from "@selfage/service_handler/session_signer";
import { Database, Spanner } from "@google-cloud/spanner";

let counter = new promClient.Counter({
  name: "user_service_sign_in_total",
  help: "Total number of sign in requests",
});

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(SessionBuilder.create());
  }

  private userDb: Database;

  public constructor(private sessionBuilder: SessionBuilder) {
    super();
    this.userDb = new Spanner().instance("user-service-db").database("user");
  }

  public async handle(
    loggingPrefix: string,
    body: SignInRequestBody,
  ): Promise<SignInResponse> {
    console.log(`${loggingPrefix} Start handling SignIn request.`);
    counter.inc();
    let [rows] = await this.userDb.run({
      sql: `SELECT * FROM UserTrial`
    });
    let username = rows[0].toJSON()['username'];
    let signedSession = this.sessionBuilder.build(
      JSON.stringify({
        sessionId: `${body.username}-${body.password}-${username}`,
      } as ClientSession),
    );
    return {
      signedSession,
    };
  }
}
