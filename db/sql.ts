import { Database, Transaction, Spanner } from '@google-cloud/spanner';
import { AccountType, ACCOUNT_TYPE } from '@phading/user_service_interface/account_type';
import { toEnumFromNumber, deserializeMessage, serializeMessage } from '@selfage/message/serializer';
import { VideoPlayerSettings, VIDEO_PLAYER_SETTINGS } from '@phading/user_service_interface/frontend/self/video_player_settings';
import { Statement } from '@google-cloud/spanner/build/src/transaction';

export interface GetUserByIdRow {
  userUsername: string,
  userPasswordHashV1: string,
  userRecoveryEmail: string,
}

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

export async function getLastAccessedAccount(
  runner: Database | Transaction,
  accountUserIdEq: string,
  limit: number,
): Promise<Array<GetLastAccessedAccountRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.accountId, Account.accountType FROM Account WHERE Account.userId = @accountUserIdEq ORDER BY Account.lastAccessedTimestamp DESC LIMIT @limit",
    params: {
      accountUserIdEq: accountUserIdEq,
      limit: limit,
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
  accountNaturalName: string,
  accountContactEmail: string,
  accountAvatarSmallFilename: string,
  accountAvatarLargeFilename: string,
}

export async function getAccountById(
  runner: Database | Transaction,
  accountAccountIdEq: string,
): Promise<Array<GetAccountByIdRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountType, Account.naturalName, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename FROM Account WHERE Account.accountId = @accountAccountIdEq",
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
      accountNaturalName: row.at(2).value,
      accountContactEmail: row.at(3).value,
      accountAvatarSmallFilename: row.at(4).value,
      accountAvatarLargeFilename: row.at(5).value,
    });
  }
  return resRows;
}

export interface GetFullAccountByIdRow {
  accountUserId: string,
  accountAccountType: AccountType,
  accountNaturalName: string,
  accountDescription: string,
  accountContactEmail: string,
  accountAvatarSmallFilename: string,
  accountAvatarLargeFilename: string,
}

export async function getFullAccountById(
  runner: Database | Transaction,
  accountAccountIdEq: string,
): Promise<Array<GetFullAccountByIdRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountType, Account.naturalName, Account.description, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename FROM Account WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetFullAccountByIdRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value,
      accountAccountType: toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(2).value,
      accountDescription: row.at(3).value,
      accountContactEmail: row.at(4).value,
      accountAvatarSmallFilename: row.at(5).value,
      accountAvatarLargeFilename: row.at(6).value,
    });
  }
  return resRows;
}

export interface GetAccountsRow {
  accountAccountId: string,
  accountAccountType: AccountType,
  accountNaturalName: string,
  accountAvatarSmallFilename: string,
}

export async function getAccounts(
  runner: Database | Transaction,
  accountUserIdEq: string,
): Promise<Array<GetAccountsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.accountId, Account.accountType, Account.naturalName, Account.avatarSmallFilename FROM Account WHERE Account.userId = @accountUserIdEq ORDER BY Account.lastAccessedTimestamp DESC",
    params: {
      accountUserIdEq: accountUserIdEq,
    },
    types: {
      accountUserIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountAccountId: row.at(0).value,
      accountAccountType: toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(2).value,
      accountAvatarSmallFilename: row.at(3).value,
    });
  }
  return resRows;
}

export interface ListAccountsByTypeRow {
  accountAccountId: string,
  accountCreatedTimestamp: number,
}

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
      limit: limit,
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
  aNaturalName: string,
  aContactEmail: string,
  aDescription: string,
  aAvatarLargeFilename: string,
}

export async function getAccountAndUser(
  runner: Database | Transaction,
  uUserIdEq: string,
  aAccountIdEq: string,
): Promise<Array<GetAccountAndUserRow>> {
  let [rows] = await runner.run({
    sql: "SELECT u.username, u.recoveryEmail, a.naturalName, a.contactEmail, a.description, a.avatarLargeFilename FROM User AS u INNER JOIN Account AS a ON u.userId = a.userId WHERE (u.userId = @uUserIdEq AND a.accountId = @aAccountIdEq)",
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
      aNaturalName: row.at(2).value,
      aContactEmail: row.at(3).value,
      aDescription: row.at(4).value,
      aAvatarLargeFilename: row.at(5).value,
    });
  }
  return resRows;
}

