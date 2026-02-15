import { create } from "zustand";
import { LLMModel, CustomProvider, isBuiltInProvider, isBuiltInModel, getModelConfig } from "@/types";

type KeyProvider = "openai" | "gemini" | "anthropic" | "mistral";

interface SettingsState {
    // API Keys (built-in providers)
    openaiKey: string;
    geminiKey: string;
    anthropicKey: string;
    mistralKey: string;

    // Custom providers
    customProviders: CustomProvider[];

    // Model selection
    activeLLMModel: LLMModel;

    // Derived
    isConfigured: boolean;

    // Actions
    setKey: (provider: KeyProvider, value: string) => void;
    setLLMModel: (model: LLMModel) => void;
    clearKeys: () => void;
    loadFromStorage: () => void;

    // Custom provider actions
    addCustomProvider: (provider: CustomProvider) => void;
    updateCustomProvider: (id: string, updates: Partial<CustomProvider>) => void;
    removeCustomProvider: (id: string) => void;
    getCustomProvider: (id: string) => CustomProvider | undefined;
    getCustomProviderKey: (id: string) => string;

    // Helpers
    getKeyForProvider: (provider: "openai" | "gemini" | "anthropic" | "mistral") => string;
    hasKeyForModel: (model: LLMModel) => boolean;
}

const STORAGE_KEY = "vibe-architect-settings";

function computeIsConfigured(state: {
    openaiKey: string;
    geminiKey: string;
    anthropicKey: string;
    mistralKey: string;
    customProviders: CustomProvider[];
}): boolean {
    // Check built-in providers
    const hasBuiltInKey =
        state.openaiKey.length > 0 ||
        state.geminiKey.length > 0 ||
        state.anthropicKey.length > 0 ||
        state.mistralKey.length > 0;
    
    // Check custom providers (at least one configured)
    const hasConfiguredCustomProvider = state.customProviders.some(
        (p) => p.auth.type === "none" || (p.auth.keyValue && p.auth.keyValue.length > 0)
    );
    
    return hasBuiltInKey || hasConfiguredCustomProvider;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    openaiKey: "",
    geminiKey: "",
    anthropicKey: "",
    mistralKey: "",
    customProviders: [],
    activeLLMModel: "gpt-5.2-high",
    isConfigured: false,

    setKey: (provider, value) => {
        const keyMap: Record<KeyProvider, string> = {
            openai: "openaiKey",
            gemini: "geminiKey",
            anthropic: "anthropicKey",
            mistral: "mistralKey",
        };
        const update = { [keyMap[provider]]: value };
        const newState = { ...get(), ...update } as SettingsState;
        set({
            ...update,
            isConfigured: computeIsConfigured(newState),
        });
        persistSettings(get());
    },

    setLLMModel: (model) => {
        set({ activeLLMModel: model });
        persistSettings(get());
    },

    clearKeys: () => {
        set({
            openaiKey: "",
            geminiKey: "",
            anthropicKey: "",
            mistralKey: "",
            customProviders: [],
            isConfigured: false,
        });
        localStorage.removeItem(STORAGE_KEY);
    },

    loadFromStorage: () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const p = JSON.parse(stored);
                const state = {
                    openaiKey: p.openaiKey || "",
                    geminiKey: p.geminiKey || "",
                    anthropicKey: p.anthropicKey || "",
                    mistralKey: p.mistralKey || "",
                    customProviders: (p.customProviders as CustomProvider[]) || [],
                    activeLLMModel: p.activeLLMModel || "gpt-5.2-high",
                };
                set({
                    ...state,
                    isConfigured: computeIsConfigured(state),
                });
            }
        } catch {
            // ignore corrupted storage
        }
    },

    getKeyForProvider: (provider) => {
        const s = get();
        return provider === "openai"
            ? s.openaiKey
            : provider === "gemini"
                ? s.geminiKey
                : provider === "anthropic"
                    ? s.anthropicKey
                    : s.mistralKey;
    },

    hasKeyForModel: (model) => {
        const s = get();
        
        // Check if it's a built-in model
        if (isBuiltInModel(model)) {
            const config = getModelConfig(model);
            if (config) {
                const key = s.getKeyForProvider(config.provider as KeyProvider);
                return key.length > 0;
            }
        }
        
        // For custom models, find the provider and check if configured
        for (const provider of s.customProviders) {
            const modelConfig = provider.models.find(m => m.id === model);
            if (modelConfig) {
                // Check if provider has API key or doesn't need one
                return provider.auth.type === "none" || 
                       (provider.auth.keyValue !== undefined && provider.auth.keyValue.length > 0);
            }
        }
        
        return false;
    },

    // Custom provider actions
    addCustomProvider: (provider) => {
        const newProviders = [...get().customProviders, provider];
        const newState = { ...get(), customProviders: newProviders } as SettingsState;
        set({
            customProviders: newProviders,
            isConfigured: computeIsConfigured(newState),
        });
        persistSettings(get());
    },

    updateCustomProvider: (id, updates) => {
        const newProviders = get().customProviders.map(p =>
            p.id === id ? { ...p, ...updates } : p
        );
        set({ customProviders: newProviders });
        persistSettings(get());
    },

    removeCustomProvider: (id) => {
        const newProviders = get().customProviders.filter(p => p.id !== id);
        const newState = { ...get(), customProviders: newProviders } as SettingsState;
        set({
            customProviders: newProviders,
            isConfigured: computeIsConfigured(newState),
        });
        persistSettings(get());
    },

    getCustomProvider: (id) => {
        return get().customProviders.find(p => p.id === id);
    },

    getCustomProviderKey: (id) => {
        const provider = get().customProviders.find(p => p.id === id);
        return provider?.auth.keyValue || "";
    },
}));

function persistSettings(state: SettingsState) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                openaiKey: state.openaiKey,
                geminiKey: state.geminiKey,
                anthropicKey: state.anthropicKey,
                mistralKey: state.mistralKey,
                customProviders: state.customProviders,
                activeLLMModel: state.activeLLMModel,
            })
        );
    } catch {
        // storage full or unavailable
    }
}
