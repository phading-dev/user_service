import { PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';
import { BillingAccountState, BILLING_ACCOUNT_STATE } from '@phading/user_service_interface/node/billing_account_state';
import { AccountType, ACCOUNT_TYPE } from '@phading/user_service_interface/account_type';

export interface User {
  userId?: string,
  username?: string,
  passwordHashV1?: string,
  recoveryEmail?: string,
  totalAccounts?: number,
  createdTimeMs?: number,
}

export let USER: MessageDescriptor<User> = {
  name: 'User',
  fields: [{
    name: 'userId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'username',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'passwordHashV1',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'recoveryEmail',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'totalAccounts',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'createdTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export interface BillingAccountStateInfo {
  version?: number,
  state?: BillingAccountState,
}

export let BILLING_ACCOUNT_STATE_INFO: MessageDescriptor<BillingAccountStateInfo> = {
  name: 'BillingAccountStateInfo',
  fields: [{
    name: 'version',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'state',
    index: 2,
    enumType: BILLING_ACCOUNT_STATE,
  }],
};

export interface Account {
  userId?: string,
  accountId?: string,
  accountType?: AccountType,
  naturalName?: string,
  contactEmail?: string,
  avatarSmallFilename?: string,
  avatarLargeFilename?: string,
  lastAccessedTimeMs?: number,
  createdTimeMs?: number,
  billingAccountStateInfo?: BillingAccountStateInfo,
  capabilitiesVersion?: number,
}

export let ACCOUNT: MessageDescriptor<Account> = {
  name: 'Account',
  fields: [{
    name: 'userId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountType',
    index: 3,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'naturalName',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'contactEmail',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'avatarSmallFilename',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'avatarLargeFilename',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'lastAccessedTimeMs',
    index: 8,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'createdTimeMs',
    index: 9,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountStateInfo',
    index: 10,
    messageType: BILLING_ACCOUNT_STATE_INFO,
  }, {
    name: 'capabilitiesVersion',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export interface AccountMore {
  accountId?: string,
  description?: string,
}

export let ACCOUNT_MORE: MessageDescriptor<AccountMore> = {
  name: 'AccountMore',
  fields: [{
    name: 'accountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'description',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};
