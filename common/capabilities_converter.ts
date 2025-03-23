import { BillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
import { Capabilities } from "@phading/user_session_service_interface/capabilities";
import { AccountType } from "@phading/user_service_interface/account_type";

export function toCapabilities(
  accountType: AccountType,
  billingProfileState: BillingProfileState,
): Capabilities {
  return {
    canConsume:
       accountType === AccountType.CONSUMER &&
       billingProfileState === BillingProfileState.HEALTHY,
     canPublish:
       accountType === AccountType.PUBLISHER &&
       billingProfileState === BillingProfileState.HEALTHY,
     canBeBilled:
       accountType === AccountType.CONSUMER ||
       accountType === AccountType.PUBLISHER,
     canEarn: accountType === AccountType.PUBLISHER,
  };
}
