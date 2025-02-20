import { Statement } from '@google-cloud/spanner/build/src/transaction';
import { User, USER, Account, ACCOUNT, AccountMore, ACCOUNT_MORE } from './schema';
import { serializeMessage, deserializeMessage } from '@selfage/message/serializer';
import { Database, Transaction, Spanner } from '@google-cloud/spanner';
import { MessageDescriptor, PrimitiveType } from '@selfage/message/descriptor';
import { AccountType } from '@phading/user_service_interface/account_type';
import { VideoPlayerSettings, VIDEO_PLAYER_SETTINGS } from '@phading/user_service_interface/web/self/video_player_settings';

export function insertUserStatement(
  data: User,
): Statement {
  return insertUserInternalStatement(
    data.userId,
    data.username,
    data
  );
}

export function insertUserInternalStatement(
  userId: string,
  username: string,
  data: User,
): Statement {
  return {
    sql: "INSERT User (userId, username, data) VALUES (@userId, @username, @data)",
    params: {
      userId: userId,
      username: username,
      data: Buffer.from(serializeMessage(data, USER).buffer),
    },
    types: {
      userId: { type: "string" },
      username: { type: "string" },
      data: { type: "bytes" },
    }
  };
}

export function deleteUserStatement(
  userUserIdEq: string,
): Statement {
  return {
    sql: "DELETE User WHERE (User.userId = @userUserIdEq)",
    params: {
      userUserIdEq: userUserIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
    }
  };
}

export interface GetUserRow {
  userData: User,
}

export let GET_USER_ROW: MessageDescriptor<GetUserRow> = {
  name: 'GetUserRow',
  fields: [{
    name: 'userData',
    index: 1,
    messageType: USER,
  }],
};

