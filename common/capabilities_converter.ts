import { AccountType } from "@phading/user_service_interface/account_type";
import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { Capabilities } from "@phading/user_session_service_interface/capabilities";

export function toCapabilities(
  accountType: AccountType,
  billingAccountState: BillingAccountState,
): Capabilities {
  return {
    canConsume:
      accountType === AccountType.CONSUMER &&
      billingAccountState === BillingAccountState.HEALTHY,
    canPublish:
      accountType === AccountType.PUBLISHER &&
      billingAccountState === BillingAccountState.HEALTHY,
    canBeBilled:
      accountType === AccountType.CONSUMER ||
      accountType === AccountType.PUBLISHER,
    canEarn: accountType === AccountType.PUBLISHER,
  };
}
