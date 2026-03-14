import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const mockSign = vi.fn().mockResolvedValue("mock.jwt.token");

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: mockSign,
  })),
  jwtVerify: vi.fn(),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("../auth");
const { SignJWT, jwtVerify } = await import("jose");

const mockJwtVerify = vi.mocked(jwtVerify);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockSign.mockResolvedValue("mock.jwt.token");
});

describe("createSession", () => {
  it("calls SignJWT with userId and email in payload", async () => {
    await createSession("user-123", "test@example.com");
    expect(SignJWT).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-123", email: "test@example.com" })
    );
  });

  it("calls .sign() with the JWT secret", async () => {
    await createSession("user-123", "test@example.com");
    expect(mockSign).toHaveBeenCalledWith(expect.anything());
  });

  it("calls cookieStore.set with correct options in non-production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await createSession("user-123", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "auth-token",
      "mock.jwt.token",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      })
    );
  });

  it("sets secure: true when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await createSession("user-123", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "auth-token",
      "mock.jwt.token",
      expect.objectContaining({ secure: true })
    );
  });
});

describe("getSession", () => {
  it("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const result = await getSession();
    expect(result).toBeNull();
  });

  it("returns session payload when jwtVerify resolves successfully", async () => {
    const payload = { userId: "user-123", email: "test@example.com", expiresAt: new Date() };
    mockCookieStore.get.mockReturnValue({ value: "valid.jwt.token" });
    mockJwtVerify.mockResolvedValue({ payload } as never);

    const result = await getSession();
    expect(result).toEqual(payload);
  });

  it("returns null when jwtVerify throws", async () => {
    mockCookieStore.get.mockReturnValue({ value: "invalid.jwt.token" });
    mockJwtVerify.mockRejectedValue(new Error("invalid token"));

    const result = await getSession();
    expect(result).toBeNull();
  });
});

describe("deleteSession", () => {
  it("calls cookieStore.delete with auth-token", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  it("returns null when request has no auth-token cookie", async () => {
    const req = new NextRequest("http://localhost/");
    const result = await verifySession(req);
    expect(result).toBeNull();
  });

  it("returns session payload when jwtVerify resolves successfully", async () => {
    const payload = { userId: "user-456", email: "other@example.com", expiresAt: new Date() };
    mockJwtVerify.mockResolvedValue({ payload } as never);

    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "auth-token=some.jwt.token" },
    });
    const result = await verifySession(req);
    expect(result).toEqual(payload);
  });

  it("returns null when jwtVerify throws", async () => {
    mockJwtVerify.mockRejectedValue(new Error("expired"));

    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "auth-token=expired.jwt.token" },
    });
    const result = await verifySession(req);
    expect(result).toBeNull();
  });
});
