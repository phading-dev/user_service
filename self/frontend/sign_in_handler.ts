import AWS = require("aws-sdk");
import getStream from "get-stream";
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { SignInHandlerInterface } from "@phading/user_service_interface/self/frontend/server_handlers";
import { ClientSession } from "@phading/user_session_service_interface/client_session";
import { SessionBuilder } from "@selfage/service_handler/session_signer";

AWS.config.update({ region: "us-east-1" });

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(
      SessionBuilder.create(),
      new AWS.S3({ apiVersion: "2006-03-01" }),
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
