import { BillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { Capabilities } from "@phading/user_session_service_interface/capabilities";

export function toCapabilities(
  billingAccountState: BillingAccountState,
): Capabilities {
  return {
    canConsume: billingAccountState === BillingAccountState.HEALTHY,
    canPublish: billingAccountState === BillingAccountState.HEALTHY,
    canBeBilled: true,
    canEarn: true,
  };
}
