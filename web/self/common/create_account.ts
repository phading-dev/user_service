import { toCapabilities } from "../../../common/capabilities_converter";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../../common/constants";
import {
  insertAccountStatement,
  insertBillingProfileCreatingTaskStatement,
  insertEarningsProfileCreatingTaskStatement,
} from "../../../db/sql";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
import { CreateSessionRequestBody } from "@phading/user_session_service_interface/node/interface";

export function createAccount(
  userId: string,
  accountId: string,
  accountType: AccountType,
  naturalName: string,
  contactEmail: string,
  now: number,
  outputStatements: Array<Statement>,
): CreateSessionRequestBody {
  let billingProfileState = BillingProfileState.HEALTHY;
  let capabilitiesVersion = 0;
  let capabilities = toCapabilities(accountType, billingProfileState);
  let request: CreateSessionRequestBody = {
    userId,
    accountId,
    capabilitiesVersion,
    capabilities,
  };
  outputStatements.push(
    insertAccountStatement({
      userId,
      accountId,
      accountType,
      naturalName,
      description: "",
      contactEmail,
      avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
      avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
      createdTimeMs: now,
      lastAccessedTimeMs: now,
      billingProfileStateVersion: 0,
      billingProfileState,
      capabilitiesVersion,
    }),
    ...(capabilities.canBeBilled
      ? [
          insertBillingProfileCreatingTaskStatement({
            accountId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        ]
      : []),
    ...(capabilities.canEarn
      ? [
          insertEarningsProfileCreatingTaskStatement({
            accountId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        ]
      : []),
  );
  return request;
}
