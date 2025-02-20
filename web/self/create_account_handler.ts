import crypto = require("crypto");
import { toCapabilities } from "../../common/capabilities_converter";
import { initAccount, initAccountMore } from "../../common/init_account";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { Account } from "../../db/schema";
import {
  getUser,
  insertAccountMoreStatement,
  insertAccountStatement,
  updateUserStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
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
  newExchangeSessionAndCheckCapabilityRequest,
} from "@phading/user_session_service_interface/node/client";
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
    if (!body.naturalName) {
      throw newBadRequestError(`"naturalName" is required.`);
    }
    if (body.naturalName.length > MAX_NATURAL_NAME_LENGTH) {
      throw newBadRequestError(`"naturalName" is too long.`);
    }
    if (!body.contactEmail) {
      throw newBadRequestError(`"contactEmail" is required.`);
    }
    if (body.contactEmail.length > MAX_EMAIL_LENGTH) {
      throw newBadRequestError(`"contactEmail" is too long.`);
    }
    if (!body.accountType) {
      throw newBadRequestError(`"accountType" is required.`);
    }

    let { userId } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: authStr,
      }),
    );
    let account: Account;
    await this.database.runTransactionAsync(async (transaction) => {
      let userRows = await getUser(transaction, userId);
      if (userRows.length === 0) {
        throw newInternalServerErrorError(`User ${userId} is not found.`);
      }
      let { userData } = userRows[0];
      if (userData.totalAccounts >= MAX_ACCOUNTS_PER_USER) {
        throw newBadRequestError(
          `User ${userId} has reached the maximum number of accounts.`,
        );
      }
      userData.totalAccounts++;
      let now = this.getNow();
      account = initAccount(
        userId,
        this.generateUuid(),
        body.accountType,
        body.naturalName,
        body.contactEmail,
        now,
      );
      await transaction.batchUpdate([
        updateUserStatement(userData),
        insertAccountStatement(account),
        insertAccountMoreStatement(initAccountMore(account.accountId)),
      ]);
      await transaction.commit();
    });
    let response = await this.serviceClient.send(
      newCreateSessionRequest({
        userId,
        accountId: account.accountId,
        capabilitiesVersion: account.capabilitiesVersion,
        capabilities: toCapabilities(account),
      }),
    );
    return {
      signedSession: response.signedSession,
    };
  }
}
