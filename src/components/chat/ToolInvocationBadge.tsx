"use client";

import { Loader2 } from "lucide-react";

export function getToolLabel(toolName: string, args: Record<string, any>): string {
  const { command, path, new_path } = args;

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":      return `Creating ${path}`;
      case "str_replace": return `Editing ${path}`;
      case "insert":      return `Inserting into ${path}`;
      case "view":        return `Viewing ${path}`;
      case "undo_edit":   return `Undoing edit in ${path}`;
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": return new_path ? `Renaming ${path} → ${new_path}` : `Renaming ${path}`;
      case "delete": return `Deleting ${path}`;
    }
  }

  return toolName;
}

interface ToolInvocationBadgeProps {
  toolName: string;
  args: Record<string, any>;
  state: string;
  result?: unknown;
}

export function ToolInvocationBadge({ toolName, args, state, result }: ToolInvocationBadgeProps) {
  const isDone = state === "result" && result;
  const label = getToolLabel(toolName, args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
