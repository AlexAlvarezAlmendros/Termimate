# Arquitectura Agéntica de Termimate

Descripción técnica completa del sistema de agente IA: cómo fluyen los datos desde que el usuario escribe un mensaje hasta que aparece la respuesta en pantalla.

---

## 1. Visión General de Capas

```mermaid
graph TB
    subgraph Renderer["Renderer Process (React)"]
        UI["ChatPane / UI"]
        Store["agentStore (Zustand)"]
        Hook["useAgent hook"]
    end

    subgraph Preload["Preload Script (contextBridge)"]
        API["window.electronAPI"]
    end

    subgraph Main["Main Process (Node.js)"]
        IPC["IPC Handlers"]
        Executor["AgentExecutor (singleton)"]
        DB["DatabaseManager (SQLite)"]
        Guard["PermissionGuard"]
        PTY["PTYManager"]
    end

    subgraph Providers["LLM Providers"]
        Anthropic["AnthropicProvider"]
        OpenAI["OpenAIProvider"]
        Gemini["GeminiProvider"]
    end

    subgraph Tools["Agent Tools"]
        Bash["BashExecutorTool"]
        FileRead["FileReadTool"]
        FileList["FileListTool"]
        TermRead["TerminalReadTool"]
    end

    UI -->|"sendMessage()"| API
    API -->|"IPC invoke"| IPC
    IPC --> Executor
    Executor --> DB
    Executor --> Guard
    Executor --> Providers
    Executor --> Tools
    Tools --> PTY
    Executor -->|"IPC send (stream events)"| API
    API -->|"onStreamEvent callback"| Hook
    Hook --> Store
    Store --> UI
```

---

## 2. Flujo Completo de un Mensaje

```mermaid
sequenceDiagram
    actor User
    participant ChatPane
    participant useAgent
    participant preload as window.electronAPI
    participant agentHandlers as IPC agentHandlers
    participant AgentExecutor
    participant DB as MessageRepository
    participant Provider as LLM Provider

    User->>ChatPane: Escribe mensaje y pulsa Send
    ChatPane->>useAgent: sendMessage(content, provider, model, agentId, enableThinking)
    useAgent->>DB: addMessage (role: user) via store
    useAgent->>preload: agent.sendMessage(params)
    preload->>agentHandlers: IPC invoke AGENT_SEND_MESSAGE
    agentHandlers->>AgentExecutor: handleMessage(params)

    AgentExecutor->>DB: messageRepo.create (user message)
    AgentExecutor->>AgentExecutor: buildSystemPrompt()
    AgentExecutor->>AgentExecutor: resolveProvider()
    AgentExecutor->>AgentExecutor: runConversationLoop()

    loop Conversation Loop (max 10 rondas)
        AgentExecutor->>DB: messageRepo.findBySession() → historial
        AgentExecutor->>Provider: streamMessage(messages, tools, systemPrompt)

        loop Streaming de eventos
            Provider-->>AgentExecutor: text_delta
            AgentExecutor-->>preload: IPC send AGENT_STREAM_EVENT (text_delta)
            preload-->>useAgent: onStreamEvent callback
            useAgent-->>ChatPane: appendToLastMessage → UI se actualiza en tiempo real

            Provider-->>AgentExecutor: thinking_delta
            AgentExecutor-->>preload: IPC send (thinking_delta)
            preload-->>useAgent: onStreamEvent callback
            useAgent-->>ChatPane: appendThinking → bloque de razonamiento

            Provider-->>AgentExecutor: tool_use_start
            AgentExecutor-->>preload: IPC send (tool_use_start)
            preload-->>useAgent: onStreamEvent callback
            useAgent-->>ChatPane: addToolCall (spinner en UI)
        end

        alt Sin tool calls → respuesta final
            AgentExecutor->>DB: messageRepo.create (assistant response)
            AgentExecutor-->>preload: message_stop + usage
            preload-->>useAgent: setStreaming(false) + updateTokenUsage
        else Con tool calls → ejecutar herramientas
            AgentExecutor->>AgentExecutor: ejecutar cada tool
            AgentExecutor-->>preload: tool_use_end (resultado)
            preload-->>useAgent: resolveToolCall en store
            AgentExecutor->>DB: guardar resultado como mensaje user
            Note over AgentExecutor: Siguiente ronda del loop
        end
    end
```

---

## 3. Pipeline de Streaming por Proveedor

Los tres proveedores exponen la misma interfaz `AsyncIterable<StreamEvent>` pero con implementaciones distintas:

