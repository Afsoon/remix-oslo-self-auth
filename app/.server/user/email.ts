import { db } from "../db";
import { generateRandomOTP } from "../password/util";
import { ConstantRefillTokenBucket } from "../rate_limit";

export function verifyEmailInput(email: string): boolean {
  return /^.+@.+\..+$/.test(email) && email.length < 256;
}

export async function getUserEmailVerificationRequest(user_id: number): Promise<EmailVerificationRequest | null> {
  const result = await db
    .selectFrom("email_verification_request")
    .select(["code", "email", "expires_at", "id", "user_id"])
    .where("email_verification_request.user_id", "=", user_id)
    .executeTakeFirst();

  if (result == null) {
    return null;
  }

  if (Date.now() >= result.expires_at.getTime()) {
    await db.deleteFrom("email_verification_request").where("email_verification_request.id", "=", result.id).execute();
    return null;
  }

  return result;
}

export async function createEmailVerificationRequest(
  user_id: number,
  email: string,
): Promise<EmailVerificationRequest> {
  deleteUserEmailVerificationRequest(user_id);
  const code = generateRandomOTP();
  const expires_at = new Date(Date.now() + 1000 * 60 * 10);

  const result = await db
    .insertInto("email_verification_request")
    .values({
      code,
      expires_at,
      user_id,
      email,
    })
    .returningAll()
    .executeTakeFirst();

  if (result == null) {
    throw new Error();
  }

  return result;
}

export async function deleteUserEmailVerificationRequest(user_id: number) {
  await db.deleteFrom("email_verification_request").where("email_verification_request.user_id", "=", user_id).execute();
}

export function sendVerificationEmail(email: string, code: string): void {
  console.log(`To ${email}: Your verification code is ${code}`);
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const result = await db.selectFrom("users").selectAll().where("users.email", "=", email).executeTakeFirst();

  if (result == null) {
    return true;
  }

  return false;
}

export const sendVerificationEmailBucket = new ConstantRefillTokenBucket<number>(3, 30);

export interface EmailVerificationRequest {
  id: number;
  user_id: number;
  code: string;
  email: string;
  expires_at: Date;
}
