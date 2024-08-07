import AWS = require("aws-sdk");
import getStream = require("get-stream");
import postgres = require("postgres");
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { SignInHandlerInterface } from "@phading/user_service_interface/self/frontend/server_handlers";
import { ClientSession } from "@phading/user_session_service_interface/client_session";
import { SessionBuilder } from "@selfage/service_handler/session_signer";

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(
      SessionBuilder.create(),
      new AWS.S3({ apiVersion: "2006-03-01", region: "us-east-1" }),
    );
  }

  public constructor(
    private sessionBuilder: SessionBuilder,
    private s3Service: AWS.S3,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SignInRequestBody,
  ): Promise<SignInResponse> {
    console.log(`${loggingPrefix} Start handling SignIn request.`);
    let dbPassword = await getStream(
      this.s3Service
        .getObject({
          Bucket: "user-service-secrets",
          Key: "db_password",
        })
        .createReadStream(),
    );
    const sql = postgres({
      host: "user-service-db.cda5j8gofxqp.us-east-1.rds.amazonaws.com",
      port: 5432,
      database: "UserServiceDb",
      username: "root",
      password: dbPassword,
    });
    await sql`CREATE TABLE IF NOT EXISTS User (
      username varchar(128)
    );`;
    await sql.end();

    let signedSession = this.sessionBuilder.build(
      JSON.stringify({
        sessionId: `${body.username}-${body.password}-${dbPassword}`,
      } as ClientSession),
    );
    return {
      signedSession,
    };
  }
}
