"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/settings-store";
import { LLM_MODELS, LLMModel, isBuiltInModel } from "@/types";
import {
    CustomProvider,
    CustomModel,
    ProviderType,
    PROVIDER_TEMPLATES,
    isProviderConfigured,
    AuthType,
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
    
    // Custom provider UI state
    const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [isAddingNewProvider, setIsAddingNewProvider] = useState(false);
    const [providerForm, setProviderForm] = useState<Partial<CustomProvider>>({});
    const [newModel, setNewModel] = useState<Partial<CustomModel>>({});
    const [isAddingModel, setIsAddingModel] = useState(false);

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
    const handleStartAddProvider = () => {
        setIsAddingNewProvider(true);
        setEditingProviderId(null);
        setExpandedProviderId(null);
        setProviderForm({
            type: "openai-compatible",
            enabled: true,
            models: [],
            auth: { type: "none", keyName: "", keyPrefix: "" },
            endpoint: { baseUrl: "", path: "/v1/chat/completions" },
        });
    };

    const handleStartEditProvider = (provider: CustomProvider) => {
        setEditingProviderId(provider.id);
        setIsAddingNewProvider(false);
        setProviderForm({ ...provider });
    };

    const handleCancelEdit = () => {
        setEditingProviderId(null);
        setIsAddingNewProvider(false);
        setProviderForm({});
        setNewModel({});
        setIsAddingModel(false);
    };

    const handleSaveProvider = (isExisting: boolean, providerId?: string) => {
        if (!providerForm.name || !providerForm.endpoint?.baseUrl) {
            alert("Please fill in required fields: Name and Base URL");
            return;
        }

        const now = Date.now();
        if (isExisting && providerId) {
            s.updateCustomProvider(providerId, {
                ...providerForm,
                updatedAt: now,
            } as Partial<CustomProvider>);
        } else {
            const newProvider: CustomProvider = {
                id: `custom-${now}`,
                name: providerForm.name,
                type: providerForm.type || "openai-compatible",
                enabled: providerForm.enabled ?? true,
                endpoint: providerForm.endpoint || { baseUrl: "", path: "/v1/chat/completions" },
                auth: providerForm.auth || { type: "none", keyName: "", keyPrefix: "" },
                request: providerForm.request || { format: "openai", modelParam: "model" },
                response: providerForm.response || { format: "sse-openai", contentPath: "choices[0].delta.content" },
                models: providerForm.models || [],
                createdAt: now,
                updatedAt: now,
            };
            s.addCustomProvider(newProvider);
            // Auto-expand the new provider
            setExpandedProviderId(newProvider.id);
        }

        handleCancelEdit();
    };

    const handleDeleteProvider = (id: string) => {
        if (confirm("Are you sure you want to delete this provider?")) {
            s.removeCustomProvider(id);
            if (expandedProviderId === id) setExpandedProviderId(null);
            if (editingProviderId === id) setEditingProviderId(null);
        }
    };

    const handleSetActiveProvider = (id: string) => {
        s.setActiveCustomProvider(id);
    };

    const handleAddModel = (providerId: string) => {
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

        if (isAddingNewProvider || editingProviderId) {
            // Adding to form
            setProviderForm(prev => ({
                ...prev,
                models: [...(prev.models || []), model],
            }));
        } else {
            // Adding to existing provider
            const provider = s.customProviders.find(p => p.id === providerId);
            if (provider) {
                s.updateCustomProvider(providerId, {
                    models: [...provider.models, model],
                });
            }
        }
        setNewModel({});
        setIsAddingModel(false);
    };

    const handleRemoveModel = (providerId: string, modelId: string) => {
        if (editingProviderId || isAddingNewProvider) {
            // Removing from form
            setProviderForm(prev => ({
                ...prev,
                models: (prev.models || []).filter(m => m.id !== modelId),
            }));
        } else {
            // Removing from existing provider
            const provider = s.customProviders.find(p => p.id === providerId);
            if (provider) {
                s.updateCustomProvider(providerId, {
                    models: provider.models.filter(m => m.id !== modelId),
                });
            }
        }
    };

    const handleSelectModel = (providerId: string, modelId: string) => {
        const fullModelId = `${providerId}:${modelId}` as LLMModel;
        s.setLLMModel(fullModelId);
        // Also set this provider as active
        if (s.activeCustomProviderId !== providerId) {
            s.setActiveCustomProvider(providerId);
        }
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

    const handleAuthTypeChange = (authType: AuthType) => {
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
        
        setProviderForm(prev => ({ ...prev, auth: newAuth }));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                        ??
                    </button>
                </div>

                {/* Tabs */}
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
                        {/* API Keys */}
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

                        {/* Built-in Models */}
                        <Section title="Chat Model">
                            <div className="grid grid-cols-1 gap-1.5">
                                {LLM_MODELS.map((m) => {
                                    const hasKey = s.hasKeyForModel(m.id);
                                    const isActive = s.activeLLMModel === m.id && !s.activeCustomProviderId;
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                s.setLLMModel(m.id);
                                                s.setActiveCustomProvider(null);
                                            }}
                                            disabled={!hasKey}
                                            className={`flex items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${
                                                isActive
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
                        {/* Custom Providers */}
                        <Section title="Custom Providers">
                            <p className="text-xs text-[var(--accent-dim)] mb-3">
                                Add custom LLM providers like Ollama, vLLM, Together, Groq, OpenRouter, or any OpenAI-compatible API.
                            </p>

                            {/* Provider List */}
                            <div className="space-y-2">
                                {/* New Provider Form */}
                                {isAddingNewProvider && (
                                    <ProviderEditCard
                                        provider={providerForm}
                                        isEditing={true}
                                        isNew={true}
                                        showKeys={showKeys}
                                        onTemplateSelect={handleTemplateSelect}
                                        onAuthTypeChange={handleAuthTypeChange}
                                        onUpdate={(updates) => setProviderForm(prev => ({ ...prev, ...updates }))}
                                        onSave={() => handleSaveProvider(false)}
                                        onCancel={handleCancelEdit}
                                        newModel={newModel}
                                        onNewModelUpdate={(updates) => setNewModel(prev => ({ ...prev, ...updates }))}
                                        onAddModel={() => {
                                            if (newModel.id && newModel.name && newModel.apiModel) {
                                                const model: CustomModel = {
                                                    id: newModel.id,
                                                    name: newModel.name,
                                                    apiModel: newModel.apiModel,
                                                    maxTokens: newModel.maxTokens || 4096,
                                                };
                                                setProviderForm(prev => ({
                                                    ...prev,
                                                    models: [...(prev.models || []), model],
                                                }));
                                                setNewModel({});
                                            }
                                        }}
                                        onRemoveModel={(modelId) => {
                                            setProviderForm(prev => ({
                                                ...prev,
                                                models: (prev.models || []).filter(m => m.id !== modelId),
                                            }));
                                        }}
                                    />
                                )}

                                {/* Existing Providers */}
                                {s.customProviders.map((provider) => {
                                    const isConfigured = isProviderConfigured(provider);
                                    const isActive = s.activeCustomProviderId === provider.id;
                                    const isExpanded = expandedProviderId === provider.id;
                                    const isEditing = editingProviderId === provider.id;

                                    if (isEditing) {
                                        return (
                                            <ProviderEditCard
                                                key={provider.id}
                                                provider={providerForm}
                                                isEditing={true}
                                                isNew={false}
                                                showKeys={showKeys}
                                                onTemplateSelect={handleTemplateSelect}
                                                onAuthTypeChange={handleAuthTypeChange}
                                                onUpdate={(updates) => setProviderForm(prev => ({ ...prev, ...updates }))}
                                                onSave={() => handleSaveProvider(true, provider.id)}
                                                onCancel={handleCancelEdit}
                                                newModel={newModel}
                                                onNewModelUpdate={(updates) => setNewModel(prev => ({ ...prev, ...updates }))}
                                                onAddModel={() => {
                                                    if (newModel.id && newModel.name && newModel.apiModel) {
                                                        const model: CustomModel = {
                                                            id: newModel.id,
                                                            name: newModel.name,
                                                            apiModel: newModel.apiModel,
                                                            maxTokens: newModel.maxTokens || 4096,
                                                        };
                                                        setProviderForm(prev => ({
                                                            ...prev,
                                                            models: [...(prev.models || []), model],
                                                        }));
                                                        setNewModel({});
                                                    }
                                                }}
                                                onRemoveModel={(modelId) => {
                                                    setProviderForm(prev => ({
                                                        ...prev,
                                                        models: (prev.models || []).filter(m => m.id !== modelId),
                                                    }));
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <div
                                            key={provider.id}
                                            className={`rounded-[var(--radius-sm)] border ${
                                                isActive
                                                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                                                    : "border-[var(--border-subtle)]"
                                            }`}
                                        >
                                            {/* Provider Header */}
                                            <div
                                                className="flex items-center justify-between p-3 cursor-pointer"
                                                onClick={() => setExpandedProviderId(isExpanded ? null : provider.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                                                        ?
                                                    </span>
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
                                                    {isActive && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary)] text-[var(--bg-base)]">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {!isActive && isConfigured && (
                                                        <button
                                                            onClick={() => handleSetActiveProvider(provider.id)}
                                                            className="px-2 py-1 text-xs text-[var(--accent-muted)] hover:text-[var(--accent-primary)]"
                                                        >
                                                            Set Active
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleStartEditProvider(provider)}
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

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="px-3 pb-3 border-t border-[var(--border-subtle)]">
                                                    <div className="text-xs text-[var(--accent-dim)] mt-2 mb-3">
                                                        {provider.endpoint.baseUrl}
                                                        <span className="ml-2">
                                                            ? Auth: {provider.auth.type === "none" ? "None" : provider.auth.type}
                                                        </span>
                                                        <span className="ml-2">
                                                            ? {provider.models.length} model(s)
                                                        </span>
                                                    </div>

                                                    {/* Models */}
                                                    <div className="space-y-1">
                                                        {provider.models.map((model) => {
                                                            const modelId = `${provider.id}:${model.id}` as LLMModel;
                                                            const isSelected = s.activeLLMModel === modelId;
                                                            
                                                            return (
                                                                <div
                                                                    key={model.id}
                                                                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="radio"
                                                                            name={`model-${provider.id}`}
                                                                            checked={isSelected}
                                                                            onChange={() => handleSelectModel(provider.id, model.id)}
                                                                            className="h-3 w-3"
                                                                        />
                                                                        <span className="text-sm">{model.name}</span>
                                                                        <span className="text-xs text-[var(--accent-dim)]">
                                                                            ({model.apiModel})
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveModel(provider.id, model.id)}
                                                                        className="text-xs text-[var(--accent-error)] hover:underline"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Add Model */}
                                                        {isAddingModel && expandedProviderId === provider.id ? (
                                                            <div className="grid grid-cols-2 gap-2 p-2 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
                                                                <input
                                                                    type="text"
                                                                    value={newModel.id || ""}
                                                                    onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                                                                    placeholder="Model ID"
                                                                    className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={newModel.name || ""}
                                                                    onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                                                                    placeholder="Display Name"
                                                                    className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={newModel.apiModel || ""}
                                                                    onChange={(e) => setNewModel(prev => ({ ...prev, apiModel: e.target.value }))}
                                                                    placeholder="API Model ID"
                                                                    className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs"
                                                                />
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => handleAddModel(provider.id)}
                                                                        className="flex-1 rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-2 py-1.5 text-xs text-[var(--bg-base)]"
                                                                    >
                                                                        Add
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsAddingModel(false);
                                                                            setNewModel({});
                                                                        }}
                                                                        className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1.5 text-xs"
                                                                    >
                                                                        ?
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setIsAddingModel(true)}
                                                                className="w-full py-1.5 text-xs border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                                                            >
                                                                + Add Model
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Add New Provider Button */}
                                {!isAddingNewProvider && (
                                    <button
                                        onClick={handleStartAddProvider}
                                        className="w-full py-2 text-sm border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-[var(--accent-muted)] hover:border-[var(--border-focus)] hover:text-[var(--accent-primary)] transition-colors"
                                    >
                                        + Add Custom Provider
                                    </button>
                                )}
                            </div>
                        </Section>
                    </>
                )}

                {/* Actions */}
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

// Helper Components

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
                        configured ? "bg-[var(--accent-success)]" : "bg-[var(--accent-dim)]"
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

function ProviderEditCard({
    provider,
    isEditing,
    isNew,
    showKeys,
    onTemplateSelect,
    onAuthTypeChange,
    onUpdate,
    onSave,
    onCancel,
    newModel,
    onNewModelUpdate,
    onAddModel,
    onRemoveModel,
}: {
    provider: Partial<CustomProvider>;
    isEditing: boolean;
    isNew: boolean;
    showKeys: boolean;
    onTemplateSelect: (type: ProviderType) => void;
    onAuthTypeChange: (type: AuthType) => void;
    onUpdate: (updates: Partial<CustomProvider>) => void;
    onSave: () => void;
    onCancel: () => void;
    newModel: Partial<CustomModel>;
    onNewModelUpdate: (updates: Partial<CustomModel>) => void;
    onAddModel: () => void;
    onRemoveModel: (modelId: string) => void;
}) {
    return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--accent-primary)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">
                    {isNew ? "New Provider" : "Edit Provider"}
                </h4>
                <button
                    onClick={onCancel}
                    className="text-xs text-[var(--accent-muted)] hover:text-[var(--accent-primary)]"
                >
                    Cancel
                </button>
            </div>

            {/* Template Selection */}
            <div className="mb-3">
                <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                    Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {PROVIDER_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => onTemplateSelect(template.id)}
                            className={`p-2 text-xs rounded-[var(--radius-sm)] border transition-colors ${
                                provider.type === template.id
                                    ? "border-[var(--accent-primary)] bg-[var(--bg-base)] text-[var(--accent-primary)]"
                                    : "border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                            }`}
                        >
                            {template.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Basic Fields */}
            <div className="space-y-2">
                <div>
                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                        Provider Name *
                    </label>
                    <input
                        type="text"
                        value={provider.name || ""}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        placeholder="e.g., Ollama Local"
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                            Base URL *
                        </label>
                        <input
                            type="text"
                            value={provider.endpoint?.baseUrl || ""}
                            onChange={(e) => onUpdate({
                                endpoint: {
                                    baseUrl: e.target.value,
                                    path: provider.endpoint?.path || "/v1/chat/completions",
                                },
                            })}
                            placeholder="http://localhost:11434"
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                            API Path
                        </label>
                        <input
                            type="text"
                            value={provider.endpoint?.path || ""}
                            onChange={(e) => onUpdate({
                                endpoint: {
                                    baseUrl: provider.endpoint?.baseUrl || "",
                                    path: e.target.value,
                                },
                            })}
                            placeholder="/v1/chat/completions"
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                {/* Auth Type */}
                <div>
                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                        Authentication
                    </label>
                    <select
                        value={provider.auth?.type || "none"}
                        onChange={(e) => onAuthTypeChange(e.target.value as AuthType)}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                    >
                        <option value="none">No Auth (e.g., Ollama)</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="x-api-key">X-API-Key Header</option>
                        <option value="query-param">Query Parameter</option>
                    </select>
                </div>

                {/* API Key (if needed) */}
                {provider.auth?.type !== "none" && (
                    <div>
                        <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                            API Key
                        </label>
                        <input
                            type={showKeys ? "text" : "password"}
                            value={provider.auth?.keyValue || ""}
                            onChange={(e) => onUpdate({
                                auth: {
                                    ...provider.auth,
                                    type: provider.auth?.type || "bearer",
                                    keyValue: e.target.value,
                                } as typeof provider.auth,
                            })}
                            placeholder="Enter API key"
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                        />
                    </div>
                )}

                {/* Models */}
                <div>
                    <label className="block text-xs font-medium text-[var(--accent-muted)] mb-1">
                        Models
                    </label>
                    
                    {provider.models && provider.models.length > 0 && (
                        <div className="space-y-1 mb-2">
                            {provider.models.map((model) => (
                                <div
                                    key={model.id}
                                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--bg-base)]"
                                >
                                    <span className="text-sm">{model.name}</span>
                                    <button
                                        onClick={() => onRemoveModel(model.id)}
                                        className="text-xs text-[var(--accent-error)]"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            value={newModel.id || ""}
                            onChange={(e) => onNewModelUpdate({ id: e.target.value })}
                            placeholder="ID"
                            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs"
                        />
                        <input
                            type="text"
                            value={newModel.name || ""}
                            onChange={(e) => onNewModelUpdate({ name: e.target.value })}
                            placeholder="Name"
                            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs"
                        />
                        <input
                            type="text"
                            value={newModel.apiModel || ""}
                            onChange={(e) => onNewModelUpdate({ apiModel: e.target.value })}
                            placeholder="API Model"
                            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs"
                        />
                    </div>
                    <button
                        onClick={onAddModel}
                        className="mt-2 w-full py-1.5 text-xs border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                    >
                        + Add Model
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div className="mt-4 flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-4 py-1.5 text-sm text-[var(--accent-muted)]"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)]"
                >
                    {isNew ? "Add Provider" : "Update"}
                </button>
            </div>
        </div>
    );
}
