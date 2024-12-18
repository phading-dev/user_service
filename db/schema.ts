import { PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';

export interface AccountData {
  naturalName?: string,
  contactEmail?: string,
  avatarSmallFilename?: string,
  avatarLargeFilename?: string,
}

export let ACCOUNT_DATA: MessageDescriptor<AccountData> = {
  name: 'AccountData',
  fields: [{
    name: 'naturalName',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'contactEmail',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'avatarSmallFilename',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'avatarLargeFilename',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }],
};
