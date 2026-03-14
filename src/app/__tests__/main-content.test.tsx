import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

// Mock heavy dependencies
vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <>{children}</>,
  useFileSystem: vi.fn(() => ({ fileSystem: null, handleToolCall: vi.fn() })),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <>{children}</>,
  useChat: vi.fn(() => ({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    append: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface" />,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame" />,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree" />,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions" />,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children, direction, className }: any) => (
    <div className={className} data-direction={direction}>{children}</div>
  ),
  ResizablePanel: ({ children, defaultSize }: any) => (
    <div data-default-size={defaultSize}>{children}</div>
  ),
  ResizableHandle: ({ className }: any) => <div className={className} />,
}));

afterEach(() => {
  cleanup();
});

test("Preview tab is active by default", () => {
  render(<MainContent />);
  const previewTab = screen.getByRole("tab", { name: "Preview" });
  expect(previewTab).toHaveAttribute("data-state", "active");
});

test("Code tab is inactive by default", () => {
  render(<MainContent />);
  const codeTab = screen.getByRole("tab", { name: "Code" });
  expect(codeTab).toHaveAttribute("data-state", "inactive");
});

test("PreviewFrame renders by default", () => {
  render(<MainContent />);
  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
});

test("Clicking Code tab switches to code view", async () => {
  const user = userEvent.setup();
  render(<MainContent />);
  const codeTab = screen.getByRole("tab", { name: "Code" });
  await user.click(codeTab);
  expect(screen.getByTestId("code-editor")).toBeDefined();
  expect(screen.queryByTestId("preview-frame")).toBeNull();
  expect(codeTab).toHaveAttribute("data-state", "active");
});

test("Clicking Preview tab switches back to preview", async () => {
  const user = userEvent.setup();
  render(<MainContent />);
  // Switch to code first
  await user.click(screen.getByRole("tab", { name: "Code" }));
  expect(screen.queryByTestId("preview-frame")).toBeNull();
  // Switch back to preview
  await user.click(screen.getByRole("tab", { name: "Preview" }));
  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
});
