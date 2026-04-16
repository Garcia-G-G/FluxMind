import { describe, it, expect } from "vitest";
import { authClient, useSession, signIn, signUp, signOut } from "@/lib/auth-client";

describe("auth client exports", () => {
  it("exports authClient object", () => {
    expect(authClient).toBeDefined();
  });

  it("exports useSession hook", () => {
    expect(useSession).toBeDefined();
    expect(typeof useSession).toBe("function");
  });

  it("exports signIn with email and social methods", () => {
    expect(signIn).toBeDefined();
    expect(signIn.email).toBeDefined();
    expect(typeof signIn.email).toBe("function");
    expect(signIn.social).toBeDefined();
    expect(typeof signIn.social).toBe("function");
  });

  it("exports signUp with email method", () => {
    expect(signUp).toBeDefined();
    expect(signUp.email).toBeDefined();
    expect(typeof signUp.email).toBe("function");
  });

  it("exports signOut function", () => {
    expect(signOut).toBeDefined();
    expect(typeof signOut).toBe("function");
  });
});
