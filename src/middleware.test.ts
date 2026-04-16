import { describe, it, expect } from "vitest";

// Test the middleware route matching logic (not the actual middleware which needs Next.js runtime)
describe("middleware route protection logic", () => {
  const protectedPaths = ["/dashboard", "/notebook", "/settings"];
  const authPaths = ["/login", "/register"];

  const isProtected = (pathname: string): boolean =>
    protectedPaths.some((path) => pathname.startsWith(path));

  const isAuthPage = (pathname: string): boolean =>
    authPaths.some((path) => pathname.startsWith(path));

  it("identifies protected routes correctly", () => {
    expect(isProtected("/dashboard")).toBe(true);
    expect(isProtected("/dashboard/anything")).toBe(true);
    expect(isProtected("/notebook/abc123")).toBe(true);
    expect(isProtected("/notebook/abc123/studio")).toBe(true);
    expect(isProtected("/settings")).toBe(true);
    expect(isProtected("/settings/billing")).toBe(true);
  });

  it("does not protect public routes", () => {
    expect(isProtected("/")).toBe(false);
    expect(isProtected("/pricing")).toBe(false);
    expect(isProtected("/login")).toBe(false);
    expect(isProtected("/register")).toBe(false);
    expect(isProtected("/api/auth/sign-in")).toBe(false);
  });

  it("identifies auth pages correctly", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/register")).toBe(true);
    expect(isAuthPage("/dashboard")).toBe(false);
    expect(isAuthPage("/")).toBe(false);
  });

  it("unauthenticated users should be redirected from protected routes", () => {
    const isAuthenticated = false;
    const pathname = "/dashboard";
    const shouldRedirectToLogin = isProtected(pathname) && !isAuthenticated;
    expect(shouldRedirectToLogin).toBe(true);
  });

  it("authenticated users should be redirected from auth pages", () => {
    const isAuthenticated = true;
    const pathname = "/login";
    const shouldRedirectToDashboard = isAuthPage(pathname) && isAuthenticated;
    expect(shouldRedirectToDashboard).toBe(true);
  });

  it("authenticated users can access protected routes", () => {
    const isAuthenticated = true;
    const pathname = "/dashboard";
    const shouldRedirectToLogin = isProtected(pathname) && !isAuthenticated;
    expect(shouldRedirectToLogin).toBe(false);
  });
});