export async function getUser(
  runner: Database | Transaction,
  userUserIdEq: string,
): Promise<Array<GetUserRow>> {
  let [rows] = await runner.run({
    sql: "SELECT User.data FROM User WHERE (User.userId = @userUserIdEq)",
    params: {
      userUserIdEq: userUserIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserRow>();
  for (let row of rows) {
    resRows.push({
      userData: deserializeMessage(row.at(0).value, USER),
    });
  }
  return resRows;
}

export function updateUserStatement(
  data: User,
): Statement {
  return updateUserInternalStatement(
    data.userId,
    data.username,
    data
  );
}

export function updateUserInternalStatement(
  userUserIdEq: string,
  setUsername: string,
  setData: User,
): Statement {
  return {
    sql: "UPDATE User SET username = @setUsername, data = @setData WHERE (User.userId = @userUserIdEq)",
    params: {
      userUserIdEq: userUserIdEq,
      setUsername: setUsername,
      setData: Buffer.from(serializeMessage(setData, USER).buffer),
    },
    types: {
      userUserIdEq: { type: "string" },
      setUsername: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function insertAccountStatement(
  data: Account,
): Statement {
  return insertAccountInternalStatement(
    data.accountId,
    data.userId,
    data.accountType,
    data.lastAccessedTimeMs,
    data.createdTimeMs,
    data
  );
}

export function insertAccountInternalStatement(
  accountId: string,
  userId: string,
  accountType: AccountType,
  lastAccessedTimeMs: number,
  createdTimeMs: number,
  data: Account,
): Statement {
  return {
    sql: "INSERT Account (accountId, userId, accountType, lastAccessedTimeMs, createdTimeMs, data) VALUES (@accountId, @userId, @accountType, @lastAccessedTimeMs, @createdTimeMs, @data)",
    params: {
      accountId: accountId,
      userId: userId,
      accountType: Spanner.float(accountType),
      lastAccessedTimeMs: Spanner.float(lastAccessedTimeMs),
      createdTimeMs: Spanner.float(createdTimeMs),
      data: Buffer.from(serializeMessage(data, ACCOUNT).buffer),
    },
    types: {
      accountId: { type: "string" },
      userId: { type: "string" },
      accountType: { type: "float64" },
      lastAccessedTimeMs: { type: "float64" },
      createdTimeMs: { type: "float64" },
      data: { type: "bytes" },
    }
  };
}

export function deleteAccountStatement(
  accountAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE Account WHERE (Account.accountId = @accountAccountIdEq)",
    params: {
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  };
}

export interface GetAccountRow {
  accountData: Account,
}

export let GET_ACCOUNT_ROW: MessageDescriptor<GetAccountRow> = {
  name: 'GetAccountRow',
  fields: [{
    name: 'accountData',
    index: 1,
    messageType: ACCOUNT,
  }],
};

export async function getAccount(
  runner: Database | Transaction,
  accountAccountIdEq: string,
): Promise<Array<GetAccountRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.data FROM Account WHERE (Account.accountId = @accountAccountIdEq)",
    params: {
      accountAccountIdEq: accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountRow>();
  for (let row of rows) {
    resRows.push({
      accountData: deserializeMessage(row.at(0).value, ACCOUNT),
    });
  }
  return resRows;
}

export function updateAccountStatement(
  data: Account,
): Statement {
  return updateAccountInternalStatement(
    data.accountId,
    data.userId,
    data.accountType,
    data.lastAccessedTimeMs,
    data.createdTimeMs,
    data
  );
}

export function updateAccountInternalStatement(
  accountAccountIdEq: string,
  setUserId: string,
  setAccountType: AccountType,
  setLastAccessedTimeMs: number,
  setCreatedTimeMs: number,
  setData: Account,
): Statement {
  return {
    sql: "UPDATE Account SET userId = @setUserId, accountType = @setAccountType, lastAccessedTimeMs = @setLastAccessedTimeMs, createdTimeMs = @setCreatedTimeMs, data = @setData WHERE (Account.accountId = @accountAccountIdEq)",
    params: {
      accountAccountIdEq: accountAccountIdEq,
      setUserId: setUserId,
      setAccountType: Spanner.float(setAccountType),
      setLastAccessedTimeMs: Spanner.float(setLastAccessedTimeMs),
      setCreatedTimeMs: Spanner.float(setCreatedTimeMs),
      setData: Buffer.from(serializeMessage(setData, ACCOUNT).buffer),
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setUserId: { type: "string" },
      setAccountType: { type: "float64" },
      setLastAccessedTimeMs: { type: "float64" },
      setCreatedTimeMs: { type: "float64" },
      setData: { type: "bytes" },
    }
  };
}

export function insertAccountMoreStatement(
  data: AccountMore,
): Statement {
  return insertAccountMoreInternalStatement(
    data.accountId,
    data
  );
}

export function insertAccountMoreInternalStatement(
  accountId: string,
  data: AccountMore,
): Statement {
  return {
    sql: "INSERT AccountMore (accountId, data) VALUES (@accountId, @data)",
    params: {
      accountId: accountId,
      data: Buffer.from(serializeMessage(data, ACCOUNT_MORE).buffer),
    },
    types: {
      accountId: { type: "string" },
      data: { type: "bytes" },
    }
  };
}

export function deleteAccountMoreStatement(
  accountMoreAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE AccountMore WHERE (AccountMore.accountId = @accountMoreAccountIdEq)",
    params: {
      accountMoreAccountIdEq: accountMoreAccountIdEq,
    },
    types: {
      accountMoreAccountIdEq: { type: "string" },
    }
  };
}

export function updateAccountMoreStatement(
  data: AccountMore,
): Statement {
  return updateAccountMoreInternalStatement(
    data.accountId,
    data
  );
}

export function updateAccountMoreInternalStatement(
  accountMoreAccountIdEq: string,
  setData: AccountMore,
): Statement {
  return {
    sql: "UPDATE AccountMore SET data = @setData WHERE (AccountMore.accountId = @accountMoreAccountIdEq)",
    params: {
      accountMoreAccountIdEq: accountMoreAccountIdEq,
      setData: Buffer.from(serializeMessage(setData, ACCOUNT_MORE).buffer),
    },
    types: {
      accountMoreAccountIdEq: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function insertAccountCapabilitiesUpdatingTaskStatement(
  accountId: string,
  capabilitiesVersion: number,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT AccountCapabilitiesUpdatingTask (accountId, capabilitiesVersion, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @capabilitiesVersion, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      capabilitiesVersion: Spanner.float(capabilitiesVersion),
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      capabilitiesVersion: { type: "float64" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteAccountCapabilitiesUpdatingTaskStatement(
  accountCapabilitiesUpdatingTaskAccountIdEq: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
): Statement {
  return {
    sql: "DELETE AccountCapabilitiesUpdatingTask WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
    }
  };
}

export interface GetAccountCapabilitiesUpdatingTaskRow {
  accountCapabilitiesUpdatingTaskAccountId: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersion: number,
  accountCapabilitiesUpdatingTaskRetryCount: number,
  accountCapabilitiesUpdatingTaskExecutionTimeMs: number,
  accountCapabilitiesUpdatingTaskCreatedTimeMs: number,
}

export let GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_ROW: MessageDescriptor<GetAccountCapabilitiesUpdatingTaskRow> = {
  name: 'GetAccountCapabilitiesUpdatingTaskRow',
  fields: [{
    name: 'accountCapabilitiesUpdatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountCapabilitiesUpdatingTaskCapabilitiesVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountCapabilitiesUpdatingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountCapabilitiesUpdatingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountCapabilitiesUpdatingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getAccountCapabilitiesUpdatingTask(
  runner: Database | Transaction,
  accountCapabilitiesUpdatingTaskAccountIdEq: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
): Promise<Array<GetAccountCapabilitiesUpdatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT AccountCapabilitiesUpdatingTask.accountId, AccountCapabilitiesUpdatingTask.capabilitiesVersion, AccountCapabilitiesUpdatingTask.retryCount, AccountCapabilitiesUpdatingTask.executionTimeMs, AccountCapabilitiesUpdatingTask.createdTimeMs FROM AccountCapabilitiesUpdatingTask WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetAccountCapabilitiesUpdatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      accountCapabilitiesUpdatingTaskAccountId: row.at(0).value,
      accountCapabilitiesUpdatingTaskCapabilitiesVersion: row.at(1).value.value,
      accountCapabilitiesUpdatingTaskRetryCount: row.at(2).value.value,
      accountCapabilitiesUpdatingTaskExecutionTimeMs: row.at(3).value.valueOf(),
      accountCapabilitiesUpdatingTaskCreatedTimeMs: row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingAccountCapabilitiesUpdatingTasksRow {
  accountCapabilitiesUpdatingTaskAccountId: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersion: number,
}

export let LIST_PENDING_ACCOUNT_CAPABILITIES_UPDATING_TASKS_ROW: MessageDescriptor<ListPendingAccountCapabilitiesUpdatingTasksRow> = {
  name: 'ListPendingAccountCapabilitiesUpdatingTasksRow',
  fields: [{
    name: 'accountCapabilitiesUpdatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountCapabilitiesUpdatingTaskCapabilitiesVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingAccountCapabilitiesUpdatingTasks(
  runner: Database | Transaction,
  accountCapabilitiesUpdatingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingAccountCapabilitiesUpdatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT AccountCapabilitiesUpdatingTask.accountId, AccountCapabilitiesUpdatingTask.capabilitiesVersion FROM AccountCapabilitiesUpdatingTask WHERE AccountCapabilitiesUpdatingTask.executionTimeMs <= @accountCapabilitiesUpdatingTaskExecutionTimeMsLe",
    params: {
      accountCapabilitiesUpdatingTaskExecutionTimeMsLe: new Date(accountCapabilitiesUpdatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      accountCapabilitiesUpdatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingAccountCapabilitiesUpdatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      accountCapabilitiesUpdatingTaskAccountId: row.at(0).value,
      accountCapabilitiesUpdatingTaskCapabilitiesVersion: row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetAccountCapabilitiesUpdatingTaskMetadataRow {
  accountCapabilitiesUpdatingTaskRetryCount: number,
  accountCapabilitiesUpdatingTaskExecutionTimeMs: number,
}

export let GET_ACCOUNT_CAPABILITIES_UPDATING_TASK_METADATA_ROW: MessageDescriptor<GetAccountCapabilitiesUpdatingTaskMetadataRow> = {
  name: 'GetAccountCapabilitiesUpdatingTaskMetadataRow',
  fields: [{
    name: 'accountCapabilitiesUpdatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountCapabilitiesUpdatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getAccountCapabilitiesUpdatingTaskMetadata(
  runner: Database | Transaction,
  accountCapabilitiesUpdatingTaskAccountIdEq: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
): Promise<Array<GetAccountCapabilitiesUpdatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT AccountCapabilitiesUpdatingTask.retryCount, AccountCapabilitiesUpdatingTask.executionTimeMs FROM AccountCapabilitiesUpdatingTask WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetAccountCapabilitiesUpdatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      accountCapabilitiesUpdatingTaskRetryCount: row.at(0).value.value,
      accountCapabilitiesUpdatingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateAccountCapabilitiesUpdatingTaskMetadataStatement(
  accountCapabilitiesUpdatingTaskAccountIdEq: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE AccountCapabilitiesUpdatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertVideoPlayerSettingsStatement(
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

export function deleteVideoPlayerSettingsStatement(
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

export interface GetUserByUsernameRow {
  userData: User,
}

export let GET_USER_BY_USERNAME_ROW: MessageDescriptor<GetUserByUsernameRow> = {
  name: 'GetUserByUsernameRow',
  fields: [{
    name: 'userData',
    index: 1,
    messageType: USER,
  }],
};

export async function getUserByUsername(
  runner: Database | Transaction,
  userUsernameEq: string,
): Promise<Array<GetUserByUsernameRow>> {
  let [rows] = await runner.run({
    sql: "SELECT User.data FROM User WHERE User.username = @userUsernameEq",
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
      userData: deserializeMessage(row.at(0).value, USER),
    });
  }
  return resRows;
}

export interface ListLastAccessedAccountsRow {
  accountData: Account,
}

export let LIST_LAST_ACCESSED_ACCOUNTS_ROW: MessageDescriptor<ListLastAccessedAccountsRow> = {
  name: 'ListLastAccessedAccountsRow',
  fields: [{
    name: 'accountData',
    index: 1,
    messageType: ACCOUNT,
  }],
};

export async function listLastAccessedAccounts(
  runner: Database | Transaction,
  accountUserIdEq: string,
  limit: number,
): Promise<Array<ListLastAccessedAccountsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.data FROM Account WHERE Account.userId = @accountUserIdEq ORDER BY Account.lastAccessedTimeMs DESC LIMIT @limit",
    params: {
      accountUserIdEq: accountUserIdEq,
      limit: limit.toString(),
    },
    types: {
      accountUserIdEq: { type: "string" },
      limit: { type: "int64" },
    }
  });
  let resRows = new Array<ListLastAccessedAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountData: deserializeMessage(row.at(0).value, ACCOUNT),
    });
  }
  return resRows;
}

export interface GetAccountAndMoreByIdRow {
  aData: Account,
  amData: AccountMore,
}

export let GET_ACCOUNT_AND_MORE_BY_ID_ROW: MessageDescriptor<GetAccountAndMoreByIdRow> = {
  name: 'GetAccountAndMoreByIdRow',
  fields: [{
    name: 'aData',
    index: 1,
    messageType: ACCOUNT,
  }, {
    name: 'amData',
    index: 2,
    messageType: ACCOUNT_MORE,
  }],
};

export async function getAccountAndMoreById(
  runner: Database | Transaction,
  aAccountIdEq: string,
): Promise<Array<GetAccountAndMoreByIdRow>> {
  let [rows] = await runner.run({
    sql: "SELECT a.data, am.data FROM Account AS a INNER JOIN AccountMore AS am ON a.accountId = am.accountId WHERE a.accountId = @aAccountIdEq",
    params: {
      aAccountIdEq: aAccountIdEq,
    },
    types: {
      aAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountAndMoreByIdRow>();
  for (let row of rows) {
    resRows.push({
      aData: deserializeMessage(row.at(0).value, ACCOUNT),
      amData: deserializeMessage(row.at(1).value, ACCOUNT_MORE),
    });
  }
  return resRows;
}

export interface GetUserAndAccountAndMoreRow {
  uData: User,
  aData: Account,
  amData: AccountMore,
}

export let GET_USER_AND_ACCOUNT_AND_MORE_ROW: MessageDescriptor<GetUserAndAccountAndMoreRow> = {
  name: 'GetUserAndAccountAndMoreRow',
  fields: [{
    name: 'uData',
    index: 1,
    messageType: USER,
  }, {
    name: 'aData',
    index: 2,
    messageType: ACCOUNT,
  }, {
    name: 'amData',
    index: 3,
    messageType: ACCOUNT_MORE,
  }],
};

export async function getUserAndAccountAndMore(
  runner: Database | Transaction,
  uUserIdEq: string,
  aAccountIdEq: string,
): Promise<Array<GetUserAndAccountAndMoreRow>> {
  let [rows] = await runner.run({
    sql: "SELECT u.data, a.data, am.data FROM User AS u INNER JOIN Account AS a ON u.userId = a.userId INNER JOIN AccountMore AS am ON a.accountId = am.accountId WHERE (u.userId = @uUserIdEq AND a.accountId = @aAccountIdEq)",
    params: {
      uUserIdEq: uUserIdEq,
      aAccountIdEq: aAccountIdEq,
    },
    types: {
      uUserIdEq: { type: "string" },
      aAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserAndAccountAndMoreRow>();
  for (let row of rows) {
    resRows.push({
      uData: deserializeMessage(row.at(0).value, USER),
      aData: deserializeMessage(row.at(1).value, ACCOUNT),
      amData: deserializeMessage(row.at(2).value, ACCOUNT_MORE),
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
