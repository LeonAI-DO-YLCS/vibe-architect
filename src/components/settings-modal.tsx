"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/settings-store";
import { LLM_MODELS, LLMModel, isBuiltInModel } from "@/types";
import {
    CustomProvider,
    CustomModel,
    ProviderType,
    PROVIDER_TEMPLATES,
    createProviderFromTemplate,
    isProviderConfigured,
    providerNeedsApiKey,
} from "@/types/custom-provider";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const s = useSettingsStore();

    const [keys, setKeys] = useState({
        openai: s.openaiKey,
        gemini: s.geminiKey,
        anthropic: s.anthropicKey,
        mistral: s.mistralKey,
    });
    const [showKeys, setShowKeys] = useState(false);
    const [activeTab, setActiveTab] = useState<"builtin" | "custom">("builtin");
    
    // Custom provider form state
    const [showProviderForm, setShowProviderForm] = useState(false);
    const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
    const [providerForm, setProviderForm] = useState<Partial<CustomProvider>>({});
    const [newModel, setNewModel] = useState<Partial<CustomModel>>({});

    useEffect(() => {
        setKeys({
            openai: s.openaiKey,
            gemini: s.geminiKey,
            anthropic: s.anthropicKey,
            mistral: s.mistralKey,
        });
    }, [s.openaiKey, s.geminiKey, s.anthropicKey, s.mistralKey, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        s.setKey("openai", keys.openai.trim());
        s.setKey("gemini", keys.gemini.trim());
        s.setKey("anthropic", keys.anthropic.trim());
        s.setKey("mistral", keys.mistral.trim());
        onClose();
    };

    const handleClear = () => {
        s.clearKeys();
        setKeys({ openai: "", gemini: "", anthropic: "", mistral: "" });
    };

    // Custom provider handlers
    const handleAddProvider = () => {
        setEditingProvider(null);
        setProviderForm({
            type: "openai-compatible",
            enabled: true,
            models: [],
        });
        setShowProviderForm(true);
    };

    const handleEditProvider = (provider: CustomProvider) => {
        setEditingProvider(provider);
        setProviderForm({ ...provider });
        setShowProviderForm(true);
    };

    const handleDeleteProvider = (id: string) => {
        if (confirm("Are you sure you want to delete this provider?")) {
            s.removeCustomProvider(id);
        }
    };

    const handleSaveProvider = () => {
        if (!providerForm.name || !providerForm.endpoint?.baseUrl) {
            alert("Please fill in required fields: Name and Base URL");
            return;
        }

        const now = Date.now();
        if (editingProvider) {
            // Update existing
            s.updateCustomProvider(editingProvider.id, {
                ...providerForm,
                updatedAt: now,
            } as Partial<CustomProvider>);
        } else {
            // Create new
            const newProvider: CustomProvider = {
                id: `custom-${now}`,
                name: providerForm.name,
                type: providerForm.type || "openai-compatible",
                enabled: providerForm.enabled ?? true,
                endpoint: providerForm.endpoint || { baseUrl: "", path: "/v1/chat/completions" },
                auth: providerForm.auth || { type: "bearer", keyName: "Authorization", keyPrefix: "Bearer " },
                request: providerForm.request || { format: "openai", modelParam: "model" },
                response: providerForm.response || { format: "sse-openai", contentPath: "choices[0].delta.content" },
                models: providerForm.models || [],
                createdAt: now,
                updatedAt: now,
            };
            s.addCustomProvider(newProvider);
        }

        setShowProviderForm(false);
        setProviderForm({});
        setNewModel({});
    };

    const handleAddModel = () => {
        if (!newModel.id || !newModel.name || !newModel.apiModel) {
            alert("Please fill in model ID, Name, and API Model");
            return;
        }

        const model: CustomModel = {
            id: newModel.id,
            name: newModel.name,
            apiModel: newModel.apiModel,
            maxTokens: newModel.maxTokens || 4096,
            contextWindow: newModel.contextWindow,
        };

        setProviderForm(prev => ({
            ...prev,
            models: [...(prev.models || []), model],
        }));
        setNewModel({});
    };

    const handleRemoveModel = (modelId: string) => {
        setProviderForm(prev => ({
            ...prev,
            models: (prev.models || []).filter(m => m.id !== modelId),
        }));
    };

    const handleTemplateSelect = (templateId: ProviderType) => {
        const template = PROVIDER_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setProviderForm(prev => ({
                ...prev,
                type: templateId,
                endpoint: { ...template.defaults.endpoint!, ...prev.endpoint },
                auth: { ...template.defaults.auth!, ...prev.auth },
                request: { ...template.defaults.request!, ...prev.request },
                response: { ...template.defaults.response!, ...prev.response },
            }));
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--accent-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--accent-primary)]"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Tabs ─────────────────────────────────────────────── */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab("builtin")}
                        className={`px-4 py-2 text-sm rounded-[var(--radius-sm)] transition-colors ${
                            activeTab === "builtin"
                                ? "bg-[var(--accent-primary)] text-[var(--bg-base)]"
                                : "border border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                        }`}
                    >
                        Built-in Providers
                    </button>
                    <button
                        onClick={() => setActiveTab("custom")}
                        className={`px-4 py-2 text-sm rounded-[var(--radius-sm)] transition-colors ${
                            activeTab === "custom"
                                ? "bg-[var(--accent-primary)] text-[var(--bg-base)]"
                                : "border border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                        }`}
                    >
                        Custom Providers
                    </button>
                </div>

                {activeTab === "builtin" ? (
                    <>
                        {/* ── API Keys ─────────────────────────────────────────── */}
                        <Section title="API Keys">
                            <KeyInput
                                label="OpenAI"
                                value={keys.openai}
                                onChange={(v) => setKeys({ ...keys, openai: v })}
                                placeholder="sk-..."
                                show={showKeys}
                                configured={s.openaiKey.length > 0}
                            />
                            <KeyInput
                                label="Google Gemini"
                                value={keys.gemini}
                                onChange={(v) => setKeys({ ...keys, gemini: v })}
                                placeholder="AIza..."
                                show={showKeys}
                                configured={s.geminiKey.length > 0}
                            />
                            <KeyInput
                                label="Anthropic"
                                value={keys.anthropic}
                                onChange={(v) => setKeys({ ...keys, anthropic: v })}
                                placeholder="sk-ant-..."
                                show={showKeys}
                                configured={s.anthropicKey.length > 0}
                            />
                            <KeyInput
                                label="Mistral"
                                value={keys.mistral}
                                onChange={(v) => setKeys({ ...keys, mistral: v })}
                                placeholder="your-mistral-key"
                                show={showKeys}
                                configured={s.mistralKey.length > 0}
                            />
                            <button
                                onClick={() => setShowKeys(!showKeys)}
                                className="mt-1 text-xs text-[var(--accent-dim)] transition-colors hover:text-[var(--accent-muted)]"
                            >
                                {showKeys ? "Hide keys" : "Show keys"}
                            </button>
                        </Section>

                        {/* ── LLM Model ────────────────────────────────────────── */}
                        <Section title="Chat Model">
                            <div className="grid grid-cols-1 gap-1.5">
                                {LLM_MODELS.map((m) => {
                                    const hasKey = s.hasKeyForModel(m.id);
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => s.setLLMModel(m.id)}
                                            disabled={!hasKey}
                                            className={`flex items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${
                                                s.activeLLMModel === m.id
                                                    ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--accent-primary)]"
                                                    : hasKey
                                                        ? "border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                                                        : "border-[var(--border-subtle)] text-[var(--accent-dim)] opacity-40 cursor-not-allowed"
                                            }`}
                                        >
                                            <span>{m.name}</span>
                                            <span className="text-xs text-[var(--accent-dim)]">
                                                {m.provider}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>
                    </>
                ) : (
                    <>
                        {/* ── Custom Providers ──────────────────────────────────── */}
                        <Section title="Custom Providers">
                            <p className="text-xs text-[var(--accent-dim)] mb-3">
                                Add custom LLM providers like Ollama, vLLM, Together, Groq, OpenRouter, or any OpenAI-compatible API.
                            </p>

                            {/* Provider List */}
                            {s.customProviders.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {s.customProviders.map((provider) => {
                                        const isConfigured = isProviderConfigured(provider);
                                        const isSelected = s.activeLLMModel.startsWith(`${provider.id}:`);
                                        
                                        return (
                                            <div
                                                key={provider.id}
                                                className={`p-3 rounded-[var(--radius-sm)] border ${
                                                    isSelected
                                                        ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)]"
                                                        : "border-[var(--border-subtle)]"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`inline-block h-2 w-2 rounded-full ${
                                                                isConfigured
                                                                    ? "bg-[var(--accent-success)]"
                                                                    : "bg-[var(--accent-warning)]"
                                                            }`}
                                                        />
                                                        <span className="font-medium text-sm">
                                                            {provider.name}
                                                        </span>
                                                        <span className="text-xs text-[var(--accent-dim)]">
                                                            ({provider.type})
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleEditProvider(provider)}
                                                            className="px-2 py-1 text-xs text-[var(--accent-muted)] hover:text-[var(--accent-primary)]"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProvider(provider.id)}
                                                            className="px-2 py-1 text-xs text-[var(--accent-muted)] hover:text-[var(--accent-error)]"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-[var(--accent-dim)] mt-1">
                                                    {provider.endpoint.baseUrl}
                                                    {provider.models.length > 0 && (
                                                        <span className="ml-2">
                                                            • {provider.models.length} model(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                onClick={handleAddProvider}
                                className="w-full py-2 text-sm border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-[var(--accent-muted)] hover:border-[var(--border-focus)] hover:text-[var(--accent-primary)] transition-colors"
                            >
                                + Add Custom Provider
                            </button>
                        </Section>

                        {/* ── Custom Models Selection ───────────────────────────── */}
                        {s.customProviders.some(p => isProviderConfigured(p)) && (
                            <Section title="Custom Models">
                                <div className="grid grid-cols-1 gap-1.5">
                                    {s.customProviders
                                        .filter(p => isProviderConfigured(p))
                                        .flatMap((provider) =>
                                            provider.models.map((model) => {
                                                const modelId = `${provider.id}:${model.id}` as LLMModel;
                                                const isSelected = s.activeLLMModel === modelId;
                                                
                                                return (
                                                    <button
                                                        key={modelId}
                                                        onClick={() => s.setLLMModel(modelId)}
                                                        className={`flex items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${
                                                            isSelected
                                                                ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--accent-primary)]"
                                                                : "border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                                                        }`}
                                                    >
                                                        <span>{model.name}</span>
                                                        <span className="text-xs text-[var(--accent-dim)]">
                                                            {provider.name}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                </div>
                            </Section>
                        )}
                    </>
                )}

                {/* ── Provider Form Modal ─────────────────────────────────── */}
                {showProviderForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProviderForm(false)} />
                        <div
                            className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-5 my-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-md font-semibold">
                                    {editingProvider ? "Edit Provider" : "Add Custom Provider"}
                                </h3>
                                <button
                                    onClick={() => setShowProviderForm(false)}
                                    className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--accent-muted)] hover:text-[var(--accent-primary)]"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Template Selection */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-[var(--accent-muted)] mb-2">
                                    Template
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PROVIDER_TEMPLATES.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleTemplateSelect(template.id)}
                                            className={`p-2 text-xs rounded-[var(--radius-sm)] border transition-colors ${
                                                providerForm.type === template.id
                                                    ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--accent-primary)]"
                                                    : "border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                                            }`}
                                        >
                                            {template.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Basic Info */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                                        Provider Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={providerForm.name || ""}
                                        onChange={(e) =>
                                            setProviderForm((prev) => ({ ...prev, name: e.target.value }))
                                        }
                                        placeholder="e.g., Ollama Local"
                                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                                        Base URL *
                                    </label>
                                    <input
                                        type="text"
                                        value={providerForm.endpoint?.baseUrl || ""}
                                        onChange={(e) =>
                                            setProviderForm((prev) => ({
                                                ...prev,
                                                endpoint: {
                                                    baseUrl: e.target.value,
                                                    path: prev.endpoint?.path || "/v1/chat/completions",
                                                },
                                            }))
                                        }
                                        placeholder="e.g., http://localhost:11434"
                                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                                        API Path
                                    </label>
                                    <input
                                        type="text"
                                        value={providerForm.endpoint?.path || ""}
                                        onChange={(e) =>
                                            setProviderForm((prev) => ({
                                                ...prev,
                                                endpoint: {
                                                    baseUrl: prev.endpoint?.baseUrl || "",
                                                    path: e.target.value,
                                                },
                                            }))
                                        }
                                        placeholder="e.g., /v1/chat/completions"
                                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                    />
                                </div>

                                {/* Authentication Type */}
                                <div>
                                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                                        Authentication
                                    </label>
                                    <select
                                        value={providerForm.auth?.type || "bearer"}
                                        onChange={(e) => {
                                            const authType = e.target.value as "none" | "bearer" | "x-api-key" | "query-param";
                                            const currentKeyValue = providerForm.auth?.keyValue;
                                            let newAuth: typeof providerForm.auth;
                                            
                                            if (authType === "none") {
                                                newAuth = { type: "none", keyName: "", keyPrefix: "" };
                                            } else if (authType === "bearer") {
                                                newAuth = { type: "bearer", keyName: "Authorization", keyPrefix: "Bearer ", keyValue: currentKeyValue };
                                            } else if (authType === "x-api-key") {
                                                newAuth = { type: "x-api-key", keyName: "x-api-key", keyPrefix: "", keyValue: currentKeyValue };
                                            } else {
                                                newAuth = { type: "query-param", keyName: "api_key", keyPrefix: "", keyValue: currentKeyValue };
                                            }
                                            
                                            setProviderForm((prev) => ({ ...prev, auth: newAuth }));
                                        }}
                                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--accent-primary)] focus:border-[var(--border-focus)] focus:outline-none"
                                    >
                                        <option value="none">No Auth (e.g., Ollama)</option>
                                        <option value="bearer">Bearer Token (Standard)</option>
                                        <option value="x-api-key">X-API-Key Header</option>
                                        <option value="query-param">Query Parameter</option>
                                    </select>
                                    <p className="mt-1 text-xs text-[var(--accent-dim)]">
                                        {providerForm.auth?.type === "none" 
                                            ? "No API key required for this provider"
                                            : providerForm.auth?.type === "bearer"
                                            ? "Sends: Authorization: Bearer YOUR_KEY"
                                            : providerForm.auth?.type === "x-api-key"
                                            ? "Sends: x-api-key: YOUR_KEY"
                                            : "Appends: ?api_key=YOUR_KEY to URL"
                                        }
                                    </p>
                                </div>

                                {/* API Key (if needed) */}
                                {providerForm.auth?.type !== "none" && (
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                                            API Key
                                        </label>
                                        <input
                                            type={showKeys ? "text" : "password"}
                                            value={providerForm.auth?.keyValue || ""}
                                            onChange={(e) =>
                                                setProviderForm((prev) => ({
                                                    ...prev,
                                                    auth: {
                                                        type: prev.auth?.type || "bearer",
                                                        keyName: prev.auth?.keyName || "Authorization",
                                                        keyPrefix: prev.auth?.keyPrefix || "Bearer ",
                                                        keyValue: e.target.value,
                                                    },
                                                }))
                                            }
                                            placeholder="Enter API key"
                                            className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Models Section */}
                            <div className="mt-5">
                                <label className="block text-xs font-medium text-[var(--accent-muted)] mb-2">
                                    Models
                                </label>
                                
                                {/* Existing models */}
                                {providerForm.models && providerForm.models.length > 0 && (
                                    <div className="space-y-1 mb-3">
                                        {providerForm.models.map((model) => (
                                            <div
                                                key={model.id}
                                                className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]"
                                            >
                                                <div>
                                                    <span className="text-sm">{model.name}</span>
                                                    <span className="text-xs text-[var(--accent-dim)] ml-2">
                                                        ({model.apiModel})
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveModel(model.id)}
                                                    className="text-xs text-[var(--accent-error)] hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add model form */}
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={newModel.id || ""}
                                        onChange={(e) =>
                                            setNewModel((prev) => ({ ...prev, id: e.target.value }))
                                        }
                                        placeholder="Model ID (e.g., llama3)"
                                        className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={newModel.name || ""}
                                        onChange={(e) =>
                                            setNewModel((prev) => ({ ...prev, name: e.target.value }))
                                        }
                                        placeholder="Display Name"
                                        className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={newModel.apiModel || ""}
                                        onChange={(e) =>
                                            setNewModel((prev) => ({ ...prev, apiModel: e.target.value }))
                                        }
                                        placeholder="API Model ID"
                                        className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                                    />
                                    <button
                                        onClick={handleAddModel}
                                        className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-[var(--accent-muted)] hover:border-[var(--border-focus)] hover:text-[var(--accent-primary)] transition-colors"
                                    >
                                        + Add Model
                                    </button>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setShowProviderForm(false);
                                        setProviderForm({});
                                    }}
                                    className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-4 py-1.5 text-sm text-[var(--accent-muted)] hover:bg-[var(--bg-elevated)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveProvider}
                                    className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] hover:bg-[var(--accent-muted)]"
                                >
                                    {editingProvider ? "Update" : "Add Provider"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Actions ──────────────────────────────────────────── */}
                <div className="mt-6 flex items-center justify-between">
                    <button
                        onClick={handleClear}
                        className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--accent-error)] transition-colors hover:bg-[var(--accent-error)]/10"
                    >
                        Clear All Keys
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-4 py-1.5 text-sm text-[var(--accent-muted)] transition-colors hover:bg-[var(--bg-elevated)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] transition-colors hover:bg-[var(--accent-muted)]"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Helper components ───────────────────────────────────────────────────────

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-[var(--accent-muted)] uppercase tracking-wider">
                {title}
            </h3>
            {children}
        </div>
    );
}

function KeyInput({
    label,
    value,
    onChange,
    placeholder,
    show,
    configured,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    show: boolean;
    configured: boolean;
}) {
    return (
        <div className="mb-3">
            <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--accent-muted)]">
                    {label}
                </label>
                <span
                    className={`inline-block h-2 w-2 rounded-full ${
                        configured
                            ? "bg-[var(--accent-success)]"
                            : "bg-[var(--accent-dim)]"
                    }`}
                />
            </div>
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 font-mono text-sm text-[var(--accent-primary)] placeholder-[var(--accent-dim)] transition-colors focus:border-[var(--border-focus)] focus:outline-none"
            />
        </div>
    );
}
