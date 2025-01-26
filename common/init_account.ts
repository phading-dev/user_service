import { Account, AccountMore } from "../db/schema";
import {
  DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
  DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
} from "./params";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";

export function initAccount(
  userId: string,
  accountId: string,
  accountType: AccountType,
  naturalName: string,
  contactEmail: string,
  now: number,
): Account {
  return {
    userId,
    accountId,
    accountType,
    naturalName,
    contactEmail,
    avatarSmallFilename: DEFAULT_ACCOUNT_AVATAR_SMALL_FILENAME,
    avatarLargeFilename: DEFAULT_ACCOUNT_AVATAR_LARGE_FILENAME,
    createdTimeMs: now,
    lastAccessedTimeMs: now,
    billingAccountStateInfo: {
      version: 0,
      state: BillingAccountState.HEALTHY,
    },
    capabilitiesVersion: 0,
  };
}

export function initAccountMore(accountId: string): AccountMore {
  return {
    accountId,
    description: "",
  };
}
