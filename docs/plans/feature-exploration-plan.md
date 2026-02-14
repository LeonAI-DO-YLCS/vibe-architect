# Vibe Architect - Feature Exploration Plan

## Current Architecture Analysis

### Project Overview

Vibe Architect is a Next.js 16 application that generates implementation specs through AI-guided conversation. It follows a phased workflow: Vision → Design → Stack → Export.

### Key Findings

#### 1. LLM Provider System ([`src/lib/llm-client.ts`](src/lib/llm-client.ts))

- **4 hardcoded providers**: OpenAI, Google Gemini, Anthropic, Mistral
- **Hardcoded endpoints**:
  - OpenAI: `https://api.openai.com/v1/chat/completions`
  - Gemini: `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent`
  - Anthropic: `https://api.anthropic.com/v1/messages`
  - Mistral: `https://api.mistral.ai/v1/chat/completions`
- Each provider has its own message format and streaming protocol

#### 2. Settings Store ([`src/store/settings-store.ts`](src/store/settings-store.ts))

- API keys stored in localStorage (`vibe-architect-settings`)
- Only stores keys for the 4 predefined providers
- No support for custom endpoints or providers

#### 3. Types System ([`src/types/index.ts`](src/types/index.ts))

- `LLMProvider` type is a union of 4 fixed providers
- `LLMModel` type is a union of specific model IDs
- Model configs include `apiModel` for actual API model names

---

## Feature 1: Codebase Integration

### Clarification Needed

What does "work with current codebases" mean in your context?

**Option A: Code Context Injection**

- Users paste/upload code snippets to include in AI context
- AI analyzes existing code when generating specs
- Useful for extending/modifying existing projects

**Option B: Repository Integration**

- Connect to GitHub/GitLab to read repository contents
- Requires OAuth authentication
- More complex but powerful

**Option C: File/Folder Upload**

- Drag-and-drop files or folders
- Parse project structure automatically
- Include in AI context for spec generation

**Option D: Project Import**

- Import existing project configuration (package.json, etc.)
- Auto-detect tech stack and structure
- Generate specs that extend current implementation

---

## Feature 2: Custom API Endpoint

### Clarification Needed

What type of custom endpoint support do you need?

**Option A: OpenAI-Compatible Endpoints**

- Support any endpoint following OpenAI chat completion format
- Examples: Ollama, vLLM, LM Studio, local models
- Single URL + API key configuration
- Easiest to implement

**Option B: Generic Custom Provider**

- Fully configurable: URL, headers, body format
- Support for different authentication methods
- More flexible but complex UI

**Option C: Multiple Custom Providers**

- Add unlimited custom API configurations
- Each with its own name, URL, and auth
- Useful for switching between different local/cloud models

**Option D: Provider Templates**

- Predefined templates for popular alternatives (Ollama, Together, Groq, etc.)
- User just enters URL and optional key
- Balance of flexibility and simplicity

---

## Questions for User

1. **Codebase Integration**: Which option (A, B, C, D) best matches your use case?
2. **Custom API**: Which option (A, B, C, D) do you need?
3. **Primary Use Case**: Are you looking to:
   - Use local models (Ollama, LM Studio)?
   - Use alternative cloud providers (Together, Groq, DeepSeek)?
   - Connect to self-hosted models?
4. **Priority**: Which feature is more important to implement first?

---

## Next Steps

Once requirements are clarified:

1. Design data model changes (types, stores)
2. Design UI/UX for settings modal
3. Design LLM client modifications
4. Create implementation plan
