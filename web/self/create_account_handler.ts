import crypto = require("crypto");
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { getUser, updateUserTotalAccountsStatement } from "../../db/sql";
import { createAccount } from "./common/create_account";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import {
  MAX_ACCOUNTS_PER_USER,
  MAX_EMAIL_LENGTH,
  MAX_NATURAL_NAME_LENGTH,
} from "@phading/constants/account";
import { CreateAccountHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  CreateAccountRequestBody,
  CreateAccountResponse,
} from "@phading/user_service_interface/web/self/interface";
import {
  newCreateSessionRequest,
  newFetchSessionAndCheckCapabilityRequest,
} from "@phading/user_session_service_interface/node/client";
import { CreateSessionRequestBody } from "@phading/user_session_service_interface/node/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class CreateAccountHandler extends CreateAccountHandlerInterface {
  public static create(): CreateAccountHandler {
    return new CreateAccountHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => crypto.randomUUID(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private generateUuid: () => string,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreateAccountRequestBody,
    authStr: string,
  ): Promise<CreateAccountResponse> {
    body.naturalName = (body.naturalName ?? "").trim();
    if (!body.naturalName) {
      throw newBadRequestError(`"naturalName" cannot be empty.`);
    }
    if (body.naturalName.length > MAX_NATURAL_NAME_LENGTH) {
      throw newBadRequestError(`"naturalName" is too long.`);
    }
    body.contactEmail = (body.contactEmail ?? "").trim();
    if (!body.contactEmail) {
      throw newBadRequestError(`"contactEmail" cannot be empty.`);
    }
    if (body.contactEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"contactEmail" is too long.`);
    }
    if (!body.accountType) {
      throw newBadRequestError(`"accountType" is required.`);
    }
    let { userId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let request: CreateSessionRequestBody;
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getUser(transaction, {
        userUserIdEq: userId,
      });
      if (rows.length === 0) {
        throw newInternalServerErrorError(`User ${userId} is not found.`);
      }
      let row = rows[0];
      if (row.userTotalAccounts >= MAX_ACCOUNTS_PER_USER) {
        throw newBadRequestError(
          `User ${userId} has reached the maximum number of accounts.`,
        );
      }
      let statements = new Array<Statement>();
      statements.push(
        updateUserTotalAccountsStatement({
          userUserIdEq: userId,
          setTotalAccounts: row.userTotalAccounts + 1,
        }),
      );
      let now = this.getNow();
      request = createAccount(
        userId,
        this.generateUuid(),
        body.accountType,
        body.naturalName,
        body.contactEmail,
        now,
        statements,
      );
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    let response = await this.serviceClient.send(
      newCreateSessionRequest(request),
    );
    return {
      signedSession: response.signedSession,
    };
  }
}
