import express = require("express");
import http = require("http");
import { SignInHandler } from "./self/frontend/sign_in_handler";
import { HandlerRegister } from "@selfage/service_handler/register";
import { SessionSigner } from "@selfage/service_handler/session_signer";
import "../environment";

async function main(): Promise<void> {
  let app = registerHandlers("somekindkey");
  let httpServer = http.createServer(app);
  httpServer.listen(8080, () => {
    console.log("Http server started at 8080.");
  });
}

function registerHandlers(sessionKey: string): express.Express {
  SessionSigner.SECRET_KEY = sessionKey;
  let app = express();
  let register = new HandlerRegister(app);
  register.registerCorsAllowedPreflightHandler();
  register.register(SignInHandler.create());
  return app;
}

main();
