import { Message, LLMModel, getModelConfig, isBuiltInModel, CustomProvider, CustomModel, getFullUrl } from "@/types";
import { SYSTEM_PROMPT, buildSystemPrompt } from "./system-prompt";
import { useSettingsStore } from "@/store/settings-store";
import { CodebaseContext } from "@/types/codebase-context";

interface StreamChatOptions {
    messages: Message[];
    apiKey?: string; // Optional - not needed for custom providers
    model: LLMModel;
    onChunk: (chunk: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    signal?: AbortSignal;
    systemPrompt?: string;
    contexts?: CodebaseContext[]; // Codebase contexts for prompt injection
}

interface StreamCustomProviderOptions extends StreamChatOptions {
    provider: CustomProvider;
    modelConfig: CustomModel;
}

export async function streamChat(opts: StreamChatOptions) {
    // Build system prompt with contexts if provided
    const sysPrompt = opts.contexts && opts.contexts.length > 0
        ? buildSystemPrompt(opts.contexts)
        : opts.systemPrompt ?? SYSTEM_PROMPT;
    const optsWithPrompt = { ...opts, systemPrompt: sysPrompt };
    
    // Check if it's a built-in model
    if (isBuiltInModel(opts.model)) {
        const config = getModelConfig(opts.model);
        if (!config) {
            opts.onError(new Error(`Unknown model: ${opts.model}`));
            return;
        }

        switch (config.provider) {
            case "openai":
                return streamOpenAI(optsWithPrompt);
            case "gemini":
                return streamGemini(optsWithPrompt);
            case "anthropic":
                return streamAnthropic(optsWithPrompt);
            case "mistral":
                return streamMistral(optsWithPrompt);
            default:
                opts.onError(new Error(`Unknown provider: ${config.provider}`));
        }
    } else {
        // Custom model - find the provider
        const settings = useSettingsStore.getState();
        const provider = settings.customProviders.find(p => 
            p.models.some(m => m.id === opts.model)
        );
        
        if (!provider) {
            opts.onError(new Error(`No provider found for model: ${opts.model}`));
            return;
        }
        
        const modelConfig = provider.models.find(m => m.id === opts.model);
        if (!modelConfig) {
            opts.onError(new Error(`Model config not found: ${opts.model}`));
            return;
        }
        
        return streamCustomProvider({
            ...optsWithPrompt,
            provider,
            modelConfig,
        });
    }
}

// ─── OpenAI ─────────────────────────────────────────────────────────────────

async function streamOpenAI(opts: StreamChatOptions) {
    const { messages, apiKey = "", model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    if (!config) {
        onError(new Error(`Unknown model: ${model}`));
        return;
    }
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const openaiMessages = [
        { role: "system" as const, content: sysPrompt },
        ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
    ];

    try {
        const body: Record<string, unknown> = {
            model: config.apiModel ?? model,
            messages: openaiMessages,
            stream: true,
            max_completion_tokens: config.maxTokens,
        };

        // Reasoning models use reasoning_effort instead of temperature
        if (config.reasoningEffort) {
            body.reasoning_effort = config.reasoningEffort;
        } else {
            body.temperature = 0.8;
        }

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
                signal,
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

        await readSSEStream(response, (data) => {
            if (data === "[DONE]") {
                onDone();
                return true;
            }
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onChunk(content);
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Mistral ────────────────────────────────────────────────────────────────

async function streamMistral(opts: StreamChatOptions) {
    const { messages, apiKey = "", model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    if (!config) {
        onError(new Error(`Unknown model: ${model}`));
        return;
    }
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const mistralMessages = [
        { role: "system" as const, content: sysPrompt },
        ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
    ];

    try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.apiModel ?? model,
                messages: mistralMessages,
                stream: true,
                max_tokens: config.maxTokens,
                temperature: 0.7,
            }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Mistral API error (${response.status}): ${errorBody}`);
        }

        await readSSEStream(response, (data) => {
            if (data === "[DONE]") {
                onDone();
                return true;
            }

            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;

                if (typeof delta === "string") {
                    onChunk(delta);
                    return false;
                }

                if (Array.isArray(delta)) {
                    for (const part of delta) {
                        if (part?.type === "text" && typeof part.text === "string") {
                            onChunk(part.text);
                        }
                    }
                    return false;
                }

                const text = parsed.choices?.[0]?.message?.content;
                if (typeof text === "string") onChunk(text);
            } catch {
                // skip malformed
            }

            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Google Gemini ──────────────────────────────────────────────────────────

async function streamGemini(opts: StreamChatOptions) {
    const { messages, apiKey = "", model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    if (!config) {
        onError(new Error(`Unknown model: ${model}`));
        return;
    }
    const geminiModel = config.apiModel ?? model;

    // Build contents array for Gemini format
    const contents = [];

    // System instruction goes separately
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const systemInstruction = { parts: [{ text: sysPrompt }] };

    for (const msg of messages) {
        contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_instruction: systemInstruction,
                    contents,
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 8192,
                    },
                }),
                signal,
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
        }

        await readSSEStream(response, (data) => {
            try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) onChunk(text);
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Anthropic (Claude) ─────────────────────────────────────────────────────

async function streamAnthropic(opts: StreamChatOptions) {
    const { messages, apiKey = "", model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    if (!config) {
        onError(new Error(`Unknown model: ${model}`));
        return;
    }

    // Anthropic uses a messages format similar to OpenAI
    // but system goes in a separate field and only user/assistant roles
    const anthropicMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
                model: config.apiModel ?? model,
                max_tokens: config.maxTokens,
                system: opts.systemPrompt ?? SYSTEM_PROMPT,
                messages: anthropicMessages,
                stream: true,
                temperature: 0.8,
            }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `Anthropic API error (${response.status}): ${errorBody}`
            );
        }

        await readSSEStream(response, (data) => {
            try {
                const parsed = JSON.parse(data);

                if (parsed.type === "content_block_delta") {
                    const text = parsed.delta?.text;
                    if (text) onChunk(text);
                } else if (parsed.type === "message_stop") {
                    onDone();
                    return true;
                }
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Shared SSE reader ──────────────────────────────────────────────────────

async function readSSEStream(
    response: Response,
    onData: (data: string) => boolean // return true to stop
) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);

            const shouldStop = onData(data);
            if (shouldStop) return;
        }
    }
}

function handleStreamError(
    error: unknown,
    onDone: () => void,
    onError: (error: Error) => void
) {
    if (error instanceof DOMException && error.name === "AbortError") {
        onDone();
        return;
    }
    onError(error instanceof Error ? error : new Error(String(error)));
}

// ─── Custom Provider ────────────────────────────────────────────────────────

async function streamCustomProvider(opts: StreamCustomProviderOptions) {
    const { messages, provider, modelConfig, onChunk, onDone, onError, signal } = opts;
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const url = getFullUrl(provider);
    
    // Build headers based on auth config
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    
    if (provider.auth.type !== "none" && provider.auth.keyValue) {
        const headerName = provider.auth.keyName;
        const headerValue = provider.auth.keyPrefix + provider.auth.keyValue;
        headers[headerName] = headerValue;
    }
    
    // Build request body based on request format
    let body: Record<string, unknown>;
    
    switch (provider.request.format) {
        case "openai":
            body = {
                model: modelConfig.apiModel,
                messages: [
                    { role: "system", content: sysPrompt },
                    ...messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                ],
                stream: true,
                max_tokens: modelConfig.maxTokens,
                temperature: 0.8,
            };
            break;
            
        case "anthropic":
            body = {
                model: modelConfig.apiModel,
                max_tokens: modelConfig.maxTokens,
                system: sysPrompt,
                messages: messages
                    .filter((m) => m.role !== "system")
                    .map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                stream: true,
                temperature: 0.8,
            };
            break;
            
        case "gemini":
            body = {
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: messages.map((m) => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }],
                })),
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: modelConfig.maxTokens,
                },
            };
            break;
            
        case "custom":
        default:
            body = {
                [provider.request.modelParam]: modelConfig.apiModel,
                messages: [
                    { role: "system", content: sysPrompt },
                    ...messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                ],
                stream: true,
                max_tokens: modelConfig.maxTokens,
                ...provider.request.customBody,
            };
            break;
    }
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal,
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`${provider.name} API error (${response.status}): ${errorBody}`);
        }
        
        // Parse response based on response format
        switch (provider.response.format) {
            case "sse-openai":
                await readSSEStream(response, (data) => {
                    if (data === provider.response.doneMarker || data === "[DONE]") {
                        onDone();
                        return true;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        // Navigate the content path
                        const content = getContentByPath(parsed, provider.response.contentPath);
                        if (content) onChunk(content);
                    } catch {
                        // skip malformed
                    }
                    return false;
                });
                break;
                
            case "sse-anthropic":
                await readSSEStream(response, (data) => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === "content_block_delta") {
                            const text = parsed.delta?.text;
                            if (text) onChunk(text);
                        } else if (parsed.type === "message_stop") {
                            onDone();
                            return true;
                        }
                    } catch {
                        // skip malformed
                    }
                    return false;
                });
                break;
                
            case "sse-gemini":
                await readSSEStream(response, (data) => {
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) onChunk(text);
                    } catch {
                        // skip malformed
                    }
                    return false;
                });
                break;
                
            case "json":
            default:
                // Non-streaming JSON response
                const responseData = await response.json();
                const content = getContentByPath(responseData, provider.response.contentPath);
                if (content) {
                    onChunk(content);
                }
                break;
        }
        
        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

/**
 * Navigate a JSONPath-like path to get content
 */
function getContentByPath(obj: unknown, path: string): string | null {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current: unknown = obj;
    
    for (const part of parts) {
        if (current === null || current === undefined) return null;
        if (typeof current === "object") {
            current = (current as Record<string, unknown>)[part];
        } else {
            return null;
        }
    }
    
    return typeof current === "string" ? current : null;
}
