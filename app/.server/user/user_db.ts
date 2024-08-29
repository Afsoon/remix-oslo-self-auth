import { encodeBase32 } from "@oslojs/encoding";
import { sql } from "kysely";
import { db } from "../db";
import { hashPassword } from "../password/util";

export function verifyUsernameInput(username: string): boolean {
  return username.length > 3 && username.length < 32 && username.trim() === username;
}

export async function createUser(email: string, username: string, password: string): Promise<User> {
  const password_hash = await hashPassword(password);
  const recovery_code = generateRandomRecoveryCode();

  const row = await db
    .insertInto("users")
    .values({
      password_hash,
      recovery_code,
      username,
      email,
    })
    .returningAll()
    .executeTakeFirst();

  if (row == null) {
    throw new Error("Unexpected error");
  }
  const user: User = {
    ...row,
    email_verified: false,
    totp_registered: false,
    passkey_credential_registered: false,
    security_key_credential_registered: false,
    registered_2fa: false,
  };

  return user;
}

export async function getUser(user_id: number): Promise<User | null> {
  const row = await db
    .selectFrom("users")
    .select([
      "id",
      "email",
      "username",
      "email_verified",
      sql<number>`IIF(totp_credential.id IS NOT NULL, 1, 0)`.as("totp_registered"),
      sql<number>`IIF(passkey_credential.id IS NOT NULL, 1, 0)`.as("passkey_credential_registered"),
      sql<number>`IIF(security_key_credential.id IS NOT NULL, 1, 0)`.as("security_key_credential_registered"),
    ])
    .where("users.id", "=", user_id)
    .leftJoin("passkey_credential", "passkey_credential.user_id", "users.id")
    .leftJoin("totp_credential", "totp_credential.user_id", "users.id")
    .leftJoin("security_key_credential", "security_key_credential.user_id", "users.id")
    .executeTakeFirst();

  if (row == null) {
    return null;
  }

  return {
    ...row,
    email_verified: Boolean(row.email_verified),
    passkey_credential_registered: Boolean(row.passkey_credential_registered),
    security_key_credential_registered: Boolean(row.security_key_credential_registered),
    totp_registered: Boolean(row.totp_registered),
    registered_2fa: Boolean(row.totp_registered || row.security_key_credential_registered || row.totp_registered),
  };
}

export async function getUserPasswordHash(user_id: number): Promise<string> {
  const row = await db.selectFrom("users").select("password_hash").where("users.id", "=", user_id).executeTakeFirst();
  if (row == null) {
    throw new Error("Invalid user ID");
  }
  return row.password_hash;
}

export async function getUserRecoverCode(user_id: number): Promise<string> {
  const row = await db.selectFrom("users").select(["recovery_code"]).where("users.id", "=", user_id).executeTakeFirst();
  if (row == null) {
    throw new Error("Invalid user ID");
  }

  // OG didn't checked it (?)
  if (row.recovery_code == null) {
    throw new Error("User id without recovery code");
  }

  return row.recovery_code;
}

export async function getUserTOTPKey(user_id: number): Promise<Uint8Array | null> {
  const row = await db
    .selectFrom("totp_credential")
    .select("key")
    .where("totp_credential.user_id", "=", user_id)
    .executeTakeFirst();

  if (row == null) {
    throw new Error("Invalid user ID");
  }
  return Buffer.from(row.key);
}

export async function getUserFromEmail(email: string): Promise<User | null> {
  const row = await db
    .selectFrom("users")
    .select([
      "id",
      "email",
      "username",
      "email_verified",
      sql<number>`IIF(totp_credential.id IS NOT NULL, 1, 0)`.as("totp_registered"),
      sql<number>`IIF(passkey_credential.id IS NOT NULL, 1, 0)`.as("passkey_credential_registered"),
      sql<number>`IIF(security_key_credential.id IS NOT NULL, 1, 0)`.as("security_key_credential_registered"),
    ])
    .where("users.email", "=", email)
    .leftJoin("passkey_credential", "passkey_credential.user_id", "users.id")
    .leftJoin("totp_credential", "totp_credential.user_id", "users.id")
    .leftJoin("security_key_credential", "security_key_credential.user_id", "users.id")
    .executeTakeFirst();

  if (row == null) {
    return null;
  }

  return {
    ...row,
    email_verified: Boolean(row.email_verified),
    passkey_credential_registered: Boolean(row.passkey_credential_registered),
    security_key_credential_registered: Boolean(row.security_key_credential_registered),
    totp_registered: Boolean(row.totp_registered),
    registered_2fa: Boolean(row.totp_registered || row.security_key_credential_registered || row.totp_registered),
  };
}

