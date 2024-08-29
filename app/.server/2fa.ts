import { FixedRefillTokenBucket } from "./rate_limit";
import { User } from "./user/user_db";

export const totpBucket = new FixedRefillTokenBucket<number>(5, 60 * 30);
export const recoveryCodeBucket = new FixedRefillTokenBucket<number>(5, 60 * 60);

export function get2FARedirect(user: User): string {
  if (user.registered_2fa) {
    return "/2fa/passkey";
  }
  if (user.security_key_credential_registered) {
    return "/2fa/security-key";
  }
  if (user.totp_registered) {
    return "/2fa/totp";
  }
  return "/2fa/setup";
}

export function getPasswordReset2FARedirect(user: User): string {
  if (user.registered_2fa) {
    return "/reset-password/2fa/passkey";
  }
  if (user.security_key_credential_registered) {
    return "/reset-password/2fa/security-key";
  }
  if (user.totp_registered) {
    return "/reset-password/2fa/totp";
  }
  return "/2fa/setup";
}
