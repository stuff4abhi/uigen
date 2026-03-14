import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

// Mock anon work tracker
const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

// Mock project actions
const mockGetProjects = vi.fn();
const mockCreateProject = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

const { useAuth } = await import("@/hooks/use-auth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth — initial state", () => {
  it("returns isLoading as false initially", () => {
    mockGetAnonWorkData.mockReturnValue(null);
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  it("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  it("sets isLoading to true during the call and false after", async () => {
    let resolveSignIn!: (val: unknown) => void;
    const pendingSignIn = new Promise((res) => { resolveSignIn = res; });
    mockSignIn.mockReturnValue(pendingSignIn);
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    // Start sign-in without awaiting so we can inspect mid-flight state
    let callPromise: Promise<unknown>;
    act(() => { callPromise = result.current.signIn("user@example.com", "password123"); });

    // After the first tick setIsLoading(true) should have fired
    await vi.waitFor(() => expect(result.current.isLoading).toBe(true));

    // Resolve the pending sign-in and wait for everything to settle
    await act(async () => {
      resolveSignIn({ success: false, error: "Invalid credentials" });
      await callPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("calls signInAction with email and password", async () => {
    mockSignIn.mockResolvedValue({ success: false });
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
  });

  it("returns the result from signInAction", async () => {
    const authResult = { success: false, error: "Invalid credentials" };
    mockSignIn.mockResolvedValue(authResult);
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());
    let returnValue;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "bad");
    });

    expect(returnValue).toEqual(authResult);
  });

  it("does not call handlePostSignIn when signIn fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "wrongpassword");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets isLoading to false even when signInAction throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("signUp", () => {
  it("sets isLoading to true during the call and false after", async () => {
    let resolveSignUp!: (val: unknown) => void;
    const pendingSignUp = new Promise((res) => { resolveSignUp = res; });
    mockSignUp.mockReturnValue(pendingSignUp);
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    let callPromise: Promise<unknown>;
    act(() => { callPromise = result.current.signUp("user@example.com", "password123"); });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => {
      resolveSignUp({ success: false, error: "Email already registered" });
      await callPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("calls signUpAction with email and password", async () => {
    mockSignUp.mockResolvedValue({ success: false });
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "securepass");
    });

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "securepass");
  });

  it("returns the result from signUpAction", async () => {
    const authResult = { success: false, error: "Email already registered" };
    mockSignUp.mockResolvedValue(authResult);
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());
    let returnValue;
    await act(async () => {
      returnValue = await result.current.signUp("existing@example.com", "password123");
    });

    expect(returnValue).toEqual(authResult);
  });

  it("does not call handlePostSignIn when signUp fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
    mockGetAnonWorkData.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("existing@example.com", "password123");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets isLoading to false even when signUpAction throws", async () => {
    mockSignUp.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("user@example.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("handlePostSignIn — with anonymous work", () => {
  it("creates a project from anon work data and navigates to it", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Hello" }],
      fileSystemData: { "/App.jsx": { content: "export default () => <div/>" } },
    });
    mockCreateProject.mockResolvedValue({ id: "proj-anon-1" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Hello" }],
        data: { "/App.jsx": { content: "export default () => <div/>" } },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/proj-anon-1");
  });

  it("includes a timestamped name in the created project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Hello" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "proj-anon-2" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining("Design from") })
    );
  });

  it("does not call getProjects when anon work exists", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Hello" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "proj-anon-3" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — no anonymous work, existing projects", () => {
  it("navigates to the most recent project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([
      { id: "proj-recent", name: "Recent", createdAt: new Date(), updatedAt: new Date() },
      { id: "proj-old", name: "Old", createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockPush).toHaveBeenCalledWith("/proj-recent");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("does not create a new project when existing projects are found", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "proj-1", name: "My Design" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — no anonymous work, no existing projects", () => {
  it("creates a new project and navigates to it", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "proj-new-1" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/proj-new-1");
  });

  it("creates project with a randomised 'New Design' name", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "proj-new-2" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringMatching(/^New Design #\d+$/) })
    );
  });
});

describe("handlePostSignIn — anon work with empty messages", () => {
  it("falls through to getProjects when anon messages array is empty", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "proj-existing" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/proj-existing");
    expect(mockClearAnonWork).not.toHaveBeenCalled();
  });
});

describe("signUp — post sign-in flow", () => {
  it("runs handlePostSignIn after successful sign-up", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "proj-after-signup" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(mockPush).toHaveBeenCalledWith("/proj-after-signup");
  });

  it("saves anon work on successful sign-up", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Make me a button" }],
      fileSystemData: { "/App.jsx": {} },
    });
    mockCreateProject.mockResolvedValue({ id: "proj-signup-anon" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Make me a button" }],
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/proj-signup-anon");
  });
});
