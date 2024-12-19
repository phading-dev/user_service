import { PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';
import { Database, Transaction, Spanner } from '@google-cloud/spanner';
import { AccountType, ACCOUNT_TYPE } from '@phading/user_service_interface/account_type';
import { toEnumFromNumber, deserializeMessage, serializeMessage } from '@selfage/message/serializer';
import { AccountData, ACCOUNT_DATA } from './schema';
import { VideoPlayerSettings, VIDEO_PLAYER_SETTINGS } from '@phading/user_service_interface/web/self/video_player_settings';
import { Statement } from '@google-cloud/spanner/build/src/transaction';

export interface GetUserByIdRow {
  userUsername: string,
  userPasswordHashV1: string,
  userRecoveryEmail: string,
}

export let GET_USER_BY_ID_ROW: MessageDescriptor<GetUserByIdRow> = {
  name: 'GetUserByIdRow',
  fields: [{
    name: 'userUsername',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userPasswordHashV1',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userRecoveryEmail',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function getUserById(
  runner: Database | Transaction,
  userUserIdEq: string,
): Promise<Array<GetUserByIdRow>> {
  let [rows] = await runner.run({
    sql: "SELECT User.username, User.passwordHashV1, User.recoveryEmail FROM User WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: userUserIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserByIdRow>();
  for (let row of rows) {
    resRows.push({
      userUsername: row.at(0).value,
      userPasswordHashV1: row.at(1).value,
      userRecoveryEmail: row.at(2).value,
    });
  }
  return resRows;
}

export interface GetUserByUsernameRow {
  userUserId: string,
  userPasswordHashV1: string,
}

export let GET_USER_BY_USERNAME_ROW: MessageDescriptor<GetUserByUsernameRow> = {
  name: 'GetUserByUsernameRow',
  fields: [{
    name: 'userUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userPasswordHashV1',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function getUserByUsername(
  runner: Database | Transaction,
  userUsernameEq: string,
): Promise<Array<GetUserByUsernameRow>> {
  let [rows] = await runner.run({
    sql: "SELECT User.userId, User.passwordHashV1 FROM User WHERE User.username = @userUsernameEq",
    params: {
      userUsernameEq: userUsernameEq,
    },
    types: {
      userUsernameEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserByUsernameRow>();
  for (let row of rows) {
    resRows.push({
      userUserId: row.at(0).value,
      userPasswordHashV1: row.at(1).value,
    });
  }
  return resRows;
}

export interface GetLastAccessedAccountRow {
  accountAccountId: string,
  accountAccountType: AccountType,
}

export let GET_LAST_ACCESSED_ACCOUNT_ROW: MessageDescriptor<GetLastAccessedAccountRow> = {
  name: 'GetLastAccessedAccountRow',
  fields: [{
    name: 'accountAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 2,
    enumType: ACCOUNT_TYPE,
  }],
};

export async function getLastAccessedAccount(
  runner: Database | Transaction,
  accountUserIdEq: string,
  limit: number,
): Promise<Array<GetLastAccessedAccountRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.accountId, Account.accountType FROM Account WHERE Account.userId = @accountUserIdEq ORDER BY Account.lastAccessedTimestamp DESC LIMIT @limit",
    params: {
      accountUserIdEq: accountUserIdEq,
      limit: limit.toString(),
    },
    types: {
      accountUserIdEq: { type: "string" },
      limit: { type: "int64" },
    }
  });
  let resRows = new Array<GetLastAccessedAccountRow>();
  for (let row of rows) {
    resRows.push({
      accountAccountId: row.at(0).value,
      accountAccountType: toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
    });
  }
  return resRows;
}

export interface GetAccountByIdRow {
  accountUserId: string,
  accountAccountType: AccountType,
  accountData: AccountData,
}

export let GET_ACCOUNT_BY_ID_ROW: MessageDescriptor<GetAccountByIdRow> = {
  name: 'GetAccountByIdRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 2,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountData',
    index: 3,
    messageType: ACCOUNT_DATA,
  }],
};

export async function getAccountById(
  runner: Database | Transaction,
  accountAccountIdEq: string,
): Promise<Array<GetAccountByIdRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountType, Account.data FROM Account WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountByIdRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value,
      accountAccountType: toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
      accountData: deserializeMessage(row.at(2).value, ACCOUNT_DATA),
    });
  }
  return resRows;
}

export interface GetAccountWithDescriptionByIdRow {
  accountUserId: string,
  accountAccountType: AccountType,
  accountData: AccountData,
  accountDescription: string,
}

export let GET_ACCOUNT_WITH_DESCRIPTION_BY_ID_ROW: MessageDescriptor<GetAccountWithDescriptionByIdRow> = {
  name: 'GetAccountWithDescriptionByIdRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 2,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountData',
    index: 3,
    messageType: ACCOUNT_DATA,
  }, {
    name: 'accountDescription',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function getAccountWithDescriptionById(
  runner: Database | Transaction,
  accountAccountIdEq: string,
): Promise<Array<GetAccountWithDescriptionByIdRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountType, Account.data, Account.description FROM Account WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountWithDescriptionByIdRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value,
      accountAccountType: toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
      accountData: deserializeMessage(row.at(2).value, ACCOUNT_DATA),
      accountDescription: row.at(3).value,
    });
  }
  return resRows;
}

