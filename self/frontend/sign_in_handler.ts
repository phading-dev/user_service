import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { SignInHandlerInterface } from "@phading/user_service_interface/self/frontend/server_handlers";
import { ClientSession } from "@phading/user_session_service_interface/client_session";
import { SessionBuilder } from "@selfage/service_handler/session_signer";

export class SignInHandler extends SignInHandlerInterface {
  public static create(): SignInHandler {
    return new SignInHandler(SessionBuilder.create());
  }

  public constructor(private sessionBuilder: SessionBuilder) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SignInRequestBody,
  ): Promise<SignInResponse> {
    console.log(`${loggingPrefix} Start handling SignIn request.`);
    let signedSession = this.sessionBuilder.build(
      JSON.stringify({
        sessionId: `${body.username}-${body.password}`,
      } as ClientSession),
    );
    return {
      signedSession,
    };
  }
}