export async function verifyUserRecoveryCode(user_id: number, recovery_code: string): Promise<boolean> {
  const new_recovery_code = generateRandomRecoveryCode();
  const result = await db.transaction().execute(async (trx) => {
    const result = await trx
      .updateTable("users")
      .set({
        recovery_code: new_recovery_code,
      })
      .where("users.id", "=", user_id)
      .where("recovery_code", "=", recovery_code)
      .executeTakeFirstOrThrow();

    if (result.numUpdatedRows < 1) {
      return false;
    }

    trx.deleteFrom("totp_credential").where("user_id", "=", user_id).execute();
    trx.deleteFrom("passkey_credential").where("user_id", "=", user_id).execute();
    trx.deleteFrom("security_key_credential").where("user_id", "=", user_id).execute();
    trx
      .updateTable("sessions")
      .set({
        two_factor_verified: false,
      })
      .where("user_id", "=", user_id)
      .execute();

    return true;
  });

  return result;
}

export async function resetUserRecoveryCode(user_id: number): Promise<string> {
  const new_recovery_code = generateRandomRecoveryCode();
  const result = await db
    .updateTable("users")
    .set({
      recovery_code: new_recovery_code,
    })
    .where("users.id", "=", user_id)
    .returning("recovery_code")
    .executeTakeFirstOrThrow();

  if (result == null) {
    console.error("Someone is trying to create a recovery code of a user that doesn't exist");
  }

  return new_recovery_code;
}

export async function verifyUserEmail(user_id: number, email: string): Promise<void> {
  await db
    .updateTable("users")
    .set({
      email_verified: true,
    })
    .where("users.id", "=", user_id)
    .where("users.email", "=", email)
    .executeTakeFirstOrThrow();
}

export async function updateUserPasswordWithEmailVerification(
  user_id: number,
  email: string,
  password: string,
): Promise<void> {
  const new_password_hash = await hashPassword(password);
  await db.transaction().execute(async (trx) => {
    const result = await trx
      .updateTable("users")
      .set({
        password_hash: new_password_hash,
      })
      .where("users.id", "=", user_id)
      .where("users.email", "=", email)
      .executeTakeFirstOrThrow();

    if (result.numUpdatedRows < 1) {
      throw new Error("Invalid user");
    }

    trx.deleteFrom("sessions").where("user_id", "=", user_id).execute();

    return true;
  });
}

export async function updateUserPassword(session_id: number, user_id: number, password: string): Promise<void> {
  const password_hash = await hashPassword(password);
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("users")
      .set({
        password_hash,
      })
      .where("users.id", "=", user_id)
      .executeTakeFirstOrThrow();

    await trx.deleteFrom("sessions").where("user_id", "=", user_id).where("sessions.id", "=", session_id).execute();
    return;
  });
}

export async function updateUserTOTPKey(session_id: number, user_id: number, key: Uint8Array): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("totp_credential").where("user_id", "=", user_id).execute();
    await trx
      .insertInto("totp_credential")
      .values({
        user_id,
        key: Buffer.from(key.buffer).toString(),
      })
      .execute();
    await trx.deleteFrom("sessions").where("user_id", "=", user_id).where("sessions.id", "=", session_id).execute();
    await trx
      .updateTable("sessions")
      .set({
        two_factor_verified: true,
      })
      .where("user_id", "=", user_id)
      .execute();

    return;
  });
}

function generateRandomRecoveryCode(): string {
  const recoveryCodeBytes = new Uint8Array(10);
  crypto.getRandomValues(recoveryCodeBytes);
  const recoveryCode = encodeBase32(recoveryCodeBytes);
  return recoveryCode;
}

export interface User {
  id: number;
  email: string;
  username: string;
  email_verified: boolean;
  totp_registered: boolean;
  passkey_credential_registered: boolean;
  security_key_credential_registered: boolean;
  registered_2fa: boolean;
}
