"use client";

import { useRef, useState } from "react";
import { useProjectStore } from "@/store/project-store";
import {
    CodebaseContext,
    CONTEXT_CONSTRAINTS,
    createSnippetContext,
    createContextFromFile,
    validateContextSize,
    isTextFile,
    getActiveContextsSize,
    estimateContextTokens,
} from "@/types/codebase-context";

interface ContextPanelProps {
    conversationId: string;
    contexts: CodebaseContext[];
}

export default function ContextPanel({ conversationId, contexts }: ContextPanelProps) {
    const { addContext, removeContext, updateContext } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showSnippetForm, setShowSnippetForm] = useState(false);
    const [snippetName, setSnippetName] = useState("");
    const [snippetContent, setSnippetContent] = useState("");
    const [snippetLanguage, setSnippetLanguage] = useState("typescript");
    const [error, setError] = useState<string | null>(null);

    const activeContexts = contexts.filter((c) => c.metadata.isActive);
    const totalSize = getActiveContextsSize(contexts);
    const estimatedTokens = estimateContextTokens(contexts);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        setError(null);

        for (const file of Array.from(files)) {
            // Check if it's a text file
            if (!isTextFile(file.name)) {
                setError(`${file.name} is not a supported text file`);
                continue;
            }

            // Read file content
            try {
                const content = await file.text();

                // Validate size
                const validation = validateContextSize(content, contexts);
                if (!validation.valid) {
                    setError(validation.reason || "File too large");
                    continue;
                }

                // Create context
                const context = createContextFromFile(file.name, content);
                addContext(conversationId, context);
            } catch (err) {
                setError(`Failed to read ${file.name}`);
            }
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleAddSnippet = () => {
        if (!snippetName.trim() || !snippetContent.trim()) {
            setError("Please provide a name and content for the snippet");
            return;
        }

        const validation = validateContextSize(snippetContent, contexts);
        if (!validation.valid) {
            setError(validation.reason || "Snippet too large");
            return;
        }

        const context = createSnippetContext(snippetName, snippetContent, snippetLanguage);
        addContext(conversationId, context);

        // Reset form
        setSnippetName("");
        setSnippetContent("");
        setShowSnippetForm(false);
        setError(null);
    };

    const handleRemoveContext = (contextId: string) => {
        removeContext(conversationId, contextId);
    };

    const handleToggleContext = (contextId: string, isActive: boolean) => {
        updateContext(conversationId, contextId, {
            metadata: { isActive },
        } as Partial<CodebaseContext>);
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    return (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-4 py-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-[var(--accent-dim)]">
                    <span>📎</span>
                    <span>Context</span>
                    {activeContexts.length > 0 && (
                        <span className="text-[var(--accent-muted)]">
                            ({activeContexts.length} file{activeContexts.length !== 1 ? "s" : ""} •{" "}
                            {formatSize(totalSize)} • ~{estimatedTokens.toLocaleString()} tokens)
                        </span>
                    )}
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setShowSnippetForm(!showSnippetForm)}
                        className="px-2 py-1 text-xs text-[var(--accent-dim)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                        + Snippet
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-1 text-xs text-[var(--accent-dim)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                        + File
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".ts,.tsx,.js,.jsx,.py,.json,.yaml,.yml,.md,.txt,.css,.html,.sql,.sh"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="mb-2 rounded-[var(--radius-sm)] bg-[var(--accent-error)]/10 px-2 py-1 text-xs text-[var(--accent-error)]">
                    {error}
                </div>
            )}

            {/* Snippet form */}
            {showSnippetForm && (
                <div className="mb-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={snippetName}
                            onChange={(e) => setSnippetName(e.target.value)}
                            placeholder="Snippet name"
                            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none"
                        />
                        <select
                            value={snippetLanguage}
                            onChange={(e) => setSnippetLanguage(e.target.value)}
                            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--accent-primary)] focus:border-[var(--border-focus)] focus:outline-none"
                        >
                            <option value="typescript">TypeScript</option>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="json">JSON</option>
                            <option value="yaml">YAML</option>
                            <option value="markdown">Markdown</option>
                            <option value="css">CSS</option>
                            <option value="html">HTML</option>
                            <option value="sql">SQL</option>
                            <option value="bash">Bash</option>
                        </select>
                    </div>
                    <textarea
                        value={snippetContent}
                        onChange={(e) => setSnippetContent(e.target.value)}
                        placeholder="Paste your code here..."
                        rows={4}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs font-mono text-[var(--accent-primary)] placeholder-[var(--accent-dim)] focus:border-[var(--border-focus)] focus:outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            onClick={() => setShowSnippetForm(false)}
                            className="px-3 py-1 text-xs text-[var(--accent-muted)] hover:text-[var(--accent-primary)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddSnippet}
                            className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-3 py-1 text-xs text-[var(--bg-base)] hover:bg-[var(--accent-muted)]"
                        >
                            Add Snippet
                        </button>
                    </div>
                </div>
            )}

            {/* Context list */}
            {contexts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {contexts.map((context) => (
                        <div
                            key={context.id}
                            className={`group flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-xs transition-colors ${
                                context.metadata.isActive
                                    ? "border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 text-[var(--accent-primary)]"
                                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-dim)]"
                            }`}
                        >
                            <button
                                onClick={() =>
                                    handleToggleContext(context.id, !context.metadata.isActive)
                                }
                                className="flex items-center gap-1.5"
                            >
                                <span>
                                    {context.type === "snippet"
                                        ? "📝"
                                        : context.type === "manifest"
                                            ? "📋"
                                            : "📄"}
                                </span>
                                <span className="max-w-[120px] truncate">{context.name}</span>
                                <span className="text-[var(--accent-dim)]">
                                    {formatSize(context.metadata.size)}
                                </span>
                            </button>
                            <button
                                onClick={() => handleRemoveContext(context.id)}
                                className="ml-1 opacity-0 group-hover:opacity-100 text-[var(--accent-error)] hover:text-[var(--accent-error)] transition-opacity"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Size warning */}
            {totalSize > CONTEXT_CONSTRAINTS.MAX_TOTAL_CONTEXT * 0.8 && (
                <div className="mt-2 text-xs text-[var(--accent-warning)]">
                    ⚠️ Context size is near the limit ({Math.round((totalSize / CONTEXT_CONSTRAINTS.MAX_TOTAL_CONTEXT) * 100)}%)
                </div>
            )}
        </div>
    );
}
