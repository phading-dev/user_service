import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "./params";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";

export function initAccount(
  userId: string,
  accountId: string,
  naturalName: string,
  contactEmail: string,
  now: number,
) {
  return {
    userId,
    accountId,
    naturalName,
    description: "",
    contactEmail,
    avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
    avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
    createdTimeMs: now,
    lastAccessedTimeMs: now,
    billingAccountStateVersion: 0,
    billingAccountState: BillingAccountState.HEALTHY,
    capabilitiesVersion: 0,
  };
}
