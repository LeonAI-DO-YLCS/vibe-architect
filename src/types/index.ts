import { CustomProvider, CustomModel } from "./custom-provider";
import { CodebaseContext } from "./codebase-context";

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  phase: ConversationPhase;
  messages: Message[];
  sandboxCode: string | null;
  specDocs: Partial<Record<ConversationPhase, string>>;
  /** Codebase contexts attached to this conversation */
  codebaseContexts: CodebaseContext[];
  createdAt: number;
  updatedAt: number;
}

export type ConversationPhase = "vision" | "design" | "stack" | "export";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}



// LLM providers for text chat and the ASR+TTS pipeline
// Built-in providers OR custom provider ID (string)
export type LLMProvider = "openai" | "gemini" | "anthropic" | "mistral" | string;

// Specific models OR custom model ID (string)
export type LLMModel =
  | "gpt-5.2-high"
  | "gpt-5.2-medium"
  | "gpt-5.2-xhigh"
  | "gemini-3-pro"
  | "gemini-3-flash"
  | "claude-opus-4.6"
  | "claude-sonnet-4.5"
  | "mistral-medium-3.1"
  | "mistral-small-3.2"
  | string; // Custom model IDs

export interface LLMModelConfig {
  id: LLMModel;
  name: string;
  provider: LLMProvider;
  maxTokens: number;
  /** The actual model ID sent to the API (if different from `id`) */
  apiModel?: string;
  /** Reasoning effort level for OpenAI reasoning models */
  reasoningEffort?: "medium" | "high" | "xhigh";
}

export const LLM_MODELS: LLMModelConfig[] = [
  {
    id: "gpt-5.2-high",
    name: "GPT-5.2 (High)",
    provider: "openai",
    maxTokens: 128000,
    apiModel: "gpt-5.2",
    reasoningEffort: "high",
  },
  {
    id: "gpt-5.2-medium",
    name: "GPT-5.2 (Medium)",
    provider: "openai",
    maxTokens: 128000,
    apiModel: "gpt-5.2",
    reasoningEffort: "medium",
  },
  {
    id: "gpt-5.2-xhigh",
    name: "GPT-5.2 (XHigh)",
    provider: "openai",
    maxTokens: 128000,
    apiModel: "gpt-5.2",
    reasoningEffort: "xhigh",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "gemini",
    maxTokens: 65000,
    apiModel: "gemini-3-pro-preview",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "gemini",
    maxTokens: 65536,
    apiModel: "gemini-3-flash-preview",
  },
  {
    id: "claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    maxTokens: 128000,
    apiModel: "claude-opus-4-6",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    maxTokens: 64000,
    apiModel: "claude-sonnet-4-5-20250929",
  },
  {
    id: "mistral-medium-3.1",
    name: "Mistral Medium 3.1",
    provider: "mistral",
    maxTokens: 8192,
    apiModel: "mistral-medium-latest",
  },
  {
    id: "mistral-small-3.2",
    name: "Mistral Small 3.2",
    provider: "mistral",
    maxTokens: 8192,
    apiModel: "mistral-small-latest",
  },
];

export function getModelConfig(id: LLMModel): LLMModelConfig | undefined {
  return LLM_MODELS.find((m) => m.id === id);
}

/**
 * Check if a model ID is a built-in model
 */
export function isBuiltInModel(id: LLMModel): boolean {
  return LLM_MODELS.some((m) => m.id === id);
}

/**
 * Check if a provider ID is a built-in provider
 */
export function isBuiltInProvider(id: LLMProvider): boolean {
  return ["openai", "gemini", "anthropic", "mistral"].includes(id as string);
}

// Re-export custom provider types
export type { CustomProvider, CustomModel } from "./custom-provider";
export { PROVIDER_TEMPLATES, createProviderFromTemplate, getFullUrl, providerNeedsApiKey, isProviderConfigured } from "./custom-provider";
export type { CodebaseContext } from "./codebase-context";
export {
  CONTEXT_CONSTRAINTS,
  EXTENSION_TO_LANGUAGE,
  detectLanguage,
  isTextFile,
  isManifestFile,
  createSnippetContext,
  createFileContext,
  createManifestContext,
  createContextFromFile,
  validateContextSize,
  estimateContextTokens,
} from "./codebase-context";