```mermaid
flowchart LR
    subgraph Anthropic
        direction TB
        A1["client.messages.stream()"]
        A2["content_block_start\n(tool_use → registra índice)"]
        A3["content_block_delta\n(text / thinking / input_json)"]
        A4["content_block_stop\n(tool_use → emite tool_use_start)"]
        A5["message_stop → emite usage"]
        A1 --> A2 --> A3 --> A4 --> A5
    end

    subgraph OpenAI
        direction TB
        O1["client.chat.completions.create(stream)"]
        O2["delta.content →\nThinkingStreamParser\n(si enableThinking)"]
        O3["delta.tool_calls → acumula JSON"]
        O4["finish_reason=tool_calls\n→ emite tool_use_start*N"]
        O5["usage chunk → message_stop"]
        O1 --> O2 --> O3 --> O4 --> O5
    end

    subgraph Gemini
        direction TB
        G1["model.generateContentStream()"]
        G2["part.text →\nThinkingStreamParser\n(si enableThinking)"]
        G3["part.functionCall\n→ emite tool_use_start inmediato"]
        G4["usageMetadata → message_stop"]
        G1 --> G2 --> G3 --> G4
    end

    Anthropic -->|StreamEvent| Executor["AgentExecutor"]
    OpenAI -->|StreamEvent| Executor
    Gemini -->|StreamEvent| Executor
```

### ThinkingStreamParser (OpenAI / Gemini)

```mermaid
stateDiagram-v2
    [*] --> Normal
    Normal --> Thinking : encuentra &lt;think&gt;
    Thinking --> Normal : encuentra &lt;/think&gt;
    Normal --> Normal : emite text_delta
    Thinking --> Thinking : emite thinking_delta
    Normal --> [*] : flush() al final del stream
    Thinking --> [*] : flush() (texto restante como thinking_delta)
```

---

## 4. Bucle Agéntico (Conversation Loop)

```mermaid
flowchart TD
    Start([Inicio del loop\nronda = 0]) --> LoadHistory
    LoadHistory["Carga historial completo\nde SQLite"] --> CallLLM
    CallLLM["provider.streamMessage()\nstreaming al renderer"] --> Collect

    Collect{"¿tool_use_start\nrecibidos?"} -->|No| SaveFinal
    Collect -->|Sí| ExecTools

    SaveFinal["Guarda respuesta\nasistente en DB"] --> EmitStop
    EmitStop["Emite message_stop\n(con usage)"] --> End([Fin])

    ExecTools["Para cada tool call:"] --> CheckEnabled

    CheckEnabled{"isToolEnabled()\n(PermissionGuard)"} -->|Disabled| EmitDisabled
    CheckEnabled -->|Enabled| CheckConfirm

    EmitDisabled["tool_use_end: error\n'tool disabled'"] --> NextTool

    CheckConfirm{"requiresConfirmation?\n(bash_execute)"}
    CheckConfirm -->|No| RunTool
    CheckConfirm -->|Sí| CheckAllowlist

    CheckAllowlist{"isBashCommandAllowed()\n(PermissionGuard)"} -->|Blocked| EmitBlocked
    CheckAllowlist -->|Allowed| AskUser

    EmitBlocked["tool_use_end: error\n'not in allowlist'"] --> NextTool

    AskUser["requestConfirmation()\n→ ConfirmationDialog en UI"] --> UserDecision
    UserDecision{"¿Usuario aprueba?"}
    UserDecision -->|No| EmitDenied
    UserDecision -->|Sí| RunTool

    EmitDenied["tool_use_end: error\n'user denied'"] --> NextTool
    RunTool["tool.execute(input, context)"] --> EmitResult
    EmitResult["tool_use_end: output/error\n→ se actualiza UI"] --> NextTool

    NextTool{"¿Más tools?"} -->|Sí| CheckEnabled
    NextTool -->|No| SaveToolMsg

    SaveToolMsg["Guarda mensaje user con\ntodos los resultados en DB"] --> NextRound

    NextRound{"ronda < 10\ny no cancelado?"} -->|Sí| LoadHistory
    NextRound -->|No| EmitStop
```

---

## 5. Seguridad y Permisos

```mermaid
flowchart LR
    Agent["Configuración\ndel Agente\n(toolsConfig)"] --> Guard["PermissionGuard"]

    Guard --> Check1{"enabledTools\ncontiene tool?"}
    Check1 -->|No| Block1["❌ Bloqueado\ntool disabled"]
    Check1 -->|Sí| Check2{"requiresConfirmation?"}

    Check2 -->|No| Allow["✅ Ejecución directa"]
    Check2 -->|Sí| Check3{"bashAllowlist\nconfigurada?"}

    Check3 -->|No allowlist| Confirm["Pide confirmación\nal usuario"]
    Check3 -->|Allowlist existe| Check4{"comando en\nallowlist?"}

    Check4 -->|No| Block2["❌ Bloqueado\nnot in allowlist"]
    Check4 -->|Sí| Confirm

    Confirm --> Dialog["ConfirmationDialog\nen Renderer"]
    Dialog -->|Aprobado| Allow
    Dialog -->|Denegado| Block3["❌ user denied"]

    style Block1 fill:#c0392b,color:#fff
    style Block2 fill:#c0392b,color:#fff
    style Block3 fill:#c0392b,color:#fff
    style Allow fill:#27ae60,color:#fff
```

