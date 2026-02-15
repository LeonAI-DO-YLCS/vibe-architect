/**
 * Codebase Context Types
 * 
 * Types for attaching codebase context to conversations.
 * Allows users to provide existing code for context-aware spec generation.
 */

import { v4 as uuid } from "uuid";

// Context type discriminator
export type ContextType = "snippet" | "file" | "manifest";

/**
 * Context metadata
 * Common metadata for all context types
 */
export interface ContextMetadata {
  /** Programming language for syntax highlighting (optional) */
  language?: string;
  /** File path if applicable (optional) */
  path?: string;
  /** Size in bytes */
  size: number;
  /** Upload timestamp */
  uploadedAt: number;
  /** Whether this context is active (included in prompts) */
  isActive: boolean;
}

/**
 * Code snippet context
 * User-pasted code blocks
 */
export interface SnippetContext {
  type: "snippet";
  id: string;
  /** User-provided name for the snippet */
  name: string;
  /** The code content */
  content: string;
  metadata: ContextMetadata;
}

/**
 * File upload context
 * Single file uploaded by user
 */
export interface FileContext {
  type: "file";
  id: string;
  /** File name */
  name: string;
  /** File content (text only) */
  content: string;
  metadata: ContextMetadata;
}

/**
 * Project manifest context
 * Configuration files like package.json, tsconfig.json, etc.
 */
export interface ManifestContext {
  type: "manifest";
  id: string;
  /** Manifest file name: "package.json" */
  name: string;
  /** Raw file content */
  content: string;
  /** Parsed JSON content (optional, for structured access) */
  parsed?: Record<string, unknown>;
  metadata: ContextMetadata;
}

/**
 * Union type for all context types
 */
export type CodebaseContext = SnippetContext | FileContext | ManifestContext;

/**
 * Size constraints for contexts
 */
export const CONTEXT_CONSTRAINTS = {
  /** Maximum size for a single file: 100KB */
  MAX_SINGLE_FILE: 100 * 1024,
  /** Maximum total context size per conversation: 500KB */
  MAX_TOTAL_CONTEXT: 500 * 1024,
  /** Maximum number of files per conversation */
  MAX_FILES_PER_CONVERSATION: 20,
} as const;

/**
 * File extensions to language mapping
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  cfg: "ini",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  dockerfile: "dockerfile",
  makefile: "makefile",
  r: "r",
  lua: "lua",
  perl: "perl",
  pl: "perl",
  pm: "perl",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
};

/**
 * Detect language from file extension
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXTENSION_TO_LANGUAGE[ext] || "text";
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Check if a file is a text file (can be read as context)
 */
export function isTextFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  // Known text file extensions
  const textExtensions = new Set([
    "txt", "md", "markdown", "json", "yaml", "yml", "toml", "ini", "cfg",
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs",
    "java", "kt", "kts", "swift", "c", "cpp", "cc", "cxx", "h", "hpp",
    "cs", "php", "css", "scss", "sass", "less", "html", "htm", "xml", "svg",
    "sql", "sh", "bash", "zsh", "ps1", "dockerfile", "makefile",
    "r", "lua", "perl", "pl", "pm", "vue", "svelte", "astro",
    "env", "gitignore", "dockerignore", "editorconfig",
    "lock", "sum", "mod",
  ]);
  return textExtensions.has(ext) || EXTENSION_TO_LANGUAGE[ext] !== undefined;
}

/**
 * Check if a file is a manifest file (package.json, etc.)
 */
export function isManifestFile(filename: string): boolean {
  const manifestFiles = new Set([
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    "pyproject.toml",
    "requirements.txt",
    "cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "gemfile",
    "composer.json",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
  ]);
  const lowerName = filename.toLowerCase();
  return manifestFiles.has(lowerName) || lowerName.endsWith(".json") || lowerName.endsWith(".toml");
}

/**
 * Create a snippet context
 */
export function createSnippetContext(
  name: string,
  content: string,
  language?: string
): SnippetContext {
  return {
    type: "snippet",
    id: uuid(),
    name,
    content,
    metadata: {
      language: language || detectLanguage(name),
      size: new Blob([content]).size,
      uploadedAt: Date.now(),
      isActive: true,
    },
  };
}

/**
 * Create a file context
 */
export function createFileContext(
  filename: string,
  content: string
): FileContext {
  return {
    type: "file",
    id: uuid(),
    name: filename,
    content,
    metadata: {
      language: detectLanguage(filename),
      path: filename,
      size: new Blob([content]).size,
      uploadedAt: Date.now(),
      isActive: true,
    },
  };
}

/**
 * Create a manifest context
 */
export function createManifestContext(
  filename: string,
  content: string
): ManifestContext {
  let parsed: Record<string, unknown> | undefined;
  
  // Try to parse JSON manifests
  if (filename.endsWith(".json")) {
    try {
      parsed = JSON.parse(content);
    } catch {
      // Keep parsed undefined if parsing fails
    }
  }
  
  return {
    type: "manifest",
    id: uuid(),
    name: filename,
    content,
    parsed,
    metadata: {
      language: detectLanguage(filename),
      path: filename,
      size: new Blob([content]).size,
      uploadedAt: Date.now(),
      isActive: true,
    },
  };
}

/**
 * Create a context from file content
 * Automatically determines the appropriate context type
 */
export function createContextFromFile(
  filename: string,
  content: string
): CodebaseContext {
  if (isManifestFile(filename)) {
    return createManifestContext(filename, content);
  }
  return createFileContext(filename, content);
}

/**
 * Validate context size constraints
 */
export function validateContextSize(
  content: string,
  existingContexts: CodebaseContext[]
): { valid: boolean; reason?: string } {
  const newSize = new Blob([content]).size;
  
  // Check single file size
  if (newSize > CONTEXT_CONSTRAINTS.MAX_SINGLE_FILE) {
    return {
      valid: false,
      reason: `File exceeds ${Math.round(CONTEXT_CONSTRAINTS.MAX_SINGLE_FILE / 1024)}KB limit (${Math.round(newSize / 1024)}KB)`,
    };
  }
  
  // Check total count
  if (existingContexts.length >= CONTEXT_CONSTRAINTS.MAX_FILES_PER_CONVERSATION) {
    return {
      valid: false,
      reason: `Maximum ${CONTEXT_CONSTRAINTS.MAX_FILES_PER_CONVERSATION} files per conversation`,
    };
  }
  
  // Check total size
  const existingSize = existingContexts.reduce(
    (sum, ctx) => sum + ctx.metadata.size,
    0
  );
  const totalSize = existingSize + newSize;
  
  if (totalSize > CONTEXT_CONSTRAINTS.MAX_TOTAL_CONTEXT) {
    return {
      valid: false,
      reason: `Total context would exceed ${Math.round(CONTEXT_CONSTRAINTS.MAX_TOTAL_CONTEXT / 1024)}KB limit`,
    };
  }
  
  return { valid: true };
}

/**
 * Get total size of active contexts
 */
export function getActiveContextsSize(contexts: CodebaseContext[]): number {
  return contexts
    .filter(ctx => ctx.metadata.isActive)
    .reduce((sum, ctx) => sum + ctx.metadata.size, 0);
}

/**
 * Estimate token count for contexts
 * Rough estimate: ~4 characters per token
 */
export function estimateContextTokens(contexts: CodebaseContext[]): number {
  const totalChars = contexts
    .filter(ctx => ctx.metadata.isActive)
    .reduce((sum, ctx) => sum + ctx.content.length, 0);
  return Math.ceil(totalChars / 4);
}