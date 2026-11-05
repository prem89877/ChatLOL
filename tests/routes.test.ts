import { describe, expect, it } from "vitest";
import { decideRoute, safeNextPath } from "@/lib/auth/routes";

describe("decideRoute", () => {
  it("sends signed-out users from the chat to login", () => {
    expect(decideRoute("/", false)).toBe("redirect-login");
    expect(decideRoute("/reset-password", false)).toBe("redirect-login");
  });
  it("lets signed-in users use the chat and reset-password", () => {
    expect(decideRoute("/", true)).toBe("allow");
    expect(decideRoute("/reset-password", true)).toBe("allow");
  });
  it("shows login/signup/forgot-password only to signed-out users", () => {
    for (const p of ["/login", "/signup", "/forgot-password"]) {
      expect(decideRoute(p, false)).toBe("allow");
      expect(decideRoute(p, true)).toBe("redirect-home");
    }
  });
  it("rejects signed-out API calls with 401 instead of redirecting", () => {
    expect(decideRoute("/api/chat", false)).toBe("unauthorized");
    expect(decideRoute("/api/chat", true)).toBe("allow");
  });
  it("always lets the email-link callback through", () => {
    expect(decideRoute("/auth/callback", false)).toBe("allow");
    expect(decideRoute("/auth/callback", true)).toBe("allow");
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/")).toBe("/");
  });
  it("blocks open redirects", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "evil", "", null, undefined, "/a\nb"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
