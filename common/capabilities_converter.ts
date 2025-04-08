import { PaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import { Capabilities } from "@phading/user_session_service_interface/capabilities";
import { AccountType } from "@phading/user_service_interface/account_type";

export function toCapabilities(
  accountType: AccountType,
  paymentProfileState: PaymentProfileState,
): Capabilities {
  return {
    canConsume:
       accountType === AccountType.CONSUMER &&
       paymentProfileState === PaymentProfileState.HEALTHY,
     canPublish:
       accountType === AccountType.PUBLISHER &&
       paymentProfileState === PaymentProfileState.HEALTHY,
     canBeBilled:
       accountType === AccountType.CONSUMER ||
       accountType === AccountType.PUBLISHER,
     canEarn: accountType === AccountType.PUBLISHER,
  };
}
