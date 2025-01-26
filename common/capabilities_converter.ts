import { Account } from "../db/schema";
import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { Capabilities } from "@phading/user_session_service_interface/capabilities";

export function toCapabilities(account: Account): Capabilities {
  return {
    canConsumeShows:
      account.accountType === AccountType.CONSUMER &&
      account.billingAccountStateInfo.state === BillingAccountState.HEALTHY,
    canPublishShows:
      account.accountType === AccountType.PUBLISHER &&
      account.billingAccountStateInfo.state === BillingAccountState.HEALTHY,
    canBeBilled:
      account.accountType === AccountType.CONSUMER ||
      account.accountType === AccountType.PUBLISHER,
    canEarn: account.accountType === AccountType.PUBLISHER,
  };
}
