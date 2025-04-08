import { toCapabilities } from "../../../common/capabilities_converter";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "../../../common/constants";
import {
  insertAccountStatement,
  insertPaymentProfileCreatingTaskStatement,
  insertPayoutProfileCreatingTaskStatement,
} from "../../../db/sql";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { AccountType } from "@phading/user_service_interface/account_type";
import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
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
  let paymentProfileState = PaymentProfileState.HEALTHY;
  let capabilitiesVersion = 0;
  let capabilities = toCapabilities(accountType, paymentProfileState);
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
      paymentProfileStateVersion: 0,
      paymentProfileState,
      capabilitiesVersion,
    }),
    ...(capabilities.canBeBilled
      ? [
          insertPaymentProfileCreatingTaskStatement({
            accountId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        ]
      : []),
    ...(capabilities.canEarn
      ? [
          insertPayoutProfileCreatingTaskStatement({
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
