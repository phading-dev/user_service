import express = require("express");
import http = require("http");
import promClient = require("prom-client");
import { SignInHandler } from "./self/frontend/sign_in_handler";
import { HandlerRegister } from "@selfage/service_handler/register";
import { SessionSigner } from "@selfage/service_handler/session_signer";

async function main(): Promise<void> {
  let app = registerHandlers("somekindkey");
  let httpServer = http.createServer(app);
  httpServer.listen(80, () => {
    console.log("Http server started at 80.");
  });
}

function registerHandlers(sessionKey: string): express.Express {
  SessionSigner.SECRET_KEY = sessionKey;
  let app = express();
  let router = express.Router();
  let register = new HandlerRegister(router);
  register.registerCorsAllowedPreflightHandler();
  register.register(SignInHandler.create());
  app.use("/user", router);
  app.get("/healthz", (req, res) => {
    res.end("ok");
  });
  app.get("/metrics", async (req, res) => {
    res.end(await promClient.register.metrics());
  });
  return app;
}

main();
