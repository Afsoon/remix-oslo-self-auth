import { encodeBase32 } from "@oslojs/encoding";
import { sql } from "kysely";
import { db } from "../db";
import { User } from "../user/user_db";
import { generateRandomOTP } from "./util";

export async function createPasswordResetSession(userId: number, email: string): Promise<PasswordResetSession> {
  const idBytes = new Uint8Array(20);
  crypto.getRandomValues(idBytes);
  const id = encodeBase32(idBytes).toLowerCase();

  const session: PasswordResetSession = {
    id,
    userId,
    email,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    code: generateRandomOTP(),
    emailVerified: false,
    twoFactorVerified: false,
  };
  await db.insertInto("password_reset_session").values({
    code: session.code,
    email: session.email,
    expires_at: session.expiresAt,
    user_id: session.userId,
    id: session.id,
  });

  return session;
}

export async function validatePasswordResetSession(sessionId: string): Promise<PasswordResetSessionValidationResult> {
  const row = await db
    .selectFrom("password_reset_session")
    .where("password_reset_session.id", "=", sessionId)
    .innerJoin("users", "users.id", "password_reset_session.user_id")
    .select([
      "password_reset_session.id",
      "password_reset_session.code",
      "password_reset_session.email",
      "password_reset_session.expires_at",
      "password_reset_session.user_id",
      "password_reset_session.email_verified",
      "password_reset_session.two_factor_verified",
      "users.id",
      "users.email",
      "users.username",
      "users.email_verified",
      sql<number>`IIF(users.totp_credential.id IS NOT NULL, 1, 0)`.as("totp_registered"),
      sql<number>`IIF(users.passkey_credential.id IS NOT NULL, 1, 0)`.as("passkey_credential_registered"),
      sql<number>`IIF(users.security_key_credential.id IS NOT NULL, 1, 0)`.as("security_key_credential_registered"),
    ])
    .leftJoin("passkey_credential", "passkey_credential.user_id", "users.id")
    .leftJoin("totp_credential", "totp_credential.user_id", "users.id")
    .leftJoin("security_key_credential", "security_key_credential.user_id", "users.id")
    .executeTakeFirst();

  if (row == null) {
    return { session: null, user: null };
  }
  const session: PasswordResetSession = {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    code: row.code,
    expiresAt: row.expires_at,
    emailVerified: Boolean(row.email_verified),
    twoFactorVerified: Boolean(row.two_factor_verified),
  };
  const user: User = {
    id: row.user_id,
    email: row.email,
    username: row.username,
    email_verified: Boolean(row.email_verified),
    totp_registered: Boolean(row.totp_registered),
    passkey_credential_registered: Boolean(row.passkey_credential_registered),
    security_key_credential_registered: Boolean(row.security_key_credential_registered),
    registered_2fa: Boolean(row.totp_registered || row.security_key_credential_registered || row.totp_registered),
  };

  if (Date.now() >= session.expiresAt.getTime()) {
    await db.deleteFrom("password_reset_session").where("password_reset_session.id", "=", session.id).execute();
    return { session: null, user: null };
  }
  return { session, user };
}

export async function setPasswordResetSessionAsEmailVerified(sessionId: string): Promise<void> {
  await db
    .updateTable("password_reset_session")
    .set({
      email_verified: true,
    })
    .where("password_reset_session.id", "=", sessionId);
}

export async function setPasswordResetSessionAs2FAVerified(sessionId: string): Promise<void> {
  await db
    .updateTable("password_reset_session")
    .set({
      two_factor_verified: true,
    })
    .where("password_reset_session.id", "=", sessionId);
}

export async function invalidateUserPasswordResetSessions(userId: number): Promise<void> {
  await db.deleteFrom("password_reset_session").where("password_reset_session.user_id", "=", userId).execute();
}

// TODO Migrate to Remix way
export function validatePasswordResetSessionRequest(context: APIContext): PasswordResetSessionValidationResult {
  const sessionId = context.cookies.get("password_reset_session")?.value ?? null;
  if (sessionId === null) {
    return { session: null, user: null };
  }
  const result = validatePasswordResetSession(sessionId);
  if (result.session === null) {
    deletePasswordResetSessionCookie(context);
  }
  return result;
}

// TODO Migrate to Remix way
export function setPasswordResetSessionCookie(context: APIContext, session: PasswordResetSession): void {
  context.cookies.set("password_reset_session", session.id, {
    expires: session.expiresAt,
    sameSite: "lax",
    httpOnly: true,
    path: "/",
    secure: !import.meta.env.DEV,
  });
}

// TODO Migrate to Remix way
export function deletePasswordResetSessionCookie(context: APIContext): void {
  context.cookies.set("password_reset_session", "", {
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    path: "/",
    secure: !import.meta.env.DEV,
  });
}

export function sendPasswordResetEmail(email: string, code: string): void {
  console.log(`To ${email}: Your reset code is ${code}`);
}

export interface PasswordResetSession {
  id: string;
  userId: number;
  email: string;
  expiresAt: Date;
  code: string;
  emailVerified: boolean;
  twoFactorVerified: boolean;
}

export type PasswordResetSessionValidationResult =
  | { session: PasswordResetSession; user: User }
  | { session: null; user: null };