export interface ListAccountsRow {
  accountAccountId: string,
  accountAccountType: AccountType,
  accountData: AccountData,
}

export let LIST_ACCOUNTS_ROW: MessageDescriptor<ListAccountsRow> = {
  name: 'ListAccountsRow',
  fields: [{
    name: 'accountAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 2,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountData',
    index: 3,
    messageType: ACCOUNT_DATA,
  }],
};

export async function listAccounts(
  runner: Database | Transaction,
  accountUserIdEq: string,
): Promise<Array<ListAccountsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.accountId, Account.accountType, Account.data FROM Account WHERE Account.userId = @accountUserIdEq ORDER BY Account.lastAccessedTimestamp DESC",
    params: {
      accountUserIdEq: accountUserIdEq,
    },
    types: {
      accountUserIdEq: { type: "string" },
    }
  });
  let resRows = new Array<ListAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountAccountId: row.at(0).value,
      accountAccountType: toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
      accountData: deserializeMessage(row.at(2).value, ACCOUNT_DATA),
    });
  }
  return resRows;
}

export interface ListAccountsByTypeRow {
  accountAccountId: string,
  accountCreatedTimestamp: number,
}

export let LIST_ACCOUNTS_BY_TYPE_ROW: MessageDescriptor<ListAccountsByTypeRow> = {
  name: 'ListAccountsByTypeRow',
  fields: [{
    name: 'accountAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountCreatedTimestamp',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listAccountsByType(
  runner: Database | Transaction,
  accountCreatedTimestampLt: number,
  accountAccountTypeEq: AccountType,
  limit: number,
): Promise<Array<ListAccountsByTypeRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.accountId, Account.createdTimestamp FROM Account WHERE (Account.createdTimestamp < @accountCreatedTimestampLt AND Account.accountType = @accountAccountTypeEq) ORDER BY Account.createdTimestamp DESC LIMIT @limit",
    params: {
      accountCreatedTimestampLt: new Date(accountCreatedTimestampLt).toISOString(),
      accountAccountTypeEq: Spanner.float(accountAccountTypeEq),
      limit: limit.toString(),
    },
    types: {
      accountCreatedTimestampLt: { type: "timestamp" },
      accountAccountTypeEq: { type: "float64" },
      limit: { type: "int64" },
    }
  });
  let resRows = new Array<ListAccountsByTypeRow>();
  for (let row of rows) {
    resRows.push({
      accountAccountId: row.at(0).value,
      accountCreatedTimestamp: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface GetAccountAndUserRow {
  uUsername: string,
  uRecoveryEmail: string,
  aData: AccountData,
  aDescription: string,
}

export let GET_ACCOUNT_AND_USER_ROW: MessageDescriptor<GetAccountAndUserRow> = {
  name: 'GetAccountAndUserRow',
  fields: [{
    name: 'uUsername',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'uRecoveryEmail',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'aData',
    index: 3,
    messageType: ACCOUNT_DATA,
  }, {
    name: 'aDescription',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function getAccountAndUser(
  runner: Database | Transaction,
  uUserIdEq: string,
  aAccountIdEq: string,
): Promise<Array<GetAccountAndUserRow>> {
  let [rows] = await runner.run({
    sql: "SELECT u.username, u.recoveryEmail, a.data, a.description FROM User AS u INNER JOIN Account AS a ON u.userId = a.userId WHERE (u.userId = @uUserIdEq AND a.accountId = @aAccountIdEq)",
    params: {
      uUserIdEq: uUserIdEq,
      aAccountIdEq: aAccountIdEq,
    },
    types: {
      uUserIdEq: { type: "string" },
      aAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountAndUserRow>();
  for (let row of rows) {
    resRows.push({
      uUsername: row.at(0).value,
      uRecoveryEmail: row.at(1).value,
      aData: deserializeMessage(row.at(2).value, ACCOUNT_DATA),
      aDescription: row.at(3).value,
    });
  }
  return resRows;
}

export interface GetVideoPlayerSettingsRow {
  videoPlayerSettingsSettings: VideoPlayerSettings,
}

export let GET_VIDEO_PLAYER_SETTINGS_ROW: MessageDescriptor<GetVideoPlayerSettingsRow> = {
  name: 'GetVideoPlayerSettingsRow',
  fields: [{
    name: 'videoPlayerSettingsSettings',
    index: 1,
    messageType: VIDEO_PLAYER_SETTINGS,
  }],
};

export async function getVideoPlayerSettings(
  runner: Database | Transaction,
  videoPlayerSettingsAccountIdEq: string,
): Promise<Array<GetVideoPlayerSettingsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT VideoPlayerSettings.settings FROM VideoPlayerSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq",
    params: {
      videoPlayerSettingsAccountIdEq: videoPlayerSettingsAccountIdEq,
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetVideoPlayerSettingsRow>();
  for (let row of rows) {
    resRows.push({
      videoPlayerSettingsSettings: deserializeMessage(row.at(0).value, VIDEO_PLAYER_SETTINGS),
    });
  }
  return resRows;
}

export interface CheckPresenceOfVideoPlayerSettingsRow {
  videoPlayerSettingsAccountId: string,
}

export let CHECK_PRESENCE_OF_VIDEO_PLAYER_SETTINGS_ROW: MessageDescriptor<CheckPresenceOfVideoPlayerSettingsRow> = {
  name: 'CheckPresenceOfVideoPlayerSettingsRow',
  fields: [{
    name: 'videoPlayerSettingsAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function checkPresenceOfVideoPlayerSettings(
  runner: Database | Transaction,
  videoPlayerSettingsAccountIdEq: string,
): Promise<Array<CheckPresenceOfVideoPlayerSettingsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT VideoPlayerSettings.accountId FROM VideoPlayerSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq",
    params: {
      videoPlayerSettingsAccountIdEq: videoPlayerSettingsAccountIdEq,
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<CheckPresenceOfVideoPlayerSettingsRow>();
  for (let row of rows) {
    resRows.push({
      videoPlayerSettingsAccountId: row.at(0).value,
    });
  }
  return resRows;
}

export function insertNewUserStatement(
  userId: string,
  username: string,
  passwordHashV1: string,
  recoveryEmail: string,
): Statement {
  return {
    sql: "INSERT User (userId, username, passwordHashV1, recoveryEmail, createdTimestamp) VALUES (@userId, @username, @passwordHashV1, @recoveryEmail, PENDING_COMMIT_TIMESTAMP())",
    params: {
      userId: userId,
      username: username,
      passwordHashV1: passwordHashV1,
      recoveryEmail: recoveryEmail,
    },
    types: {
      userId: { type: "string" },
      username: { type: "string" },
      passwordHashV1: { type: "string" },
      recoveryEmail: { type: "string" },
    }
  };
}

export function insertNewAccountStatement(
  userId: string,
  accountId: string,
  accountType: AccountType,
  data: AccountData,
  description: string,
  createdTimestamp: number,
  lastAccessedTimestamp: number,
): Statement {
  return {
    sql: "INSERT Account (userId, accountId, accountType, data, description, createdTimestamp, lastAccessedTimestamp) VALUES (@userId, @accountId, @accountType, @data, @description, @createdTimestamp, @lastAccessedTimestamp)",
    params: {
      userId: userId,
      accountId: accountId,
      accountType: Spanner.float(accountType),
      data: Buffer.from(serializeMessage(data, ACCOUNT_DATA).buffer),
      description: description,
      createdTimestamp: new Date(createdTimestamp).toISOString(),
      lastAccessedTimestamp: new Date(lastAccessedTimestamp).toISOString(),
    },
    types: {
      userId: { type: "string" },
      accountId: { type: "string" },
      accountType: { type: "float64" },
      data: { type: "bytes" },
      description: { type: "string" },
      createdTimestamp: { type: "timestamp" },
      lastAccessedTimestamp: { type: "timestamp" },
    }
  };
}

export function insertNewVideoPlayerSettingsStatement(
  accountId: string,
  settings: VideoPlayerSettings,
): Statement {
  return {
    sql: "INSERT VideoPlayerSettings (accountId, settings) VALUES (@accountId, @settings)",
    params: {
      accountId: accountId,
      settings: Buffer.from(serializeMessage(settings, VIDEO_PLAYER_SETTINGS).buffer),
    },
    types: {
      accountId: { type: "string" },
      settings: { type: "bytes" },
    }
  };
}

export function updatePasswordStatement(
  userUserIdEq: string,
  setPasswordHashV1: string,
): Statement {
  return {
    sql: "UPDATE User SET passwordHashV1 = @setPasswordHashV1 WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: userUserIdEq,
      setPasswordHashV1: setPasswordHashV1,
    },
    types: {
      userUserIdEq: { type: "string" },
      setPasswordHashV1: { type: "string" },
    }
  };
}

export function updateRecoveryEmailStatement(
  userUserIdEq: string,
  setRecoveryEmail: string,
): Statement {
  return {
    sql: "UPDATE User SET recoveryEmail = @setRecoveryEmail WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: userUserIdEq,
      setRecoveryEmail: setRecoveryEmail,
    },
    types: {
      userUserIdEq: { type: "string" },
      setRecoveryEmail: { type: "string" },
    }
  };
}

export function updateLastAccessedTimestmapStatement(
  accountAccountIdEq: string,
  setLastAccessedTimestamp: number,
): Statement {
  return {
    sql: "UPDATE Account SET lastAccessedTimestamp = @setLastAccessedTimestamp WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
      setLastAccessedTimestamp: new Date(setLastAccessedTimestamp).toISOString(),
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setLastAccessedTimestamp: { type: "timestamp" },
    }
  };
}

export function updateAccountDataStatement(
  accountAccountIdEq: string,
  setData: AccountData,
): Statement {
  return {
    sql: "UPDATE Account SET data = @setData WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
      setData: Buffer.from(serializeMessage(setData, ACCOUNT_DATA).buffer),
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function updateAccountDescriptionStatement(
  accountAccountIdEq: string,
  setDescription: string,
): Statement {
  return {
    sql: "UPDATE Account SET description = @setDescription WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
      setDescription: setDescription,
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setDescription: { type: "string" },
    }
  };
}

export function updateVideoPlayerSettingsStatement(
  videoPlayerSettingsAccountIdEq: string,
  setSettings: VideoPlayerSettings,
): Statement {
  return {
    sql: "UPDATE VideoPlayerSettings SET settings = @setSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq",
    params: {
      videoPlayerSettingsAccountIdEq: videoPlayerSettingsAccountIdEq,
      setSettings: Buffer.from(serializeMessage(setSettings, VIDEO_PLAYER_SETTINGS).buffer),
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
      setSettings: { type: "bytes" },
    }
  };
}

export function deleteUserStatement(
  userUserIdEq: string,
): Statement {
  return {
    sql: "DELETE User WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: userUserIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
    }
  };
}

export function deleteAccountStatement(
  accountAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE Account WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  };
}

export function deleteVideoPlaySettingsStatement(
  videoPlayerSettingsAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE VideoPlayerSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq",
    params: {
      videoPlayerSettingsAccountIdEq: videoPlayerSettingsAccountIdEq,
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
    }
  };
}
