import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword, validatePasswordMatch } from "@/lib/auth/validation";
import { friendlyAuthError, noticeFromQuery } from "@/lib/auth/messages";

describe("validation", () => {
  it("checks email", () => {
    expect(validateEmail("")).not.toBeNull();
    expect(validateEmail("nope")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
    expect(validateEmail(" user@example.com ")).toBeNull();
  });
  it("checks password length and match", () => {
    expect(validatePassword("")).not.toBeNull();
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("long-enough-1")).toBeNull();
    expect(validatePassword("x".repeat(73))).not.toBeNull();
    expect(validatePasswordMatch("a", "b")).not.toBeNull();
    expect(validatePasswordMatch("a", "a")).toBeNull();
  });
});

describe("friendlyAuthError", () => {
  it("maps known Supabase errors", () => {
    expect(friendlyAuthError({ code: "invalid_credentials" })).toMatch(/incorrect email or password/i);
    expect(friendlyAuthError({ code: "email_not_confirmed" })).toMatch(/confirm your email/i);
    expect(friendlyAuthError({ code: "user_already_exists" })).toMatch(/already exists/i);
    expect(friendlyAuthError({ code: "weak_password" })).toMatch(/too weak/i);
    expect(friendlyAuthError({ code: "same_password" })).toMatch(/different/i);
    expect(friendlyAuthError({ status: 429 })).toMatch(/too many/i);
    expect(friendlyAuthError({ message: "Auth session missing!" })).toMatch(/expired/i);
  });
  it("never leaks raw server text", () => {
    expect(friendlyAuthError({ message: "pg_hba.conf secret detail" })).toBe("Something went wrong. Please try again.");
  });
});

describe("noticeFromQuery", () => {
  it("explains expired sessions and bad links", () => {
    expect(noticeFromQuery(null, "expired")).toMatch(/expired/i);
    expect(noticeFromQuery("link_invalid")).toMatch(/invalid/i);
    expect(noticeFromQuery(null, null)).toBeNull();
    expect(noticeFromQuery("<script>", "x")).toBeNull();
  });
});