export interface GetVideoPlayerSettingsRow {
  videoPlayerSettingsSettings: VideoPlayerSettings,
}

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
  naturalName: string,
  description: string,
  contactEmail: string,
  avatarSmallFilename: string,
  avatarLargeFilename: string,
  createdTimestamp: number,
  lastAccessedTimestamp: number,
): Statement {
  return {
    sql: "INSERT Account (userId, accountId, accountType, naturalName, description, contactEmail, avatarSmallFilename, avatarLargeFilename, createdTimestamp, lastAccessedTimestamp) VALUES (@userId, @accountId, @accountType, @naturalName, @description, @contactEmail, @avatarSmallFilename, @avatarLargeFilename, @createdTimestamp, @lastAccessedTimestamp)",
    params: {
      userId: userId,
      accountId: accountId,
      accountType: Spanner.float(accountType),
      naturalName: naturalName,
      description: description,
      contactEmail: contactEmail,
      avatarSmallFilename: avatarSmallFilename,
      avatarLargeFilename: avatarLargeFilename,
      createdTimestamp: new Date(createdTimestamp).toISOString(),
      lastAccessedTimestamp: new Date(lastAccessedTimestamp).toISOString(),
    },
    types: {
      userId: { type: "string" },
      accountId: { type: "string" },
      accountType: { type: "float64" },
      naturalName: { type: "string" },
      description: { type: "string" },
      contactEmail: { type: "string" },
      avatarSmallFilename: { type: "string" },
      avatarLargeFilename: { type: "string" },
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
  setPasswordHashV1: string,
  userUserIdEq: string,
): Statement {
  return {
    sql: "UPDATE User SET passwordHashV1 = @setPasswordHashV1 WHERE User.userId = @userUserIdEq",
    params: {
      setPasswordHashV1: setPasswordHashV1,
      userUserIdEq: userUserIdEq,
    },
    types: {
      setPasswordHashV1: { type: "string" },
      userUserIdEq: { type: "string" },
    }
  };
}

export function updateRecoveryEmailStatement(
  setRecoveryEmail: string,
  userUserIdEq: string,
): Statement {
  return {
    sql: "UPDATE User SET recoveryEmail = @setRecoveryEmail WHERE User.userId = @userUserIdEq",
    params: {
      setRecoveryEmail: setRecoveryEmail,
      userUserIdEq: userUserIdEq,
    },
    types: {
      setRecoveryEmail: { type: "string" },
      userUserIdEq: { type: "string" },
    }
  };
}

export function updateLastAccessedTimestmapStatement(
  setLastAccessedTimestamp: number,
  accountAccountIdEq: string,
): Statement {
  return {
    sql: "UPDATE Account SET lastAccessedTimestamp = @setLastAccessedTimestamp WHERE Account.accountId = @accountAccountIdEq",
    params: {
      setLastAccessedTimestamp: new Date(setLastAccessedTimestamp).toISOString(),
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      setLastAccessedTimestamp: { type: "timestamp" },
      accountAccountIdEq: { type: "string" },
    }
  };
}

export function updateAccountInfoStatement(
  setNaturalName: string,
  setContactEmail: string,
  setDescription: string,
  accountAccountIdEq: string,
): Statement {
  return {
    sql: "UPDATE Account SET naturalName = @setNaturalName, contactEmail = @setContactEmail, description = @setDescription WHERE Account.accountId = @accountAccountIdEq",
    params: {
      setNaturalName: setNaturalName,
      setContactEmail: setContactEmail,
      setDescription: setDescription,
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      setNaturalName: { type: "string" },
      setContactEmail: { type: "string" },
      setDescription: { type: "string" },
      accountAccountIdEq: { type: "string" },
    }
  };
}

export function updateAvatarStatement(
  setAvatarSmallFilename: string,
  setAvatarLargeFilename: string,
  accountAccountIdEq: string,
): Statement {
  return {
    sql: "UPDATE Account SET avatarSmallFilename = @setAvatarSmallFilename, avatarLargeFilename = @setAvatarLargeFilename WHERE Account.accountId = @accountAccountIdEq",
    params: {
      setAvatarSmallFilename: setAvatarSmallFilename,
      setAvatarLargeFilename: setAvatarLargeFilename,
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      setAvatarSmallFilename: { type: "string" },
      setAvatarLargeFilename: { type: "string" },
      accountAccountIdEq: { type: "string" },
    }
  };
}

export function updateVideoPlayerSettingsStatement(
  setSettings: VideoPlayerSettings,
  videoPlayerSettingsAccountIdEq: string,
): Statement {
  return {
    sql: "UPDATE VideoPlayerSettings SET settings = @setSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq",
    params: {
      setSettings: Buffer.from(serializeMessage(setSettings, VIDEO_PLAYER_SETTINGS).buffer),
      videoPlayerSettingsAccountIdEq: videoPlayerSettingsAccountIdEq,
    },
    types: {
      setSettings: { type: "bytes" },
      videoPlayerSettingsAccountIdEq: { type: "string" },
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
