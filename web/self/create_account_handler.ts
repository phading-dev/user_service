import crypto = require("crypto");
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../common/params";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { insertNewAccountStatement } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import {
  MAX_EMAIL_LENGTH,
  MAX_NATURAL_NAME_LENGTH,
} from "@phading/constants/account";
import { CreateAccountHandlerInterface } from "@phading/user_service_interface/web/self/handler";
import {
  CreateAccountRequestBody,
  CreateAccountResponse,
} from "@phading/user_service_interface/web/self/interface";
import {
  createSession,
  exchangeSessionAndCheckCapability,
} from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
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
    sessionStr: string,
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

    let { userId } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
      },
    );
    let accountId = this.generateUuid();
    await this.database.runTransactionAsync(async (transaction) => {
      let now = this.getNow();
      await transaction.batchUpdate([
        insertNewAccountStatement(
          userId,
          accountId,
          body.accountType,
          {
            naturalName: body.naturalName,
            contactEmail: body.contactEmail,
            avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
            avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
          },
          "",
          now,
          now,
        ),
      ]);
      await transaction.commit();
    });
    let response = await createSession(this.serviceClient, {
      userId,
      accountId,
      accountType: body.accountType,
    });
    return {
      signedSession: response.signedSession,
    };
  }
}
