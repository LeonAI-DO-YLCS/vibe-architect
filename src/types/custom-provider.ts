/**
 * Custom Provider Types
 * 
 * Types for configuring custom LLM providers beyond the built-in options.
 * Supports OpenAI-compatible, Anthropic-compatible, and fully custom APIs.
 */

// Provider type discriminator
export type ProviderType = "openai-compatible" | "anthropic-compatible" | "custom";

// Authentication type discriminator
export type AuthType = "bearer" | "x-api-key" | "query-param" | "none";

/**
 * Authentication configuration
 * Defines how API keys are sent to the provider
 */
export interface AuthConfig {
  /** Authentication method */
  type: AuthType;
  /** Header name: "Authorization", "x-api-key", etc. */
  keyName: string;
  /** Prefix for the key value: "Bearer " or "" */
  keyPrefix: string;
  /** The actual API key value (stored separately for security) */
  keyValue?: string;
}

/**
 * Endpoint configuration
 * Defines the URL structure for the provider API
 */
export interface EndpointConfig {
  /** Base URL: "http://localhost:11434" or "https://api.together.xyz" */
  baseUrl: string;
  /** API path: "/v1/chat/completions" */
  path: string;
  /** Computed full URL (baseUrl + path) - not stored, computed on use */
}

/**
 * Request format configuration
 * Defines how the request body is structured
 */
export interface RequestConfig {
  /** Request body format */
  format: "openai" | "anthropic" | "gemini" | "custom";
  /** Parameter name for model: "model" */
  modelParam: string;
  /** Additional body fields for custom APIs */
  customBody?: Record<string, unknown>;
}

/**
 * Response format configuration
 * Defines how to parse the streaming response
 */
export interface ResponseConfig {
  /** Response streaming format */
  format: "sse-openai" | "sse-anthropic" | "sse-gemini" | "json";
  /** JSONPath to content: "choices[0].delta.content" */
  contentPath: string;
  /** Marker for stream end: "[DONE]" */
  doneMarker?: string;
}

/**
 * Custom model definition
 * Represents a single model available from a custom provider
 */
export interface CustomModel {
  /** Internal ID used in the app: "llama3.2" */
  id: string;
  /** Display name: "Llama 3.2" */
  name: string;
  /** Model ID sent to API: "llama3.2:latest" or "meta-llama/Llama-3-70b" */
  apiModel: string;
  /** Maximum output tokens */
  maxTokens: number;
  /** Context window size (optional) */
  contextWindow?: number;
}

/**
 * Complete custom provider definition
 * Represents a user-configured LLM provider
 */
export interface CustomProvider {
  /** Unique identifier: "ollama-local" */
  id: string;
  /** Display name: "Ollama (Local)" */
  name: string;
  /** Template type for defaults */
  type: ProviderType;
  /** Whether this provider is active */
  enabled: boolean;
  /** URL configuration */
  endpoint: EndpointConfig;
  /** Authentication configuration */
  auth: AuthConfig;
  /** Request format configuration */
  request: RequestConfig;
  /** Response format configuration */
  response: ResponseConfig;
  /** Available models for this provider */
  models: CustomModel[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Provider template for quick setup
 * Pre-configured defaults for common provider types
 */
export interface ProviderTemplate {
  /** Template ID matching ProviderType */
  id: ProviderType;
  /** Display name */
  name: string;
  /** Description for users */
  description: string;
  /** Default values for this template */
  defaults: Partial<CustomProvider>;
}

/**
 * Pre-defined provider templates
 */
export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "openai-compatible",
    name: "OpenAI Compatible",
    description: "Works with Ollama, vLLM, Together, Groq, OpenRouter, DeepSeek, and most local/cloud providers",
    defaults: {
      type: "openai-compatible",
      endpoint: { baseUrl: "", path: "/v1/chat/completions" },
      auth: { type: "bearer", keyName: "Authorization", keyPrefix: "Bearer " },
      request: { format: "openai", modelParam: "model" },
      response: { format: "sse-openai", contentPath: "choices[0].delta.content", doneMarker: "[DONE]" },
    },
  },
  {
    id: "anthropic-compatible",
    name: "Anthropic Compatible",
    description: "Works with Claude-compatible endpoints and self-hosted Anthropic proxies",
    defaults: {
      type: "anthropic-compatible",
      endpoint: { baseUrl: "", path: "/v1/messages" },
      auth: { type: "x-api-key", keyName: "x-api-key", keyPrefix: "" },
      request: { format: "anthropic", modelParam: "model" },
      response: { format: "sse-anthropic", contentPath: "delta.text" },
    },
  },
  {
    id: "custom",
    name: "Custom",
    description: "Fully configurable for any API format - requires manual setup",
    defaults: {
      type: "custom",
      endpoint: { baseUrl: "", path: "" },
      auth: { type: "none", keyName: "", keyPrefix: "" },
      request: { format: "custom", modelParam: "model" },
      response: { format: "json", contentPath: "content" },
    },
  },
];

/**
 * Helper function to create a new custom provider from a template
 */
export function createProviderFromTemplate(
  templateId: ProviderType,
  name: string,
  baseUrl: string
): Partial<CustomProvider> {
  const template = PROVIDER_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  return {
    ...template.defaults,
    name,
    endpoint: {
      ...template.defaults.endpoint!,
      baseUrl,
    },
    enabled: true,
    models: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Helper function to compute the full URL for a provider
 */
export function getFullUrl(provider: CustomProvider): string {
  const baseUrl = provider.endpoint.baseUrl.replace(/\/$/, "");
  const path = provider.endpoint.path.startsWith("/")
    ? provider.endpoint.path
    : "/" + provider.endpoint.path;
  return baseUrl + path;
}

/**
 * Helper function to check if a provider needs an API key
 */
export function providerNeedsApiKey(provider: CustomProvider): boolean {
  return provider.auth.type !== "none";
}

/**
 * Helper function to check if a provider is properly configured
 */
export function isProviderConfigured(provider: CustomProvider): boolean {
  // Must have a base URL
  if (!provider.endpoint.baseUrl.trim()) {
    return false;
  }

  // Must have at least one model
  if (provider.models.length === 0) {
    return false;
  }

  // If auth is required, must have a key value
  if (provider.auth.type !== "none" && !provider.auth.keyValue?.trim()) {
    return false;
  }

  return true;
}