import promClient = require("prom-client");
import {
  SignInRequestBody,
  SignInResponse,
} from "@phading/user_service_interface/self/frontend/interface";
import { SignInHandlerInterface } from "@phading/user_service_interface/self/frontend/server_handlers";
import { ClientSession } from "@phading/user_session_service_interface/client_session";
import { SessionBuilder } from "@selfage/service_handler/session_signer";
// import monitoring = require('@google-cloud/monitoring')

// let METRICS_CLIENT = new monitoring.MetricServiceClient();
// let signInTotal = METRICS_CLIENT.createMetricDescriptor({
//   metricDescriptor: {
//     description: "The number of sign in requests.",
//     displayName: "# of sign in",
//     type: "custom.googleapis.com/user_service/sign_in_total",
//     metricKind: 'CUMULATIVE',
//     valueType: 'INT64',
//   }
// });
// signInTotal.then((res) => {
//   res[0].
// })

let counter = new promClient.Counter({
  name: "user_service_sign_in_total",
  help: "Total number of sign in requests",
});

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
    counter.inc();
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