---

## 6. Estado en el Renderer (Zustand Store)

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Idle : sesión activa sin streaming

    Idle --> Streaming : sendMessage() → text_delta o thinking_delta
    Streaming --> Streaming : text_delta → appendToLastMessage
    Streaming --> Streaming : thinking_delta → appendThinking
    Streaming --> Streaming : tool_use_start → addToolCall (isLoading=true)
    Streaming --> Streaming : tool_use_end → resolveToolCall (isLoading=false)
    Streaming --> Idle : message_stop → setStreaming(false)
    Streaming --> Idle : error → addMessage(error) + setStreaming(false)
    Streaming --> Idle : cancel → setStreaming(false)
```

### Estructura del ChatMessage en store

```mermaid
classDiagram
    class ChatMessage {
        +role: 'user' | 'assistant'
        +content: string
        +thinking?: string
        +toolCalls?: ToolCall[]
    }

    class ToolCall {
        +toolName: string
        +input: unknown
        +result?: ToolResult
        +isLoading: boolean
    }

    class ToolResult {
        +output?: string
        +error?: string
    }

    ChatMessage "1" --> "0..*" ToolCall
    ToolCall "1" --> "0..1" ToolResult
```

---

## 7. IPC: Canales de Comunicación

```mermaid
flowchart TB
    subgraph Renderer
        R1["agent.sendMessage()"]
        R2["agent.onStreamEvent()"]
        R3["agent.cancel()"]
        R4["agent.confirmResponse()"]
        R5["agent.onConfirmRequest()"]
    end

    subgraph IPC_Channels["IPC Channels (constants.ts)"]
        C1["AGENT_SEND_MESSAGE\n(invoke)"]
        C2["AGENT_STREAM_EVENT\n(send → main to renderer)"]
        C3["AGENT_CANCEL\n(send)"]
        C4["AGENT_CONFIRM_RESPONSE\n(invoke)"]
        C5["AGENT_CONFIRM_REQUEST\n(send → main to renderer)"]
    end

    subgraph Main
        M1["handleMessage() → streamId"]
        M2["emitStreamEvent()"]
        M3["cancelStream()"]
        M4["resolveConfirmation()"]
        M5["requestConfirmation()"]
    end

    R1 -->|invoke| C1 --> M1
    M2 -->|send| C2 --> R2
    R3 -->|send| C3 --> M3
    R4 -->|invoke| C4 --> M4
    M5 -->|send| C5 --> R5
```

---

## 8. Persistencia (SQLite)

```mermaid
erDiagram
    projects {
        text id PK
        text name
        text root_path
        text instructions
        text agent_id FK
    }
    sessions {
        text id PK
        text project_id FK
        text name
        integer created_at
    }
    messages {
        text id PK
        text session_id FK
        text role
        text content
        text tool_calls
        integer created_at
    }
    agents {
        text id PK
        text name
        text system_prompt
        text provider
        text model
        text tools_config
    }
    project_documents {
        text id PK
        text project_id FK
        text file_path
        text file_name
        text mime_type
    }

    projects ||--o{ sessions : "tiene"
    sessions ||--o{ messages : "contiene"
    projects ||--o{ project_documents : "adjunta"
    agents ||--o{ projects : "asignado a"
```

> **Nota:** `tool_calls` y `tools_config` se serializan como JSON dentro de columnas `TEXT`. El historial de conversación que se envía al LLM se reconstruye en cada ronda del loop aplanando `messages.content` (sin tool calls) para mantener compatibilidad entre proveedores.

---

## 9. Construcción del System Prompt

```mermaid
flowchart TD
    A["buildSystemPrompt()"] --> B["Sección: Identidad\n'You are Termimate AI...'"]
    B --> C{"¿Hay proyecto?"}
    C -->|Sí| D["Sección: Proyecto\nnombre, ruta, instrucciones"]
    C -->|No| E["Sección: Sin proyecto\n(contexto limitado)"]
    D --> F{"¿Hay agent.systemPrompt?"}
    E --> F
    F -->|Sí| G["Sección: Instrucciones\npersonalizadas del agente"]
    F -->|No| H
    G --> H{"¿Hay documentos\nadjuntos?"}
    H -->|Sí| I["Sección: Project Context Documents\nlista de archivos con rutas"]
    H -->|No| J
    I --> J["Sección: Available Tools\ndescripción genérica"]
    J --> K["Shell info\n(PowerShell / Bash / Zsh...)"]
    K --> End["System prompt\ncompleto"]
```
