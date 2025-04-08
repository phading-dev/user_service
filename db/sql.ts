import { Spanner, Database, Transaction } from '@google-cloud/spanner';
import { Statement } from '@google-cloud/spanner/build/src/transaction';
import { PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';
import { AccountType, ACCOUNT_TYPE } from '@phading/user_service_interface/account_type';
import { PaymentProfileState, PAYMENT_PROFILE_STATE } from '@phading/user_service_interface/node/payment_profile_state';
import { toEnumFromNumber, serializeMessage, deserializeMessage } from '@selfage/message/serializer';
import { VideoPlayerSettings, VIDEO_PLAYER_SETTINGS } from '@phading/user_service_interface/web/self/video_player_settings';

export function insertUserStatement(
  args: {
    userId: string,
    username: string,
    passwordHashV1?: string,
    recoveryEmail?: string,
    totalAccounts?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT User (userId, username, passwordHashV1, recoveryEmail, totalAccounts, createdTimeMs) VALUES (@userId, @username, @passwordHashV1, @recoveryEmail, @totalAccounts, @createdTimeMs)",
    params: {
      userId: args.userId,
      username: args.username,
      passwordHashV1: args.passwordHashV1 == null ? null : args.passwordHashV1,
      recoveryEmail: args.recoveryEmail == null ? null : args.recoveryEmail,
      totalAccounts: args.totalAccounts == null ? null : Spanner.float(args.totalAccounts),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      userId: { type: "string" },
      username: { type: "string" },
      passwordHashV1: { type: "string" },
      recoveryEmail: { type: "string" },
      totalAccounts: { type: "float64" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deleteUserStatement(
  args: {
    userUserIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE User WHERE (User.userId = @userUserIdEq)",
    params: {
      userUserIdEq: args.userUserIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
    }
  };
}

export interface GetUserRow {
  userUserId?: string,
  userUsername?: string,
  userPasswordHashV1?: string,
  userRecoveryEmail?: string,
  userTotalAccounts?: number,
  userCreatedTimeMs?: number,
}

export let GET_USER_ROW: MessageDescriptor<GetUserRow> = {
  name: 'GetUserRow',
  fields: [{
    name: 'userUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userUsername',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userPasswordHashV1',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userRecoveryEmail',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userTotalAccounts',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'userCreatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getUser(
  runner: Database | Transaction,
  args: {
    userUserIdEq: string,
  }
): Promise<Array<GetUserRow>> {
  let [rows] = await runner.run({
    sql: "SELECT User.userId, User.username, User.passwordHashV1, User.recoveryEmail, User.totalAccounts, User.createdTimeMs FROM User WHERE (User.userId = @userUserIdEq)",
    params: {
      userUserIdEq: args.userUserIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserRow>();
  for (let row of rows) {
    resRows.push({
      userUserId: row.at(0).value == null ? undefined : row.at(0).value,
      userUsername: row.at(1).value == null ? undefined : row.at(1).value,
      userPasswordHashV1: row.at(2).value == null ? undefined : row.at(2).value,
      userRecoveryEmail: row.at(3).value == null ? undefined : row.at(3).value,
      userTotalAccounts: row.at(4).value == null ? undefined : row.at(4).value.value,
      userCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
    });
  }
  return resRows;
}

export function insertAccountStatement(
  args: {
    userId: string,
    accountId: string,
    accountType?: AccountType,
    naturalName?: string,
    description?: string,
    contactEmail?: string,
    avatarSmallFilename?: string,
    avatarLargeFilename?: string,
    lastAccessedTimeMs?: number,
    createdTimeMs?: number,
    paymentProfileStateVersion?: number,
    paymentProfileState?: PaymentProfileState,
    capabilitiesVersion?: number,
  }
): Statement {
  return {
    sql: "INSERT Account (userId, accountId, accountType, naturalName, description, contactEmail, avatarSmallFilename, avatarLargeFilename, lastAccessedTimeMs, createdTimeMs, paymentProfileStateVersion, paymentProfileState, capabilitiesVersion) VALUES (@userId, @accountId, @accountType, @naturalName, @description, @contactEmail, @avatarSmallFilename, @avatarLargeFilename, @lastAccessedTimeMs, @createdTimeMs, @paymentProfileStateVersion, @paymentProfileState, @capabilitiesVersion)",
    params: {
      userId: args.userId,
      accountId: args.accountId,
      accountType: args.accountType == null ? null : Spanner.float(args.accountType),
      naturalName: args.naturalName == null ? null : args.naturalName,
      description: args.description == null ? null : args.description,
      contactEmail: args.contactEmail == null ? null : args.contactEmail,
      avatarSmallFilename: args.avatarSmallFilename == null ? null : args.avatarSmallFilename,
      avatarLargeFilename: args.avatarLargeFilename == null ? null : args.avatarLargeFilename,
      lastAccessedTimeMs: args.lastAccessedTimeMs == null ? null : Spanner.float(args.lastAccessedTimeMs),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
      paymentProfileStateVersion: args.paymentProfileStateVersion == null ? null : Spanner.float(args.paymentProfileStateVersion),
      paymentProfileState: args.paymentProfileState == null ? null : Spanner.float(args.paymentProfileState),
      capabilitiesVersion: args.capabilitiesVersion == null ? null : Spanner.float(args.capabilitiesVersion),
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
      lastAccessedTimeMs: { type: "float64" },
      createdTimeMs: { type: "float64" },
      paymentProfileStateVersion: { type: "float64" },
      paymentProfileState: { type: "float64" },
      capabilitiesVersion: { type: "float64" },
    }
  };
}

export function deleteAccountStatement(
  args: {
    accountAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE Account WHERE (Account.accountId = @accountAccountIdEq)",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  };
}

export interface GetAccountRow {
  accountUserId?: string,
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountDescription?: string,
  accountContactEmail?: string,
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
  accountLastAccessedTimeMs?: number,
  accountCreatedTimeMs?: number,
  accountPaymentProfileStateVersion?: number,
  accountPaymentProfileState?: PaymentProfileState,
  accountCapabilitiesVersion?: number,
}

export let GET_ACCOUNT_ROW: MessageDescriptor<GetAccountRow> = {
  name: 'GetAccountRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 3,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountNaturalName',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountDescription',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountContactEmail',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarSmallFilename',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarLargeFilename',
    index: 8,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountLastAccessedTimeMs',
    index: 9,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountCreatedTimeMs',
    index: 10,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileStateVersion',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileState',
    index: 12,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'accountCapabilitiesVersion',
    index: 13,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getAccount(
  runner: Database | Transaction,
  args: {
    accountAccountIdEq: string,
  }
): Promise<Array<GetAccountRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountId, Account.accountType, Account.naturalName, Account.description, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename, Account.lastAccessedTimeMs, Account.createdTimeMs, Account.paymentProfileStateVersion, Account.paymentProfileState, Account.capabilitiesVersion FROM Account WHERE (Account.accountId = @accountAccountIdEq)",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      accountAccountType: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(3).value == null ? undefined : row.at(3).value,
      accountDescription: row.at(4).value == null ? undefined : row.at(4).value,
      accountContactEmail: row.at(5).value == null ? undefined : row.at(5).value,
      accountAvatarSmallFilename: row.at(6).value == null ? undefined : row.at(6).value,
      accountAvatarLargeFilename: row.at(7).value == null ? undefined : row.at(7).value,
      accountLastAccessedTimeMs: row.at(8).value == null ? undefined : row.at(8).value.value,
      accountCreatedTimeMs: row.at(9).value == null ? undefined : row.at(9).value.value,
      accountPaymentProfileStateVersion: row.at(10).value == null ? undefined : row.at(10).value.value,
      accountPaymentProfileState: row.at(11).value == null ? undefined : toEnumFromNumber(row.at(11).value.value, PAYMENT_PROFILE_STATE),
      accountCapabilitiesVersion: row.at(12).value == null ? undefined : row.at(12).value.value,
    });
  }
  return resRows;
}

export function insertVideoPlayerSettingsStatement(
  args: {
    accountId: string,
    settings?: VideoPlayerSettings,
  }
): Statement {
  return {
    sql: "INSERT VideoPlayerSettings (accountId, settings) VALUES (@accountId, @settings)",
    params: {
      accountId: args.accountId,
      settings: args.settings == null ? null : Buffer.from(serializeMessage(args.settings, VIDEO_PLAYER_SETTINGS).buffer),
    },
    types: {
      accountId: { type: "string" },
      settings: { type: "bytes" },
    }
  };
}

export function deleteVideoPlayerSettingsStatement(
  args: {
    videoPlayerSettingsAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE VideoPlayerSettings WHERE (VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq)",
    params: {
      videoPlayerSettingsAccountIdEq: args.videoPlayerSettingsAccountIdEq,
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
    }
  };
}

export interface GetVideoPlayerSettingsRow {
  videoPlayerSettingsAccountId?: string,
  videoPlayerSettingsSettings?: VideoPlayerSettings,
}

export let GET_VIDEO_PLAYER_SETTINGS_ROW: MessageDescriptor<GetVideoPlayerSettingsRow> = {
  name: 'GetVideoPlayerSettingsRow',
  fields: [{
    name: 'videoPlayerSettingsAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'videoPlayerSettingsSettings',
    index: 2,
    messageType: VIDEO_PLAYER_SETTINGS,
  }],
};

export async function getVideoPlayerSettings(
  runner: Database | Transaction,
  args: {
    videoPlayerSettingsAccountIdEq: string,
  }
): Promise<Array<GetVideoPlayerSettingsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT VideoPlayerSettings.accountId, VideoPlayerSettings.settings FROM VideoPlayerSettings WHERE (VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq)",
    params: {
      videoPlayerSettingsAccountIdEq: args.videoPlayerSettingsAccountIdEq,
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetVideoPlayerSettingsRow>();
  for (let row of rows) {
    resRows.push({
      videoPlayerSettingsAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      videoPlayerSettingsSettings: row.at(1).value == null ? undefined : deserializeMessage(row.at(1).value, VIDEO_PLAYER_SETTINGS),
    });
  }
  return resRows;
}

export function updateVideoPlayerSettingsStatement(
  args: {
    videoPlayerSettingsAccountIdEq: string,
    setSettings?: VideoPlayerSettings,
  }
): Statement {
  return {
    sql: "UPDATE VideoPlayerSettings SET settings = @setSettings WHERE (VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq)",
    params: {
      videoPlayerSettingsAccountIdEq: args.videoPlayerSettingsAccountIdEq,
      setSettings: args.setSettings == null ? null : Buffer.from(serializeMessage(args.setSettings, VIDEO_PLAYER_SETTINGS).buffer),
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
      setSettings: { type: "bytes" },
    }
  };
}

export function insertAccountCapabilitiesUpdatingTaskStatement(
  args: {
    accountId: string,
    capabilitiesVersion: number,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT AccountCapabilitiesUpdatingTask (accountId, capabilitiesVersion, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @capabilitiesVersion, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      capabilitiesVersion: Spanner.float(args.capabilitiesVersion),
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
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
  args: {
    accountCapabilitiesUpdatingTaskAccountIdEq: string,
    accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
  }
): Statement {
  return {
    sql: "DELETE AccountCapabilitiesUpdatingTask WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: args.accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(args.accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
    }
  };
}

export interface GetAccountCapabilitiesUpdatingTaskRow {
  accountCapabilitiesUpdatingTaskAccountId?: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersion?: number,
  accountCapabilitiesUpdatingTaskRetryCount?: number,
  accountCapabilitiesUpdatingTaskExecutionTimeMs?: number,
  accountCapabilitiesUpdatingTaskCreatedTimeMs?: number,
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
  args: {
    accountCapabilitiesUpdatingTaskAccountIdEq: string,
    accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
  }
): Promise<Array<GetAccountCapabilitiesUpdatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT AccountCapabilitiesUpdatingTask.accountId, AccountCapabilitiesUpdatingTask.capabilitiesVersion, AccountCapabilitiesUpdatingTask.retryCount, AccountCapabilitiesUpdatingTask.executionTimeMs, AccountCapabilitiesUpdatingTask.createdTimeMs FROM AccountCapabilitiesUpdatingTask WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: args.accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(args.accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetAccountCapabilitiesUpdatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      accountCapabilitiesUpdatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      accountCapabilitiesUpdatingTaskCapabilitiesVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
      accountCapabilitiesUpdatingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      accountCapabilitiesUpdatingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      accountCapabilitiesUpdatingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingAccountCapabilitiesUpdatingTasksRow {
  accountCapabilitiesUpdatingTaskAccountId?: string,
  accountCapabilitiesUpdatingTaskCapabilitiesVersion?: number,
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
  args: {
    accountCapabilitiesUpdatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingAccountCapabilitiesUpdatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT AccountCapabilitiesUpdatingTask.accountId, AccountCapabilitiesUpdatingTask.capabilitiesVersion FROM AccountCapabilitiesUpdatingTask WHERE AccountCapabilitiesUpdatingTask.executionTimeMs <= @accountCapabilitiesUpdatingTaskExecutionTimeMsLe",
    params: {
      accountCapabilitiesUpdatingTaskExecutionTimeMsLe: args.accountCapabilitiesUpdatingTaskExecutionTimeMsLe == null ? null : new Date(args.accountCapabilitiesUpdatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      accountCapabilitiesUpdatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingAccountCapabilitiesUpdatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      accountCapabilitiesUpdatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      accountCapabilitiesUpdatingTaskCapabilitiesVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetAccountCapabilitiesUpdatingTaskMetadataRow {
  accountCapabilitiesUpdatingTaskRetryCount?: number,
  accountCapabilitiesUpdatingTaskExecutionTimeMs?: number,
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
  args: {
    accountCapabilitiesUpdatingTaskAccountIdEq: string,
    accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
  }
): Promise<Array<GetAccountCapabilitiesUpdatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT AccountCapabilitiesUpdatingTask.retryCount, AccountCapabilitiesUpdatingTask.executionTimeMs FROM AccountCapabilitiesUpdatingTask WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: args.accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(args.accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetAccountCapabilitiesUpdatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      accountCapabilitiesUpdatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      accountCapabilitiesUpdatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateAccountCapabilitiesUpdatingTaskMetadataStatement(
  args: {
    accountCapabilitiesUpdatingTaskAccountIdEq: string,
    accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: number,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE AccountCapabilitiesUpdatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (AccountCapabilitiesUpdatingTask.accountId = @accountCapabilitiesUpdatingTaskAccountIdEq AND AccountCapabilitiesUpdatingTask.capabilitiesVersion = @accountCapabilitiesUpdatingTaskCapabilitiesVersionEq)",
    params: {
      accountCapabilitiesUpdatingTaskAccountIdEq: args.accountCapabilitiesUpdatingTaskAccountIdEq,
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: Spanner.float(args.accountCapabilitiesUpdatingTaskCapabilitiesVersionEq),
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      accountCapabilitiesUpdatingTaskAccountIdEq: { type: "string" },
      accountCapabilitiesUpdatingTaskCapabilitiesVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentProfileCreatingTaskStatement(
  args: {
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentProfileCreatingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePaymentProfileCreatingTaskStatement(
  args: {
    paymentProfileCreatingTaskAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentProfileCreatingTask WHERE (PaymentProfileCreatingTask.accountId = @paymentProfileCreatingTaskAccountIdEq)",
    params: {
      paymentProfileCreatingTaskAccountIdEq: args.paymentProfileCreatingTaskAccountIdEq,
    },
    types: {
      paymentProfileCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentProfileCreatingTaskRow {
  paymentProfileCreatingTaskAccountId?: string,
  paymentProfileCreatingTaskRetryCount?: number,
  paymentProfileCreatingTaskExecutionTimeMs?: number,
  paymentProfileCreatingTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_CREATING_TASK_ROW: MessageDescriptor<GetPaymentProfileCreatingTaskRow> = {
  name: 'GetPaymentProfileCreatingTaskRow',
  fields: [{
    name: 'paymentProfileCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileCreatingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileCreatingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileCreatingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileCreatingTask(
  runner: Database | Transaction,
  args: {
    paymentProfileCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetPaymentProfileCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileCreatingTask.accountId, PaymentProfileCreatingTask.retryCount, PaymentProfileCreatingTask.executionTimeMs, PaymentProfileCreatingTask.createdTimeMs FROM PaymentProfileCreatingTask WHERE (PaymentProfileCreatingTask.accountId = @paymentProfileCreatingTaskAccountIdEq)",
    params: {
      paymentProfileCreatingTaskAccountIdEq: args.paymentProfileCreatingTaskAccountIdEq,
    },
    types: {
      paymentProfileCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentProfileCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileCreatingTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      paymentProfileCreatingTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      paymentProfileCreatingTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentProfileCreatingTasksRow {
  paymentProfileCreatingTaskAccountId?: string,
}

export let LIST_PENDING_PAYMENT_PROFILE_CREATING_TASKS_ROW: MessageDescriptor<ListPendingPaymentProfileCreatingTasksRow> = {
  name: 'ListPendingPaymentProfileCreatingTasksRow',
  fields: [{
    name: 'paymentProfileCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentProfileCreatingTasks(
  runner: Database | Transaction,
  args: {
    paymentProfileCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentProfileCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileCreatingTask.accountId FROM PaymentProfileCreatingTask WHERE PaymentProfileCreatingTask.executionTimeMs <= @paymentProfileCreatingTaskExecutionTimeMsLe",
    params: {
      paymentProfileCreatingTaskExecutionTimeMsLe: args.paymentProfileCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.paymentProfileCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentProfileCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentProfileCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPaymentProfileCreatingTaskMetadataRow {
  paymentProfileCreatingTaskRetryCount?: number,
  paymentProfileCreatingTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetPaymentProfileCreatingTaskMetadataRow> = {
  name: 'GetPaymentProfileCreatingTaskMetadataRow',
  fields: [{
    name: 'paymentProfileCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentProfileCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetPaymentProfileCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileCreatingTask.retryCount, PaymentProfileCreatingTask.executionTimeMs FROM PaymentProfileCreatingTask WHERE (PaymentProfileCreatingTask.accountId = @paymentProfileCreatingTaskAccountIdEq)",
    params: {
      paymentProfileCreatingTaskAccountIdEq: args.paymentProfileCreatingTaskAccountIdEq,
    },
    types: {
      paymentProfileCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentProfileCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentProfileCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentProfileCreatingTaskMetadataStatement(
  args: {
    paymentProfileCreatingTaskAccountIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfileCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentProfileCreatingTask.accountId = @paymentProfileCreatingTaskAccountIdEq)",
    params: {
      paymentProfileCreatingTaskAccountIdEq: args.paymentProfileCreatingTaskAccountIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentProfileCreatingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPayoutProfileCreatingTaskStatement(
  args: {
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PayoutProfileCreatingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePayoutProfileCreatingTaskStatement(
  args: {
    payoutProfileCreatingTaskAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PayoutProfileCreatingTask WHERE (PayoutProfileCreatingTask.accountId = @payoutProfileCreatingTaskAccountIdEq)",
    params: {
      payoutProfileCreatingTaskAccountIdEq: args.payoutProfileCreatingTaskAccountIdEq,
    },
    types: {
      payoutProfileCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetPayoutProfileCreatingTaskRow {
  payoutProfileCreatingTaskAccountId?: string,
  payoutProfileCreatingTaskRetryCount?: number,
  payoutProfileCreatingTaskExecutionTimeMs?: number,
  payoutProfileCreatingTaskCreatedTimeMs?: number,
}

export let GET_PAYOUT_PROFILE_CREATING_TASK_ROW: MessageDescriptor<GetPayoutProfileCreatingTaskRow> = {
  name: 'GetPayoutProfileCreatingTaskRow',
  fields: [{
    name: 'payoutProfileCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutProfileCreatingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutProfileCreatingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutProfileCreatingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutProfileCreatingTask(
  runner: Database | Transaction,
  args: {
    payoutProfileCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetPayoutProfileCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutProfileCreatingTask.accountId, PayoutProfileCreatingTask.retryCount, PayoutProfileCreatingTask.executionTimeMs, PayoutProfileCreatingTask.createdTimeMs FROM PayoutProfileCreatingTask WHERE (PayoutProfileCreatingTask.accountId = @payoutProfileCreatingTaskAccountIdEq)",
    params: {
      payoutProfileCreatingTaskAccountIdEq: args.payoutProfileCreatingTaskAccountIdEq,
    },
    types: {
      payoutProfileCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutProfileCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      payoutProfileCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutProfileCreatingTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      payoutProfileCreatingTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      payoutProfileCreatingTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPayoutProfileCreatingTasksRow {
  payoutProfileCreatingTaskAccountId?: string,
}

export let LIST_PENDING_PAYOUT_PROFILE_CREATING_TASKS_ROW: MessageDescriptor<ListPendingPayoutProfileCreatingTasksRow> = {
  name: 'ListPendingPayoutProfileCreatingTasksRow',
  fields: [{
    name: 'payoutProfileCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPayoutProfileCreatingTasks(
  runner: Database | Transaction,
  args: {
    payoutProfileCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPayoutProfileCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutProfileCreatingTask.accountId FROM PayoutProfileCreatingTask WHERE PayoutProfileCreatingTask.executionTimeMs <= @payoutProfileCreatingTaskExecutionTimeMsLe",
    params: {
      payoutProfileCreatingTaskExecutionTimeMsLe: args.payoutProfileCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.payoutProfileCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      payoutProfileCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPayoutProfileCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      payoutProfileCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPayoutProfileCreatingTaskMetadataRow {
  payoutProfileCreatingTaskRetryCount?: number,
  payoutProfileCreatingTaskExecutionTimeMs?: number,
}

export let GET_PAYOUT_PROFILE_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetPayoutProfileCreatingTaskMetadataRow> = {
  name: 'GetPayoutProfileCreatingTaskMetadataRow',
  fields: [{
    name: 'payoutProfileCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutProfileCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutProfileCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    payoutProfileCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetPayoutProfileCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutProfileCreatingTask.retryCount, PayoutProfileCreatingTask.executionTimeMs FROM PayoutProfileCreatingTask WHERE (PayoutProfileCreatingTask.accountId = @payoutProfileCreatingTaskAccountIdEq)",
    params: {
      payoutProfileCreatingTaskAccountIdEq: args.payoutProfileCreatingTaskAccountIdEq,
    },
    types: {
      payoutProfileCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutProfileCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      payoutProfileCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      payoutProfileCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePayoutProfileCreatingTaskMetadataStatement(
  args: {
    payoutProfileCreatingTaskAccountIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PayoutProfileCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PayoutProfileCreatingTask.accountId = @payoutProfileCreatingTaskAccountIdEq)",
    params: {
      payoutProfileCreatingTaskAccountIdEq: args.payoutProfileCreatingTaskAccountIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      payoutProfileCreatingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateUserTotalAccountsStatement(
  args: {
    userUserIdEq: string,
    setTotalAccounts?: number,
  }
): Statement {
  return {
    sql: "UPDATE User SET totalAccounts = @setTotalAccounts WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: args.userUserIdEq,
      setTotalAccounts: args.setTotalAccounts == null ? null : Spanner.float(args.setTotalAccounts),
    },
    types: {
      userUserIdEq: { type: "string" },
      setTotalAccounts: { type: "float64" },
    }
  };
}

export function updateUserPasswordHashStatement(
  args: {
    userUserIdEq: string,
    setPasswordHashV1?: string,
  }
): Statement {
  return {
    sql: "UPDATE User SET passwordHashV1 = @setPasswordHashV1 WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: args.userUserIdEq,
      setPasswordHashV1: args.setPasswordHashV1 == null ? null : args.setPasswordHashV1,
    },
    types: {
      userUserIdEq: { type: "string" },
      setPasswordHashV1: { type: "string" },
    }
  };
}

export function updateUserRecoveryEmailStatement(
  args: {
    userUserIdEq: string,
    setRecoveryEmail?: string,
  }
): Statement {
  return {
    sql: "UPDATE User SET recoveryEmail = @setRecoveryEmail WHERE User.userId = @userUserIdEq",
    params: {
      userUserIdEq: args.userUserIdEq,
      setRecoveryEmail: args.setRecoveryEmail == null ? null : args.setRecoveryEmail,
    },
    types: {
      userUserIdEq: { type: "string" },
      setRecoveryEmail: { type: "string" },
    }
  };
}

export function updateAccountPaymentProfileStateStatement(
  args: {
    accountAccountIdEq: string,
    setPaymentProfileState?: PaymentProfileState,
    setPaymentProfileStateVersion?: number,
    setCapabilitiesVersion?: number,
  }
): Statement {
  return {
    sql: "UPDATE Account SET paymentProfileState = @setPaymentProfileState, paymentProfileStateVersion = @setPaymentProfileStateVersion, capabilitiesVersion = @setCapabilitiesVersion WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
      setPaymentProfileState: args.setPaymentProfileState == null ? null : Spanner.float(args.setPaymentProfileState),
      setPaymentProfileStateVersion: args.setPaymentProfileStateVersion == null ? null : Spanner.float(args.setPaymentProfileStateVersion),
      setCapabilitiesVersion: args.setCapabilitiesVersion == null ? null : Spanner.float(args.setCapabilitiesVersion),
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setPaymentProfileState: { type: "float64" },
      setPaymentProfileStateVersion: { type: "float64" },
      setCapabilitiesVersion: { type: "float64" },
    }
  };
}

export function updateAccountLastAccessedTimeStatement(
  args: {
    accountAccountIdEq: string,
    setLastAccessedTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE Account SET lastAccessedTimeMs = @setLastAccessedTimeMs WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
      setLastAccessedTimeMs: args.setLastAccessedTimeMs == null ? null : Spanner.float(args.setLastAccessedTimeMs),
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setLastAccessedTimeMs: { type: "float64" },
    }
  };
}

export function updateAccountContentStatement(
  args: {
    accountAccountIdEq: string,
    setNaturalName?: string,
    setDescription?: string,
    setContactEmail?: string,
  }
): Statement {
  return {
    sql: "UPDATE Account SET naturalName = @setNaturalName, description = @setDescription, contactEmail = @setContactEmail WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
      setNaturalName: args.setNaturalName == null ? null : args.setNaturalName,
      setDescription: args.setDescription == null ? null : args.setDescription,
      setContactEmail: args.setContactEmail == null ? null : args.setContactEmail,
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setNaturalName: { type: "string" },
      setDescription: { type: "string" },
      setContactEmail: { type: "string" },
    }
  };
}

export function updateAccountAvatarStatement(
  args: {
    accountAccountIdEq: string,
    setAvatarSmallFilename?: string,
    setAvatarLargeFilename?: string,
  }
): Statement {
  return {
    sql: "UPDATE Account SET avatarSmallFilename = @setAvatarSmallFilename, avatarLargeFilename = @setAvatarLargeFilename WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
      setAvatarSmallFilename: args.setAvatarSmallFilename == null ? null : args.setAvatarSmallFilename,
      setAvatarLargeFilename: args.setAvatarLargeFilename == null ? null : args.setAvatarLargeFilename,
    },
    types: {
      accountAccountIdEq: { type: "string" },
      setAvatarSmallFilename: { type: "string" },
      setAvatarLargeFilename: { type: "string" },
    }
  };
}

export interface GetUserByUsernameRow {
  userUserId?: string,
  userUsername?: string,
  userPasswordHashV1?: string,
  userRecoveryEmail?: string,
  userTotalAccounts?: number,
  userCreatedTimeMs?: number,
}

export let GET_USER_BY_USERNAME_ROW: MessageDescriptor<GetUserByUsernameRow> = {
  name: 'GetUserByUsernameRow',
  fields: [{
    name: 'userUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userUsername',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userPasswordHashV1',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userRecoveryEmail',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userTotalAccounts',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'userCreatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getUserByUsername(
  runner: Database | Transaction,
  args: {
    userUsernameEq: string,
  }
): Promise<Array<GetUserByUsernameRow>> {
  let [rows] = await runner.run({
    sql: "SELECT User.userId, User.username, User.passwordHashV1, User.recoveryEmail, User.totalAccounts, User.createdTimeMs FROM User WHERE User.username = @userUsernameEq",
    params: {
      userUsernameEq: args.userUsernameEq,
    },
    types: {
      userUsernameEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserByUsernameRow>();
  for (let row of rows) {
    resRows.push({
      userUserId: row.at(0).value == null ? undefined : row.at(0).value,
      userUsername: row.at(1).value == null ? undefined : row.at(1).value,
      userPasswordHashV1: row.at(2).value == null ? undefined : row.at(2).value,
      userRecoveryEmail: row.at(3).value == null ? undefined : row.at(3).value,
      userTotalAccounts: row.at(4).value == null ? undefined : row.at(4).value.value,
      userCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
    });
  }
  return resRows;
}

export interface ListLastAccessedAccountsRow {
  accountUserId?: string,
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountContactEmail?: string,
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
  accountLastAccessedTimeMs?: number,
  accountPaymentProfileStateVersion?: number,
  accountPaymentProfileState?: PaymentProfileState,
  accountCapabilitiesVersion?: number,
}

export let LIST_LAST_ACCESSED_ACCOUNTS_ROW: MessageDescriptor<ListLastAccessedAccountsRow> = {
  name: 'ListLastAccessedAccountsRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 3,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountNaturalName',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountContactEmail',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarSmallFilename',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarLargeFilename',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountLastAccessedTimeMs',
    index: 8,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileStateVersion',
    index: 9,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileState',
    index: 10,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'accountCapabilitiesVersion',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listLastAccessedAccounts(
  runner: Database | Transaction,
  args: {
    accountUserIdEq: string,
    limit: number,
  }
): Promise<Array<ListLastAccessedAccountsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountId, Account.accountType, Account.naturalName, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename, Account.lastAccessedTimeMs, Account.paymentProfileStateVersion, Account.paymentProfileState, Account.capabilitiesVersion FROM Account WHERE Account.userId = @accountUserIdEq ORDER BY Account.lastAccessedTimeMs DESC LIMIT @limit",
    params: {
      accountUserIdEq: args.accountUserIdEq,
      limit: args.limit.toString(),
    },
    types: {
      accountUserIdEq: { type: "string" },
      limit: { type: "int64" },
    }
  });
  let resRows = new Array<ListLastAccessedAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      accountAccountType: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(3).value == null ? undefined : row.at(3).value,
      accountContactEmail: row.at(4).value == null ? undefined : row.at(4).value,
      accountAvatarSmallFilename: row.at(5).value == null ? undefined : row.at(5).value,
      accountAvatarLargeFilename: row.at(6).value == null ? undefined : row.at(6).value,
      accountLastAccessedTimeMs: row.at(7).value == null ? undefined : row.at(7).value.value,
      accountPaymentProfileStateVersion: row.at(8).value == null ? undefined : row.at(8).value.value,
      accountPaymentProfileState: row.at(9).value == null ? undefined : toEnumFromNumber(row.at(9).value.value, PAYMENT_PROFILE_STATE),
      accountCapabilitiesVersion: row.at(10).value == null ? undefined : row.at(10).value.value,
    });
  }
  return resRows;
}

export interface SearchAccountsRow {
  accountUserId?: string,
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountContactEmail?: string,
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
  accountLastAccessedTimeMs?: number,
  accountPaymentProfileStateVersion?: number,
  accountPaymentProfileState?: PaymentProfileState,
  accountCapabilitiesVersion?: number,
  accountFullTextScore?: number,
}

export let SEARCH_ACCOUNTS_ROW: MessageDescriptor<SearchAccountsRow> = {
  name: 'SearchAccountsRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 3,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountNaturalName',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountContactEmail',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarSmallFilename',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarLargeFilename',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountLastAccessedTimeMs',
    index: 8,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileStateVersion',
    index: 9,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileState',
    index: 10,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'accountCapabilitiesVersion',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountFullTextScore',
    index: 12,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function searchAccounts(
  runner: Database | Transaction,
  args: {
    accountFullTextSearch: string,
    accountFullTextScoreOrderBy: string,
    limit: number,
    accountFullTextScoreSelect: string,
  }
): Promise<Array<SearchAccountsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountId, Account.accountType, Account.naturalName, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename, Account.lastAccessedTimeMs, Account.paymentProfileStateVersion, Account.paymentProfileState, Account.capabilitiesVersion, SCORE(Account.fullText, @accountFullTextScoreSelect) FROM Account WHERE SEARCH(Account.fullText, @accountFullTextSearch) ORDER BY SCORE(Account.fullText, @accountFullTextScoreOrderBy) DESC LIMIT @limit",
    params: {
      accountFullTextSearch: args.accountFullTextSearch,
      accountFullTextScoreOrderBy: args.accountFullTextScoreOrderBy,
      limit: args.limit.toString(),
      accountFullTextScoreSelect: args.accountFullTextScoreSelect,
    },
    types: {
      accountFullTextSearch: { type: "string" },
      accountFullTextScoreOrderBy: { type: "string" },
      limit: { type: "int64" },
      accountFullTextScoreSelect: { type: "string" },
    }
  });
  let resRows = new Array<SearchAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      accountAccountType: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(3).value == null ? undefined : row.at(3).value,
      accountContactEmail: row.at(4).value == null ? undefined : row.at(4).value,
      accountAvatarSmallFilename: row.at(5).value == null ? undefined : row.at(5).value,
      accountAvatarLargeFilename: row.at(6).value == null ? undefined : row.at(6).value,
      accountLastAccessedTimeMs: row.at(7).value == null ? undefined : row.at(7).value.value,
      accountPaymentProfileStateVersion: row.at(8).value == null ? undefined : row.at(8).value.value,
      accountPaymentProfileState: row.at(9).value == null ? undefined : toEnumFromNumber(row.at(9).value.value, PAYMENT_PROFILE_STATE),
      accountCapabilitiesVersion: row.at(10).value == null ? undefined : row.at(10).value.value,
      accountFullTextScore: row.at(11).value == null ? undefined : row.at(11).value.value,
    });
  }
  return resRows;
}

export interface ContinuedSearchAccountsRow {
  accountUserId?: string,
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountContactEmail?: string,
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
  accountLastAccessedTimeMs?: number,
  accountPaymentProfileStateVersion?: number,
  accountPaymentProfileState?: PaymentProfileState,
  accountCapabilitiesVersion?: number,
  accountFullTextScore?: number,
}

export let CONTINUED_SEARCH_ACCOUNTS_ROW: MessageDescriptor<ContinuedSearchAccountsRow> = {
  name: 'ContinuedSearchAccountsRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 3,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountNaturalName',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountContactEmail',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarSmallFilename',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarLargeFilename',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountLastAccessedTimeMs',
    index: 8,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileStateVersion',
    index: 9,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileState',
    index: 10,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'accountCapabilitiesVersion',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountFullTextScore',
    index: 12,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function continuedSearchAccounts(
  runner: Database | Transaction,
  args: {
    accountFullTextSearch: string,
    accountFullTextScoreWhere: string,
    accountFullTextScoreLt: number,
    accountFullTextScoreOrderBy: string,
    limit: number,
    accountFullTextScoreSelect: string,
  }
): Promise<Array<ContinuedSearchAccountsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountId, Account.accountType, Account.naturalName, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename, Account.lastAccessedTimeMs, Account.paymentProfileStateVersion, Account.paymentProfileState, Account.capabilitiesVersion, SCORE(Account.fullText, @accountFullTextScoreSelect) FROM Account WHERE (SEARCH(Account.fullText, @accountFullTextSearch) AND SCORE(Account.fullText, @accountFullTextScoreWhere) < @accountFullTextScoreLt) ORDER BY SCORE(Account.fullText, @accountFullTextScoreOrderBy) DESC LIMIT @limit",
    params: {
      accountFullTextSearch: args.accountFullTextSearch,
      accountFullTextScoreWhere: args.accountFullTextScoreWhere,
      accountFullTextScoreLt: Spanner.float(args.accountFullTextScoreLt),
      accountFullTextScoreOrderBy: args.accountFullTextScoreOrderBy,
      limit: args.limit.toString(),
      accountFullTextScoreSelect: args.accountFullTextScoreSelect,
    },
    types: {
      accountFullTextSearch: { type: "string" },
      accountFullTextScoreWhere: { type: "string" },
      accountFullTextScoreLt: { type: "float64" },
      accountFullTextScoreOrderBy: { type: "string" },
      limit: { type: "int64" },
      accountFullTextScoreSelect: { type: "string" },
    }
  });
  let resRows = new Array<ContinuedSearchAccountsRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      accountAccountType: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(3).value == null ? undefined : row.at(3).value,
      accountContactEmail: row.at(4).value == null ? undefined : row.at(4).value,
      accountAvatarSmallFilename: row.at(5).value == null ? undefined : row.at(5).value,
      accountAvatarLargeFilename: row.at(6).value == null ? undefined : row.at(6).value,
      accountLastAccessedTimeMs: row.at(7).value == null ? undefined : row.at(7).value.value,
      accountPaymentProfileStateVersion: row.at(8).value == null ? undefined : row.at(8).value.value,
      accountPaymentProfileState: row.at(9).value == null ? undefined : toEnumFromNumber(row.at(9).value.value, PAYMENT_PROFILE_STATE),
      accountCapabilitiesVersion: row.at(10).value == null ? undefined : row.at(10).value.value,
      accountFullTextScore: row.at(11).value == null ? undefined : row.at(11).value.value,
    });
  }
  return resRows;
}

export interface GetAccountMainRow {
  accountUserId?: string,
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountContactEmail?: string,
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
  accountLastAccessedTimeMs?: number,
  accountPaymentProfileStateVersion?: number,
  accountPaymentProfileState?: PaymentProfileState,
  accountCapabilitiesVersion?: number,
}

export let GET_ACCOUNT_MAIN_ROW: MessageDescriptor<GetAccountMainRow> = {
  name: 'GetAccountMainRow',
  fields: [{
    name: 'accountUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 3,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountNaturalName',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountContactEmail',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarSmallFilename',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarLargeFilename',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountLastAccessedTimeMs',
    index: 8,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileStateVersion',
    index: 9,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileState',
    index: 10,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'accountCapabilitiesVersion',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getAccountMain(
  runner: Database | Transaction,
  args: {
    accountAccountIdEq: string,
  }
): Promise<Array<GetAccountMainRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Account.userId, Account.accountId, Account.accountType, Account.naturalName, Account.contactEmail, Account.avatarSmallFilename, Account.avatarLargeFilename, Account.lastAccessedTimeMs, Account.paymentProfileStateVersion, Account.paymentProfileState, Account.capabilitiesVersion FROM Account WHERE Account.accountId = @accountAccountIdEq",
    params: {
      accountAccountIdEq: args.accountAccountIdEq,
    },
    types: {
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetAccountMainRow>();
  for (let row of rows) {
    resRows.push({
      accountUserId: row.at(0).value == null ? undefined : row.at(0).value,
      accountAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      accountAccountType: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(3).value == null ? undefined : row.at(3).value,
      accountContactEmail: row.at(4).value == null ? undefined : row.at(4).value,
      accountAvatarSmallFilename: row.at(5).value == null ? undefined : row.at(5).value,
      accountAvatarLargeFilename: row.at(6).value == null ? undefined : row.at(6).value,
      accountLastAccessedTimeMs: row.at(7).value == null ? undefined : row.at(7).value.value,
      accountPaymentProfileStateVersion: row.at(8).value == null ? undefined : row.at(8).value.value,
      accountPaymentProfileState: row.at(9).value == null ? undefined : toEnumFromNumber(row.at(9).value.value, PAYMENT_PROFILE_STATE),
      accountCapabilitiesVersion: row.at(10).value == null ? undefined : row.at(10).value.value,
    });
  }
  return resRows;
}

export interface GetUserAndAccountAllRow {
  userUserId?: string,
  userUsername?: string,
  userPasswordHashV1?: string,
  userRecoveryEmail?: string,
  userTotalAccounts?: number,
  userCreatedTimeMs?: number,
  accountUserId?: string,
  accountAccountId?: string,
  accountAccountType?: AccountType,
  accountNaturalName?: string,
  accountDescription?: string,
  accountContactEmail?: string,
  accountAvatarSmallFilename?: string,
  accountAvatarLargeFilename?: string,
  accountLastAccessedTimeMs?: number,
  accountCreatedTimeMs?: number,
  accountPaymentProfileStateVersion?: number,
  accountPaymentProfileState?: PaymentProfileState,
  accountCapabilitiesVersion?: number,
}

export let GET_USER_AND_ACCOUNT_ALL_ROW: MessageDescriptor<GetUserAndAccountAllRow> = {
  name: 'GetUserAndAccountAllRow',
  fields: [{
    name: 'userUserId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userUsername',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userPasswordHashV1',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userRecoveryEmail',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'userTotalAccounts',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'userCreatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountUserId',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountId',
    index: 8,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAccountType',
    index: 9,
    enumType: ACCOUNT_TYPE,
  }, {
    name: 'accountNaturalName',
    index: 10,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountDescription',
    index: 11,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountContactEmail',
    index: 12,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarSmallFilename',
    index: 13,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountAvatarLargeFilename',
    index: 14,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'accountLastAccessedTimeMs',
    index: 15,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountCreatedTimeMs',
    index: 16,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileStateVersion',
    index: 17,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'accountPaymentProfileState',
    index: 18,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'accountCapabilitiesVersion',
    index: 19,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getUserAndAccountAll(
  runner: Database | Transaction,
  args: {
    userUserIdEq: string,
    accountAccountIdEq: string,
  }
): Promise<Array<GetUserAndAccountAllRow>> {
  let [rows] = await runner.run({
    sql: "SELECT u.userId, u.username, u.passwordHashV1, u.recoveryEmail, u.totalAccounts, u.createdTimeMs, a.userId, a.accountId, a.accountType, a.naturalName, a.description, a.contactEmail, a.avatarSmallFilename, a.avatarLargeFilename, a.lastAccessedTimeMs, a.createdTimeMs, a.paymentProfileStateVersion, a.paymentProfileState, a.capabilitiesVersion FROM User AS u INNER JOIN Account AS a ON u.userId = a.userId WHERE (u.userId = @userUserIdEq AND a.accountId = @accountAccountIdEq)",
    params: {
      userUserIdEq: args.userUserIdEq,
      accountAccountIdEq: args.accountAccountIdEq,
    },
    types: {
      userUserIdEq: { type: "string" },
      accountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUserAndAccountAllRow>();
  for (let row of rows) {
    resRows.push({
      userUserId: row.at(0).value == null ? undefined : row.at(0).value,
      userUsername: row.at(1).value == null ? undefined : row.at(1).value,
      userPasswordHashV1: row.at(2).value == null ? undefined : row.at(2).value,
      userRecoveryEmail: row.at(3).value == null ? undefined : row.at(3).value,
      userTotalAccounts: row.at(4).value == null ? undefined : row.at(4).value.value,
      userCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
      accountUserId: row.at(6).value == null ? undefined : row.at(6).value,
      accountAccountId: row.at(7).value == null ? undefined : row.at(7).value,
      accountAccountType: row.at(8).value == null ? undefined : toEnumFromNumber(row.at(8).value.value, ACCOUNT_TYPE),
      accountNaturalName: row.at(9).value == null ? undefined : row.at(9).value,
      accountDescription: row.at(10).value == null ? undefined : row.at(10).value,
      accountContactEmail: row.at(11).value == null ? undefined : row.at(11).value,
      accountAvatarSmallFilename: row.at(12).value == null ? undefined : row.at(12).value,
      accountAvatarLargeFilename: row.at(13).value == null ? undefined : row.at(13).value,
      accountLastAccessedTimeMs: row.at(14).value == null ? undefined : row.at(14).value.value,
      accountCreatedTimeMs: row.at(15).value == null ? undefined : row.at(15).value.value,
      accountPaymentProfileStateVersion: row.at(16).value == null ? undefined : row.at(16).value.value,
      accountPaymentProfileState: row.at(17).value == null ? undefined : toEnumFromNumber(row.at(17).value.value, PAYMENT_PROFILE_STATE),
      accountCapabilitiesVersion: row.at(18).value == null ? undefined : row.at(18).value.value,
    });
  }
  return resRows;
}

export interface CheckPresenceOfVideoPlayerSettingsRow {
  videoPlayerSettingsAccountId?: string,
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
  args: {
    videoPlayerSettingsAccountIdEq: string,
  }
): Promise<Array<CheckPresenceOfVideoPlayerSettingsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT VideoPlayerSettings.accountId FROM VideoPlayerSettings WHERE VideoPlayerSettings.accountId = @videoPlayerSettingsAccountIdEq",
    params: {
      videoPlayerSettingsAccountIdEq: args.videoPlayerSettingsAccountIdEq,
    },
    types: {
      videoPlayerSettingsAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<CheckPresenceOfVideoPlayerSettingsRow>();
  for (let row of rows) {
    resRows.push({
      videoPlayerSettingsAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}
