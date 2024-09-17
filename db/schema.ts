import { EnumDescriptor } from '@selfage/message/descriptor';

export enum AccountType {
  CONSUMER = 1,
  PUBLISHER = 2,
}

export let ACCOUNT_TYPE: EnumDescriptor<AccountType> = {
  name: 'AccountType',
  values: [{
    name: 'CONSUMER',
    value: 1,
  }, {
    name: 'PUBLISHER',
    value: 2,
  }]
}
