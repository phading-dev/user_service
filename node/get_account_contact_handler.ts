import { SPANNER_DATABASE } from "../common/spanner_database";
import { getAccountMain } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetAccountContactHandlerInterface } from "@phading/user_service_interface/node/handler";
import {
  GetAccountContactRequestBody,
  GetAccountContactResponse,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";

export class GetAccountContactHandler extends GetAccountContactHandlerInterface {
  public static create(): GetAccountContactHandler {
    return new GetAccountContactHandler(SPANNER_DATABASE);
  }

  public constructor(private database: Database) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetAccountContactRequestBody,
  ): Promise<GetAccountContactResponse> {
    let rows = await getAccountMain(this.database, {
      accountAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      throw newBadRequestError(`Account ${body.accountId} is not found.`);
    }
    let row = rows[0];
    return {
      naturalName: row.accountNaturalName,
      contactEmail: row.accountContactEmail,
    };
  }
}
