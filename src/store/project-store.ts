import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { v4 as uuid } from "uuid";
import {
    Project,
    Conversation,
    Message,
    ConversationPhase,
    CodebaseContext,
} from "@/types";

const DB_PROJECTS_KEY = "vibe-architect-projects";
const DB_CONVERSATIONS_KEY = "vibe-architect-conversations";
const DB_ACTIVE_KEY = "vibe-architect-active";

interface ActiveState {
    activeProjectId: string | null;
    activeConversationId: string | null;
}

interface ProjectState {
    projects: Project[];
    conversations: Conversation[];
    activeProjectId: string | null;
    activeConversationId: string | null;
    isStreaming: boolean;
    sidebarOpen: boolean;

    // Init
    loadFromDB: () => Promise<void>;

    // Projects
    createProject: (name: string, description?: string) => Promise<Project>;
    deleteProject: (id: string) => Promise<void>;
    renameProject: (id: string, name: string) => Promise<void>;
    setActiveProject: (id: string | null) => void;

    // Conversations
    createConversation: (
        projectId: string,
        title?: string
    ) => Promise<Conversation>;
    deleteConversation: (id: string) => Promise<void>;
    renameConversation: (id: string, title: string) => Promise<void>;
    switchConversation: (id: string | null) => void;

    // Messages
    addMessage: (
        conversationId: string,
        role: Message["role"],
        content: string
    ) => Promise<void>;
    appendToLastAssistant: (
        conversationId: string,
        chunk: string
    ) => void;

    // Conversation state
    setPhase: (conversationId: string, phase: ConversationPhase) => Promise<void>;
    setSpecDoc: (conversationId: string, phase: ConversationPhase, content: string) => Promise<void>;
    setSandboxCode: (
        conversationId: string,
        code: string | null
    ) => Promise<void>;
    setStreaming: (isStreaming: boolean) => void;
    setSidebarOpen: (open: boolean) => void;

    // Helpers
    getActiveConversation: () => Conversation | undefined;
    getProjectConversations: (projectId: string) => Conversation[];
    persistAll: () => Promise<void>;

    // Context management
    addContext: (conversationId: string, context: CodebaseContext) => Promise<void>;
    removeContext: (conversationId: string, contextId: string) => Promise<void>;
    updateContext: (conversationId: string, contextId: string, updates: Partial<CodebaseContext>) => Promise<void>;
    clearContexts: (conversationId: string) => Promise<void>;
}

