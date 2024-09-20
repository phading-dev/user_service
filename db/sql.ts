import { ExecuteSqlRequest, RunResponse } from '@google-cloud/spanner/build/src/transaction';
import { AccountType, ACCOUNT_TYPE } from './schema';
import { toEnumFromNumber, deserializeMessage, serializeMessage } from '@selfage/message/serializer';
import { VideoPlayerSettings, VIDEO_PLAYER_SETTINGS } from '@phading/user_service_interface/self/frontend/video_player_settings';
import { Spanner } from '@google-cloud/spanner';

export interface GetPasswordHashByIdRow {
  userPasswordHashV1?: string,
}

export async function getPasswordHashById(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  userUserId: string,
): Promise<Array<GetPasswordHashByIdRow>> {
  let [rows] = await run({
    sql: "SELECT User.passwordHashV1 FROM User WHERE User.userId = @userUserId",
    params: {
      userUserId: userUserId,
    },
    types: {
      userUserId: { type: "string" },
    }
  });
  let resRows = new Array<GetPasswordHashByIdRow>();
  for (let row of rows) {
    resRows.push({
      userPasswordHashV1: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetUserByUsernameRow {
  userUserId?: string,
  userPasswordHashV1?: string,
}

export async function getUserByUsername(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  userUsername: string,
): Promise<Array<GetUserByUsernameRow>> {
  let [rows] = await run({
    sql: "SELECT User.userId, User.passwordHashV1 FROM User WHERE User.username = @userUsername",
    params: {
      userUsername: userUsername,
    },
    types: {
      userUsername: { type: "string" },
    }
  });
  let resRows = new Array<GetUserByUsernameRow>();
  for (let row of rows) {
    resRows.push({
      userUserId: row.at(0).value == null ? undefined : row.at(0).value,
      userPasswordHashV1: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetLastAccessedAccountRow {
  accountAccountId?: string,
  accountAccountType?: AccountType,
}

export async function getLastAccessedAccount(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountUserId: string,
): Promise<Array<GetLastAccessedAccountRow>> {
  let [rows] = await run({
    sql: "SELECT Account.accountId, Account.accountType FROM Account WHERE Account.userId = @accountUserId ORDER BY Account.lastAccessedTimestamp DESC LIMIT 1",
    params: {
      accountUserId: accountUserId,
    },
    types: {
      accountUserId: { type: "string" },
    }
  });
  let resRows = new Array<GetLastAccessedAccountRow>();
  for (let row of rows) {
    resRows.push({
      accountAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountType: row.at(1).value == null ? undefined : toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
    });
  }
  return resRows;
}

export interface GetAccountByIdRow {
  accountUserId?: string,
  accountAccountType?: AccountType,
}

export async function getAccountById(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountAccountId: string,
): Promise<Array<GetAccountByIdRow>> {
  let [rows] = await run({
    sql: "SELECT Account.userId, Account.accountType FROM Account WHERE Account.accountId = @accountAccountId",
    params: {
      accountAccountId: accountAccountId,
    },
    types: {
      accountAccountId: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountByIdRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountType: row.at(1).value == null ? undefined : toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
    });
  }
  return resRows;
}

export interface GetAccountsRow {
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountAvatarSmallFilename?: string,
}

export async function getAccounts(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountUserId: string,
): Promise<Array<GetAccountsRow>> {
  let [rows] = await run({
    sql: "SELECT Account.accountId, Account.accountType, Account.naturalName, Account.avatarSmallFilename FROM Account WHERE Account.userId = @accountUserId",
    params: {
      accountUserId: accountUserId,
    },
    types: {
      accountUserId: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountType: row.at(1).value == null ? undefined : toEnumFromNumber(row.at(1).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(2).value == null ? undefined : row.at(2).value,
      accountAvatarSmallFilename: row.at(3).value == null ? undefined : row.at(3).value,
    });
  }
  return resRows;
}

export interface GetAvatarFilenameRow {
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
}

export async function getAvatarFilename(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountAccountId: string,
): Promise<Array<GetAvatarFilenameRow>> {
  let [rows] = await run({
    sql: "SELECT Account.avatarSmallFilename, Account.avatarLargeFilename FROM Account WHERE Account.accountId = @accountAccountId",
    params: {
      accountAccountId: accountAccountId,
    },
    types: {
      accountAccountId: { type: "string" },
    }
  });
  let resRows = new Array<GetAvatarFilenameRow>();
  for (let row of rows) {
    resRows.push({
      accountAvatarSmallFilename: row.at(0).value == null ? undefined : row.at(0).value,
      accountAvatarLargeFilename: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetAccountSnapshotRow {
  accountNaturalName?: string,
  accountAvatarSmallFilename?: string,
}

export async function getAccountSnapshot(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountAccountId: string,
): Promise<Array<GetAccountSnapshotRow>> {
  let [rows] = await run({
    sql: "SELECT Account.naturalName, Account.avatarSmallFilename FROM Account WHERE Account.accountId = @accountAccountId",
    params: {
      accountAccountId: accountAccountId,
    },
    types: {
      accountAccountId: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountSnapshotRow>();
  for (let row of rows) {
    resRows.push({
      accountNaturalName: row.at(0).value == null ? undefined : row.at(0).value,
      accountAvatarSmallFilename: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetAccountAndUserRow {
  uUsername?: string,
  uRecoveryEmail?: string,
  aNaturalName?: string,
  aContactEmail?: string,
  aDescription?: string,
  aAvatarLargeFilename?: string,
}

export async function getAccountAndUser(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  uUserId: string,
  aAccountId: string,
): Promise<Array<GetAccountAndUserRow>> {
  let [rows] = await run({
    sql: "SELECT u.username, u.recoveryEmail, a.naturalName, a.contactEmail, a.description, a.avatarLargeFilename FROM User AS u INNER JOIN Account AS a ON u.userId = a.userId WHERE (u.userId = @uUserId AND a.accountId = @aAccountId)",
    params: {
      uUserId: uUserId,
      aAccountId: aAccountId,
    },
    types: {
      uUserId: { type: "string" },
      aAccountId: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountAndUserRow>();
  for (let row of rows) {
    resRows.push({
      uUsername: row.at(0).value == null ? undefined : row.at(0).value,
      uRecoveryEmail: row.at(1).value == null ? undefined : row.at(1).value,
      aNaturalName: row.at(2).value == null ? undefined : row.at(2).value,
      aContactEmail: row.at(3).value == null ? undefined : row.at(3).value,
      aDescription: row.at(4).value == null ? undefined : row.at(4).value,
      aAvatarLargeFilename: row.at(5).value == null ? undefined : row.at(5).value,
    });
  }
  return resRows;
}

export interface GetVideoPlayerSettingsRow {
  videoPlayerSettingsSettings?: VideoPlayerSettings,
}

export async function getVideoPlayerSettings(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  videoPlayerSettingsAccountId: string,
): Promise<Array<GetVideoPlayerSettingsRow>> {
  let [rows] = await run({
    sql: "SELECT VideoPlayerSettings.settings FROM VideoPlayerSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountId",
    params: {
      videoPlayerSettingsAccountId: videoPlayerSettingsAccountId,
    },
    types: {
      videoPlayerSettingsAccountId: { type: "string" },
    }
  });
  let resRows = new Array<GetVideoPlayerSettingsRow>();
  for (let row of rows) {
    resRows.push({
      videoPlayerSettingsSettings: row.at(0).value == null ? undefined : deserializeMessage(row.at(0).value, VIDEO_PLAYER_SETTINGS),
    });
  }
  return resRows;
}

export interface CheckPresenceVideoPlayerSettingsRow {
  videoPlayerSettingsAccountId?: string,
}

export async function checkPresenceVideoPlayerSettings(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  videoPlayerSettingsAccountId: string,
): Promise<Array<CheckPresenceVideoPlayerSettingsRow>> {
  let [rows] = await run({
    sql: "SELECT VideoPlayerSettings.accountId FROM VideoPlayerSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountId",
    params: {
      videoPlayerSettingsAccountId: videoPlayerSettingsAccountId,
    },
    types: {
      videoPlayerSettingsAccountId: { type: "string" },
    }
  });
  let resRows = new Array<CheckPresenceVideoPlayerSettingsRow>();
  for (let row of rows) {
    resRows.push({
      videoPlayerSettingsAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export async function insertNewUser(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  userId: string,
  username: string,
  passwordHashV1: string,
  recoveryEmail: string,
): Promise<void> {
  await run({
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
  });
}

export async function insertNewAccount(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  userId: string,
  accountId: string,
  accountType: AccountType,
  naturalName: string,
  contactEmail: string,
): Promise<void> {
  await run({
    sql: "INSERT Account (userId, accountId, accountType, naturalName, contactEmail, createdTimestamp, lastAccessedTimestamp) VALUES (@userId, @accountId, @accountType, @naturalName, @contactEmail, PENDING_COMMIT_TIMESTAMP(), PENDING_COMMIT_TIMESTAMP())",
    params: {
      userId: userId,
      accountId: accountId,
      accountType: Spanner.float(accountType),
      naturalName: naturalName,
      contactEmail: contactEmail,
    },
    types: {
      userId: { type: "string" },
      accountId: { type: "string" },
      accountType: { type: "float64" },
      naturalName: { type: "string" },
      contactEmail: { type: "string" },
    }
  });
}

export async function insertNewVideoPlayerSettings(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountId: string,
  settings: VideoPlayerSettings,
): Promise<void> {
  await run({
    sql: "INSERT VideoPlayerSettings (accountId, settings) VALUES (@accountId, @settings)",
    params: {
      accountId: accountId,
      settings: Buffer.from(serializeMessage(settings, VIDEO_PLAYER_SETTINGS).buffer),
    },
    types: {
      accountId: { type: "string" },
      settings: { type: "bytes" },
    }
  });
}

export async function updatePassword(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  setPasswordHashV1: string,
  userUserId: string,
): Promise<void> {
  await run({
    sql: "UPDATE User SET passwordHashV1 = @setPasswordHashV1 WHERE User.userId = @userUserId",
    params: {
      setPasswordHashV1: setPasswordHashV1,
      userUserId: userUserId,
    },
    types: {
      setPasswordHashV1: { type: "string" },
      userUserId: { type: "string" },
    }
  });
}

export async function updateRecoveryEmail(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  setRecoveryEmail: string,
  userUserId: string,
): Promise<void> {
  await run({
    sql: "UPDATE User SET recoveryEmail = @setRecoveryEmail WHERE User.userId = @userUserId",
    params: {
      setRecoveryEmail: setRecoveryEmail,
      userUserId: userUserId,
    },
    types: {
      setRecoveryEmail: { type: "string" },
      userUserId: { type: "string" },
    }
  });
}

export async function updateLastAccessedTimestmap(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  accountAccountId: string,
): Promise<void> {
  await run({
    sql: "UPDATE Account SET lastAccessedTimestamp = PENDING_COMMIT_TIMESTAMP() WHERE Account.accountId = @accountAccountId",
    params: {
      accountAccountId: accountAccountId,
    },
    types: {
      accountAccountId: { type: "string" },
    }
  });
}

export async function updateAccountInfo(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  setNaturalName: string,
  setContactEmail: string,
  setDescription: string,
  accountAccountId: string,
): Promise<void> {
  await run({
    sql: "UPDATE Account SET naturalName = @setNaturalName, contactEmail = @setContactEmail, description = @setDescription WHERE Account.accountId = @accountAccountId",
    params: {
      setNaturalName: setNaturalName,
      setContactEmail: setContactEmail,
      setDescription: setDescription,
      accountAccountId: accountAccountId,
    },
    types: {
      setNaturalName: { type: "string" },
      setContactEmail: { type: "string" },
      setDescription: { type: "string" },
      accountAccountId: { type: "string" },
    }
  });
}

export async function updateAvatar(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  setAvatarSmallFilename: string,
  setAvatarLargeFilename: string,
  accountAccountId: string,
): Promise<void> {
  await run({
    sql: "UPDATE Account SET avatarSmallFilename = @setAvatarSmallFilename, avatarLargeFilename = @setAvatarLargeFilename WHERE Account.accountId = @accountAccountId",
    params: {
      setAvatarSmallFilename: setAvatarSmallFilename,
      setAvatarLargeFilename: setAvatarLargeFilename,
      accountAccountId: accountAccountId,
    },
    types: {
      setAvatarSmallFilename: { type: "string" },
      setAvatarLargeFilename: { type: "string" },
      accountAccountId: { type: "string" },
    }
  });
}

export async function updateVideoPlayerSettings(
  run: (query: ExecuteSqlRequest) => Promise<RunResponse>,
  setSettings: VideoPlayerSettings,
  videoPlayerSettingsAccountId: string,
): Promise<void> {
  await run({
    sql: "UPDATE VideoPlayerSettings SET settings = @setSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountId",
    params: {
      setSettings: Buffer.from(serializeMessage(setSettings, VIDEO_PLAYER_SETTINGS).buffer),
      videoPlayerSettingsAccountId: videoPlayerSettingsAccountId,
    },
    types: {
      setSettings: { type: "bytes" },
      videoPlayerSettingsAccountId: { type: "string" },
    }
  });
}