// Debounced persist for streaming (avoids hammering IndexedDB)
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedPersist(fn: () => Promise<void>, delay = 2000) {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        fn();
        persistTimer = null;
    }, delay);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    conversations: [],
    activeProjectId: null,
    activeConversationId: null,
    isStreaming: false,
    sidebarOpen: false,

    loadFromDB: async () => {
        try {
            const [projects, conversations, active] = await Promise.all([
                idbGet<Project[]>(DB_PROJECTS_KEY),
                idbGet<Conversation[]>(DB_CONVERSATIONS_KEY),
                idbGet<ActiveState>(DB_ACTIVE_KEY),
            ]);

            const loadedProjects = projects || [];
            const loadedConvos = conversations || [];

            // Restore active IDs only if they still exist
            let activeProjectId: string | null = null;
            let activeConversationId: string | null = null;

            if (active) {
                if (active.activeProjectId && loadedProjects.some(p => p.id === active.activeProjectId)) {
                    activeProjectId = active.activeProjectId;
                }
                if (active.activeConversationId && loadedConvos.some(c => c.id === active.activeConversationId)) {
                    activeConversationId = active.activeConversationId;
                }
            }

            set({
                projects: loadedProjects,
                conversations: loadedConvos,
                activeProjectId,
                activeConversationId,
                sidebarOpen: false,
            });
        } catch {
            // fresh start
        }
    },

    createProject: async (name, description = "") => {
        const project: Project = {
            id: uuid(),
            name,
            description,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const projects = [...get().projects, project];
        set({ projects, activeProjectId: project.id });
        await idbSet(DB_PROJECTS_KEY, projects);
        await persistActive(get());
        return project;
    },

    deleteProject: async (id) => {
        const projects = get().projects.filter((p) => p.id !== id);
        const conversations = get().conversations.filter(
            (c) => c.projectId !== id
        );
        const update: Partial<ProjectState> = { projects, conversations };
        if (get().activeProjectId === id) {
            update.activeProjectId = null;
            update.activeConversationId = null;
        }
        set(update);
        await Promise.all([
            idbSet(DB_PROJECTS_KEY, projects),
            idbSet(DB_CONVERSATIONS_KEY, conversations),
        ]);
        await persistActive(get());
    },

    renameProject: async (id, name) => {
        const projects = get().projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
        );
        set({ projects });
        await idbSet(DB_PROJECTS_KEY, projects);
    },

    setActiveProject: (id) => {
        set({ activeProjectId: id, activeConversationId: null });
        persistActive(get());
    },

    createConversation: async (projectId, title) => {
        // Generate a default numbered name if no title provided
        if (!title) {
            const existingCount = get().conversations.filter(
                (c) => c.projectId === projectId
            ).length;
            title = `Conversation #${existingCount + 1}`;
        }
        const conversation: Conversation = {
            id: uuid(),
            projectId,
            title,
            phase: "vision",
            messages: [],
            sandboxCode: null,
            specDocs: {},
            codebaseContexts: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const conversations = [...get().conversations, conversation];
        const projects = get().projects.map((p) =>
            p.id === projectId ? { ...p, updatedAt: Date.now() } : p
        );
        set({
            conversations,
            projects,
            activeConversationId: conversation.id,
            activeProjectId: projectId,
        });
        await Promise.all([
            idbSet(DB_CONVERSATIONS_KEY, conversations),
            idbSet(DB_PROJECTS_KEY, projects),
        ]);
        await persistActive(get());
        return conversation;
    },

    deleteConversation: async (id) => {
        const conversations = get().conversations.filter((c) => c.id !== id);
        const update: Partial<ProjectState> = { conversations };
        if (get().activeConversationId === id) {
            update.activeConversationId = null;
        }
        set(update);
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
        await persistActive(get());
    },

    renameConversation: async (id, title) => {
        const conversations = get().conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    switchConversation: (id) => {
        if (id) {
            const conv = get().conversations.find((c) => c.id === id);
            if (conv) {
                set({
                    activeConversationId: id,
                    activeProjectId: conv.projectId,
                });
                persistActive(get());
            }
        } else {
            set({ activeConversationId: null });
            persistActive(get());
        }
    },

    addMessage: async (conversationId, role, content) => {
        const msg: Message = {
            id: uuid(),
            role,
            content,
            timestamp: Date.now(),
        };
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    appendToLastAssistant: (conversationId, chunk) => {
        const conversations = get().conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const messages = [...c.messages];
            const last = messages[messages.length - 1];
            if (last && last.role === "assistant") {
                messages[messages.length - 1] = {
                    ...last,
                    content: last.content + chunk,
                };
            }
            return { ...c, messages };
        });
        set({ conversations });
        // Debounced persist during streaming to avoid hammering IndexedDB
        debouncedPersist(() => idbSet(DB_CONVERSATIONS_KEY, get().conversations));
    },

    setPhase: async (conversationId, phase) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? { ...c, phase, updatedAt: Date.now() }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    setSpecDoc: async (conversationId, phase, content) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? {
                    ...c,
                    specDocs: { ...c.specDocs, [phase]: content },
                    updatedAt: Date.now(),
                }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    setSandboxCode: async (conversationId, code) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? { ...c, sandboxCode: code, updatedAt: Date.now() }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    setStreaming: (isStreaming) => set({ isStreaming }),

    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId);
    },

    getProjectConversations: (projectId) => {
        return get().conversations.filter((c) => c.projectId === projectId);
    },

    persistAll: async () => {
        const { projects, conversations } = get();
        await Promise.all([
            idbSet(DB_PROJECTS_KEY, projects),
            idbSet(DB_CONVERSATIONS_KEY, conversations),
        ]);
        await persistActive(get());
    },

    // Context management
    addContext: async (conversationId, context) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? {
                    ...c,
                    codebaseContexts: [...c.codebaseContexts, context],
                    updatedAt: Date.now(),
                }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    removeContext: async (conversationId, contextId) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? {
                    ...c,
                    codebaseContexts: c.codebaseContexts.filter(
                        (ctx) => ctx.id !== contextId
                    ),
                    updatedAt: Date.now(),
                }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    updateContext: async (conversationId, contextId, updates) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? {
                    ...c,
                    codebaseContexts: c.codebaseContexts.map((ctx) =>
                        ctx.id === contextId ? { ...ctx, ...updates } : ctx
                    ),
                    updatedAt: Date.now(),
                }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },

    clearContexts: async (conversationId) => {
        const conversations = get().conversations.map((c) =>
            c.id === conversationId
                ? {
                    ...c,
                    codebaseContexts: [],
                    updatedAt: Date.now(),
                }
                : c
        );
        set({ conversations });
        await idbSet(DB_CONVERSATIONS_KEY, conversations);
    },
}));

async function persistActive(state: { activeProjectId: string | null; activeConversationId: string | null }) {
    await idbSet(DB_ACTIVE_KEY, {
        activeProjectId: state.activeProjectId,
        activeConversationId: state.activeConversationId,
    });
}
