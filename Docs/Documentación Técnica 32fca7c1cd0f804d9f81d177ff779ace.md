# Documentación Técnica

**Versión:** 1.0.0-draft

**Fecha:** Marzo 2026

**Estado:** Draft inicial

---

## Tabla de contenidos

1. [Visión general del sistema](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#1-visi%C3%B3n-general-del-sistema)
2. [Stack tecnológico](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#2-stack-tecnol%C3%B3gico)
3. [Arquitectura del sistema](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#3-arquitectura-del-sistema)
4. [Estructura del proyecto](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#4-estructura-del-proyecto)
5. [Módulos principales](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#5-m%C3%B3dulos-principales)
6. [Modelo de datos](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#6-modelo-de-datos)
7. [Sistema de agentes IA](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#7-sistema-de-agentes-ia)
8. [Seguridad](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#8-seguridad)
9. [Comunicación entre procesos (IPC)](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#9-comunicaci%C3%B3n-entre-procesos-ipc)
10. [Testing](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#10-testing)
11. [Build y distribución](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#11-build-y-distribuci%C3%B3n)
12. [Roadmap técnico](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#12-roadmap-t%C3%A9cnico)

---

## 1. Visión general del sistema

Termimate es una aplicación de escritorio nativa para Linux que integra un emulador de terminal completo con un sistema de agentes de inteligencia artificial contextual. A diferencia de soluciones como Warp o Hyper, Termimate no instrumentaliza la terminal: el panel de IA y el panel de terminal son entidades independientes que se comunican de forma controlada y auditable.

### Principios de diseño

- **Separación estricta de contextos:** la terminal opera con plena libertad (stdin/stdout nativo), el agente opera en un sandbox controlado.
- **Auditabilidad:** todas las acciones del agente (tool calls, ejecución de comandos, lectura de archivos) son visibles y trazables por el usuario.
- **Seguridad por defecto:** el agente no puede actuar sobre la terminal salvo autorización explícita del usuario.
- **Privacidad:** las claves API y credenciales se almacenan cifradas localmente, nunca se transmiten a servicios propios.
- **SOLID:** cada módulo tiene una responsabilidad única, con interfaces bien definidas y bajo acoplamiento.

---

## 2. Stack tecnológico

### 2.1 Decisión de framework de escritorio

| Framework | Pros | Contras | Veredicto |
| --- | --- | --- | --- |
| **Electron** | Ecosistema maduro, APIs nativas completas, soporte PTY robusto | Consumo de memoria elevado | ✅ **Elegido** |
| Tauri (Rust) | Menor footprint | Ecosistema PTY limitado, complejidad Rust | ❌ |
| NW.js | Maduro | Comunidad en declive | ❌ |

**Electron** es la elección correcta para este caso de uso específico por tres razones clave: soporte de primera clase para **node-pty** (emulación de pseudoterminal), acceso completo a las APIs del sistema operativo necesarias para un emulador de terminal real, y el ecosistema React/TypeScript que maximiza la productividad del equipo.

### 2.2 Stack completo

### Proceso principal (Main Process)

| Tecnología | Versión | Uso |
| --- | --- | --- |
| **Electron** | ^32.x | Shell de la aplicación, gestión de ventanas, IPC |
| **Node.js** | ^22.x LTS | Runtime del proceso principal |
| **TypeScript** | ^5.x | Tipado estático en todo el proyecto |
| **node-pty** | ^1.x | Pseudoterminal nativo (PTY) para emulación de terminal |
| **better-sqlite3** | ^9.x | Base de datos local embebida, síncrona y rápida |
| **electron-store** | ^10.x | Configuración persistente cifrada |
| **keytar** | ^7.x | Almacenamiento seguro de claves API en el keychain del sistema |
| **chokidar** | ^3.x | Watcher de sistema de archivos para contexto de proyecto |

### Proceso renderer (UI)

| Tecnología | Versión | Uso |
| --- | --- | --- |
| **React** | ^19.x | Framework de UI |
| **TypeScript** | ^5.x | Tipado estático |
| **Vite** | ^6.x | Bundler y dev server (con plugin electron-vite) |
| **Xterm.js** | ^5.x | Renderizado del emulador de terminal en el renderer |
| **@xterm/addon-fit** | ^0.10.x | Ajuste dinámico del terminal al contenedor |
| **@xterm/addon-web-links** | ^0.11.x | Links clickeables en terminal |
| **@xterm/addon-search** | ^0.15.x | Búsqueda en el buffer del terminal |
| **Zustand** | ^5.x | Gestión de estado global (ligero, sin boilerplate) |
| **TanStack Query** | ^5.x | Sincronización de estado servidor/base de datos |
| **Tailwind CSS** | ^4.x | Estilos utilitarios |
| **Radix UI** | ^1.x | Componentes accesibles sin estilos (primitivos) |
| **Framer Motion** | ^11.x | Animaciones de UI |

### Sistema de agentes

| Tecnología | Versión | Uso |
| --- | --- | --- |
| **Anthropic SDK** | ^0.x | Cliente oficial para Claude (modelo preferente) |
| **OpenAI SDK** | ^4.x | Soporte multi-proveedor |
| **LangChain.js** | Evaluado — *ver nota* | Orquestación de agentes |
| **Zod** | ^3.x | Validación de schemas y tool call parameters |

> **Nota sobre LangChain:** Se recomienda implementar el sistema de agentes con el SDK nativo de Anthropic usando la API de herramientas (tool use) directamente, sin LangChain. Esto reduce dependencias, mejora el control sobre el comportamiento del agente y facilita el mantenimiento. LangChain puede incorporarse en iteraciones futuras si la complejidad de orquestación lo justifica.
> 

### Infraestructura y tooling

| Tecnología | Uso |
| --- | --- |
| **electron-builder** | Packaging y distribución (.deb, .AppImage, .rpm) |
| **electron-vite** | Integración Vite + Electron con HMR en desarrollo |
| **Vitest** | Tests unitarios e integración |
| **Playwright** | Tests end-to-end de UI (con soporte Electron) |
| **ESLint + Prettier** | Linting y formateo |
| **Husky + lint-staged** | Pre-commit hooks |

---

## 3. Arquitectura del sistema

### 3.1 Arquitectura de procesos Electron

```
┌─────────────────────────────────────────────────────────────┐
│                     PROCESO PRINCIPAL                        │
│                     (Main Process)                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PTY Manager │  │  DB Manager  │  │  Agent Executor  │  │
│  │  (node-pty)  │  │  (SQLite)    │  │  (Tool Runner)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────▼─────────────────▼────────────────────▼─────────┐  │
│  │                   IPC Bridge (contextBridge)           │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │ IPC (ipcMain / ipcRenderer)
┌─────────────────────────────┼───────────────────────────────┐
│                     PROCESO RENDERER                         │
│                     (BrowserWindow)                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Terminal UI │  │   Chat UI    │  │   Sidenav / App  │  │
│  │  (Xterm.js)  │  │  (Agent)     │  │   Shell          │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│                   Zustand Store (estado global)             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de datos del terminal

```
Usuario teclea
      │
      ▼
Xterm.js (renderer) ──IPC──► PTYManager (main)
                                    │
                                    ▼
                              node-pty (shell real)
                                    │
                             stdout/stderr
                                    │
                    IPC ◄───────────┘
                     │
                     ▼
            Xterm.js escribe output
                     │
                     ▼ (si autorizado)
            SessionOutputBuffer ──► AgentContext
```

### 3.3 Flujo del agente IA

```
Usuario envía mensaje en ChatPanel
             │
             ▼
      AgentService (renderer)
             │ IPC
             ▼
      AgentExecutor (main)
             │
      ┌──────┴──────────────────┐
      │                         │
      ▼                         ▼
  LLM Provider API          ToolRouter
  (Anthropic/OpenAI)             │
      │                    ┌────┴─────────────┐
      │ streaming           │                  │
      ▼                     ▼                  ▼
  ChatPanel UI         FileReadTool      BashExecutorTool
  (tool calls inline)  (sandboxed)       (sandboxed, confirmación)
```

---

## 4. Estructura del proyecto

```
termimate/
├── src/
│   ├── main/                        # Proceso principal (Node.js/Electron)
│   │   ├── index.ts                 # Entry point del main process
│   │   ├── window/
│   │   │   └── WindowManager.ts     # Creación y gestión de BrowserWindows
│   │   ├── pty/
│   │   │   ├── PTYManager.ts        # Gestión del ciclo de vida de PTYs
│   │   │   ├── PTYSession.ts        # Entidad de una sesión PTY individual
│   │   │   └── SessionOutputBuffer.ts # Buffer circular del output reciente
│   │   ├── database/
│   │   │   ├── DatabaseManager.ts   # Singleton de conexión SQLite
│   │   │   ├── migrations/          # Migraciones de schema SQL versionadas
│   │   │   └── repositories/        # Un repository por entidad (SOLID - SRP)
│   │   │       ├── ProjectRepository.ts
│   │   │       ├── SessionRepository.ts
│   │   │       ├── AgentRepository.ts
│   │   │       └── MessageRepository.ts
│   │   ├── agent/
│   │   │   ├── AgentExecutor.ts     # Orquestador: recibe mensaje, llama LLM, ejecuta tools
│   │   │   ├── providers/           # Abstracción multi-proveedor
│   │   │   │   ├── ILLMProvider.ts  # Interfaz (SOLID - DIP)
│   │   │   │   ├── AnthropicProvider.ts
│   │   │   │   └── OpenAIProvider.ts
│   │   │   └── tools/               # Tool Use implementations
│   │   │       ├── ITool.ts         # Interfaz común de herramienta
│   │   │       ├── FileReadTool.ts  # Lectura de archivos del proyecto
│   │   │       ├── BashExecutorTool.ts # Ejecución de comandos (con sandbox)
│   │   │       └── TerminalReadTool.ts # Lectura del output del terminal activo
│   │   ├── security/
│   │   │   ├── KeychainService.ts   # Gestión de claves API vía keytar
│   │   │   ├── PathSanitizer.ts     # Validación y sanitización de rutas
│   │   │   └── PermissionGuard.ts   # Guards de autorización para tool calls
│   │   └── ipc/
│   │       ├── handlers/            # Un archivo por dominio IPC
│   │       │   ├── ptyHandlers.ts
│   │       │   ├── agentHandlers.ts
│   │       │   ├── projectHandlers.ts
│   │       │   └── configHandlers.ts
│   │       └── preload.ts           # contextBridge — única superficie de exposición
│   │
│   ├── renderer/                    # Proceso renderer (React)
│   │   ├── index.tsx                # Entry point React
│   │   ├── App.tsx                  # Layout raíz
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Topbar/
│   │   │   │   ├── Sidenav/
│   │   │   │   └── MainArea/
│   │   │   ├── terminal/
│   │   │   │   ├── TerminalPane.tsx # Wrapper de Xterm.js
│   │   │   │   └── TerminalTab.tsx
│   │   │   ├── agent/
│   │   │   │   ├── ChatPane.tsx     # Panel inferior del agente
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── ToolCallCard.tsx # Visualización inline de tool calls
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── ContextIndicator.tsx # Tokens consumidos / límite
│   │   │   └── shared/              # Componentes reutilizables
│   │   ├── hooks/
│   │   │   ├── useTerminal.ts       # Hook: lifecycle de una instancia Xterm
│   │   │   ├── useAgent.ts          # Hook: envío de mensajes y streaming
│   │   │   └── useProject.ts        # Hook: CRUD de proyectos
│   │   ├── store/                   # Zustand stores (un slice por dominio)
│   │   │   ├── sessionStore.ts
│   │   │   ├── projectStore.ts
│   │   │   └── agentStore.ts
│   │   └── services/
│   │       └── ipc.ts               # Wrapper tipado sobre window.electronAPI
│   │
│   └── shared/                      # Código compartido entre main y renderer
│       ├── types/                   # TypeScript interfaces y tipos compartidos
│       │   ├── session.types.ts
│       │   ├── project.types.ts
│       │   ├── agent.types.ts
│       │   └── ipc.types.ts         # Contratos de los canales IPC
│       └── constants.ts
│
├── resources/                       # Assets de la aplicación (iconos, etc.)
├── electron.vite.config.ts          # Configuración electron-vite
├── electron-builder.config.ts       # Configuración de packaging
├── package.json
└── tsconfig.json
```

---

## 5. Módulos principales

### 5.1 PTYManager

Responsable de crear, gestionar y destruir sesiones de pseudoterminal usando `node-pty`. Opera exclusivamente en el main process.

**Responsabilidades (SRP):**

- Crear instancias `IPty` con el shell configurado por el usuario
- Rutear stdin/stdout entre el renderer (via IPC) y el proceso shell
- Mantener un `SessionOutputBuffer` por sesión (buffer circular de las últimas N líneas, para el agente)
- Gestionar el resize del terminal (SIGWINCH)
- Destruir sesiones correctamente (kill, SIGHUP)

```tsx
// src/main/pty/PTYManager.ts
interface IPTYManager {
  createSession(sessionId: string, config: PTYConfig): PTYSession;
  writeToSession(sessionId: string, data: string): void;
  resizeSession(sessionId: string, cols: number, rows: number): void;
  destroySession(sessionId: string): void;
  getOutputBuffer(sessionId: string): SessionOutputBuffer | null;
}
```

### 5.2 AgentExecutor

Orquestador central del sistema de agentes. Opera en el main process para tener acceso directo al sistema de archivos y a la ejecución de comandos sin pasar por IPC adicional.

**Responsabilidades:**

- Recibir el mensaje del usuario junto con el contexto del proyecto
- Construir el system prompt con las instrucciones personalizadas del proyecto
- Llamar al LLM provider seleccionado con streaming
- Detectar y ejecutar tool calls, emitiendo cada paso via IPC al renderer
- Gestionar el historial de conversación por sesión

**Interfaz del provider (DIP — Dependency Inversion):**

```tsx
// src/main/agent/providers/ILLMProvider.ts
interface ILLMProvider {
  readonly name: string;
  readonly supportedModels: ModelDefinition[];

  streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent>;
}

type StreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_use_start'; toolName: string; toolInput: unknown }
  | { type: 'tool_use_end'; toolName: string; result: ToolResult }
  | { type: 'message_stop'; usage: TokenUsage };
```

### 5.3 Sistema de herramientas (Tools)

Cada herramienta implementa la interfaz `ITool` y es registrada en el `AgentExecutor`. El `PermissionGuard` intercepta la ejecución antes de llamar al `execute`.

```tsx
// src/main/agent/tools/ITool.ts
interface ITool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodSchema;       // Validación estricta de parámetros
  readonly requiresConfirmation: boolean; // Si true, el user debe aprobar en UI

  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
```

**Herramientas implementadas en v1:**

| Herramienta | `requiresConfirmation` | Descripción |
| --- | --- | --- |
| `file_read` | No | Lee archivos dentro del directorio del proyecto |
| `file_list` | No | Lista la estructura de carpetas del proyecto |
| `bash_execute` | **Sí** | Ejecuta un comando bash. El usuario aprueba antes de ejecutar |
| `terminal_read` | No* | Lee el output reciente del terminal activo (*requiere auth inicial) |

### 5.4 DatabaseManager y Repositorios

Se usa `better-sqlite3` (síncrono) para simplificar el manejo de transacciones en el main process. La base de datos se almacena en el directorio de datos de la aplicación (`app.getPath('userData')`).

**Patrón Repository (SRP + DIP):**

```tsx
// src/main/database/repositories/ProjectRepository.ts
interface IProjectRepository {
  findAll(): Project[];
  findById(id: string): Project | null;
  create(data: CreateProjectDTO): Project;
  update(id: string, data: UpdateProjectDTO): Project;
  delete(id: string): void;
}
```

---

## 6. Modelo de datos

### 6.1 Schema SQLite

```sql
-- Proyectos
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,  -- UUID v4
  name        TEXT NOT NULL,
  icon        TEXT,              -- emoji o nombre de icono
  color       TEXT,              -- hex color
  root_path   TEXT,              -- ruta raíz del proyecto en el filesystem
  instructions TEXT,             -- instrucciones personalizadas para el agente
  agent_id    TEXT REFERENCES agents(id),
  created_at  INTEGER NOT NULL,  -- unix timestamp
  updated_at  INTEGER NOT NULL
);

-- Sesiones de terminal
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  shell       TEXT NOT NULL DEFAULT 'bash',
  cwd         TEXT,              -- directorio de trabajo inicial
  env_vars    TEXT,              -- JSON con variables de entorno adicionales
  is_active   INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

-- Documentos adjuntos a proyectos
CREATE TABLE project_documents (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,     -- ruta absoluta
  file_name   TEXT NOT NULL,
  mime_type   TEXT,
  created_at  INTEGER NOT NULL
);

-- Agentes configurados por el usuario
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  system_prompt TEXT,
  provider    TEXT NOT NULL,     -- 'anthropic' | 'openai'
  model       TEXT NOT NULL,
  tools_config TEXT,             -- JSON: qué tools puede usar este agente
  created_at  INTEGER NOT NULL
);

-- Mensajes del historial de chat (por sesión)
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,     -- 'user' | 'assistant'
  content     TEXT NOT NULL,     -- JSON (content blocks de la API)
  tool_calls  TEXT,              -- JSON con tool calls ejecutados en este turno
  tokens_used INTEGER,
  created_at  INTEGER NOT NULL
);

-- Índices
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_project_docs_project ON project_documents(project_id);
```

### 6.2 Configuración (electron-store)

Almacenada en `config.json` cifrada con la clave de la instancia:

```tsx
interface AppConfig {
  appearance: {
    theme: 'dark' | 'light';
    terminalFontFamily: string;
    terminalFontSize: number;
  };
  terminal: {
    defaultShell: string;   // '/bin/bash' | '/bin/zsh' | '/usr/bin/fish'
    scrollback: number;     // líneas en el buffer
  };
  keybindings: Record<string, string>;
  agent: {
    defaultProviderId: string;
    outputBufferLines: number;  // cuántas líneas del terminal exponer al agente
  };
}
```

---

## 7. Sistema de agentes IA

### 7.1 Construcción del contexto

Cuando el usuario envía un mensaje, el `AgentExecutor` construye el contexto completo:

```tsx
async function buildSystemPrompt(session: Session, project: Project | null): Promise<string> {
  const sections: string[] = [];

  // 1. Instrucciones base del agente
  sections.push(agent.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);

  // 2. Contexto del proyecto (si existe)
  if (project) {
    sections.push(`## Proyecto activo: ${project.name}`);
    sections.push(`Ruta raíz: ${project.rootPath}`);

    if (project.instructions) {
      sections.push(`## Instrucciones del proyecto\n${project.instructions}`);
    }

    // 3. Estructura de carpetas (generada al vuelo, no cacheada)
    const tree = await generateDirectoryTree(project.rootPath, { maxDepth: 3 });
    sections.push(`## Estructura del proyecto\n\`\`\`\n${tree}\n\`\`\``);

    // 4. Documentos adjuntos (por referencia, el agente los lee con file_read)
    const docs = await projectRepository.getDocuments(project.id);
    if (docs.length > 0) {
      sections.push(`## Documentos disponibles\n${docs.map(d => `- ${d.fileName}`).join('\n')}`);
    }
  }

  return sections.join('\n\n');
}
```

### 7.2 Streaming y tool calls

El agente usa streaming SSE. Cada evento se emite via IPC al renderer para actualizar la UI en tiempo real:

```
AgentExecutor                IPC                   ChatPane
     │                        │                        │
     │ ──── text_delta ───────►│──────────────────────► append text
     │ ──── tool_use_start ───►│──────────────────────► show ToolCallCard (loading)
     │      [ejecuta tool]     │
     │ ──── tool_use_end ─────►│──────────────────────► update ToolCallCard (result)
     │ ──── text_delta ───────►│──────────────────────► append text
     │ ──── message_stop ─────►│──────────────────────► update token counter
```

### 7.3 Autorización de `bash_execute`

Antes de ejecutar cualquier comando bash, el `AgentExecutor` emite un evento `bash_confirm_required` con el comando propuesto. La UI muestra una confirmación al usuario. La ejecución queda bloqueada hasta recibir aprobación o rechazo:

```tsx
// Flujo de confirmación (simplificado)
const confirmed = await this.requestUserConfirmation({
  type: 'bash_execute',
  command: toolInput.command,
  sessionId: context.sessionId,
});

if (!confirmed) {
  return { success: false, error: 'User rejected command execution' };
}
```

---

## 8. Seguridad

### 8.1 Seguridad del proceso renderer

- **`contextIsolation: true`** — el renderer no tiene acceso a APIs de Node.js.
- **`nodeIntegration: false`** — integración de Node desactivada en el renderer.
- **`sandbox: true`** — el renderer corre en sandbox de Chromium.
- **`webSecurity: true`** — sin excepciones CORS.
- El `preload.ts` es la **única superficie de exposición** al renderer via `contextBridge`. Expone únicamente funciones tipadas, nunca objetos de bajo nivel como `ipcRenderer` directamente.

```tsx
// src/main/ipc/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // PTY
  pty: {
    create: (config: PTYConfig) => ipcRenderer.invoke('pty:create', config),
    write: (sessionId: string, data: string) => ipcRenderer.send('pty:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('pty:resize', sessionId, cols, rows),
    onData: (sessionId: string, callback: (data: string) => void) => { /* ... */ },
  },
  // Agent
  agent: {
    sendMessage: (params: SendMessageParams) => ipcRenderer.invoke('agent:sendMessage', params),
    onStreamEvent: (callback: (event: StreamEvent) => void) => { /* ... */ },
    cancelStream: (streamId: string) => ipcRenderer.send('agent:cancel', streamId),
  },
  // ...resto de dominios
} satisfies ElectronAPI);
```

### 8.2 Seguridad del agente

- **PathSanitizer:** todas las rutas de archivo que el agente intenta leer son validadas contra la `rootPath` del proyecto. Cualquier intento de path traversal (`../`) es rechazado.
- **Allowlist de comandos bash:** configurable por agente. Por defecto en modo restrictivo (solo lectura).
- **Sandbox de ejecución:** los comandos bash del agente se ejecutan en el CWD del proyecto, con un timeout configurable y sin variables de entorno del usuario (se pasa un env mínimo).
- **Rate limiting:** el `AgentExecutor` aplica un rate limit local por minuto para evitar consumo accidental de tokens.

```tsx
// src/main/security/PathSanitizer.ts
function assertPathWithinProject(filePath: string, projectRoot: string): void {
  const resolved = path.resolve(filePath);
  const root = path.resolve(projectRoot);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new SecurityError(`Path traversal attempt: ${filePath}`);
  }
}
```

### 8.3 Almacenamiento de claves API

Las claves API (Anthropic, OpenAI) se almacenan en el **keychain del sistema operativo** usando `keytar`, no en disco plano ni en `electron-store`. Esto garantiza que las claves estén protegidas por las mismas credenciales de sesión del usuario Linux.

```tsx
// src/main/security/KeychainService.ts
const SERVICE_NAME = 'termimate';

async function setApiKey(provider: string, key: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, provider, key);
}

async function getApiKey(provider: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, provider);
}
```

### 8.4 Content Security Policy

```tsx
// En WindowManager.ts, al crear la BrowserWindow
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      ],
    },
  });
});
```

---

## 9. Comunicación entre procesos (IPC)

Todos los canales IPC están tipados en `src/shared/types/ipc.types.ts`. Se usan tres patrones:

| Patrón | Dirección | Uso |
| --- | --- | --- |
| `ipcRenderer.invoke` / `ipcMain.handle` | Renderer → Main (async, respuesta) | Operaciones con resultado: crear sesión, enviar mensaje |
| `ipcRenderer.send` / `ipcMain.on` | Renderer → Main (fire & forget) | Escritura en PTY, cancelar stream |
| `webContents.send` / `ipcRenderer.on` | Main → Renderer (push) | Datos del PTY, eventos de streaming del agente |

### Canales definidos

```tsx
// src/shared/types/ipc.types.ts

// PTY
'pty:create'     → (config: PTYConfig)            → PTYSession
'pty:write'      → (sessionId: string, data: string) → void
'pty:resize'     → (sessionId: string, cols: number, rows: number) → void
'pty:destroy'    → (sessionId: string)             → void
'pty:data'       ← (sessionId: string, data: string)  [push desde main]

// Agent
'agent:sendMessage' → (params: SendMessageParams) → { streamId: string }
'agent:cancel'      → (streamId: string)          → void
'agent:streamEvent' ← (streamId: string, event: StreamEvent) [push]
'agent:confirmRequest' ← (request: ConfirmRequest) [push, espera respuesta]
'agent:confirmResponse' → (requestId: string, approved: boolean) → void

// Projects & Sessions
'project:list'    → ()                  → Project[]
'project:create'  → (dto: CreateProjectDTO) → Project
'project:update'  → (id: string, dto)   → Project
'project:delete'  → (id: string)        → void
'session:list'    → (projectId?: string) → Session[]
'session:create'  → (dto: CreateSessionDTO) → Session

// Config
'config:get'      → ()                  → AppConfig
'config:set'      → (partial: Partial<AppConfig>) → void
'config:getApiKey' → (provider: string) → string | null
'config:setApiKey' → (provider: string, key: string) → void
```

---

## 10. Testing

### 10.1 Estrategia

```
┌──────────────────────────────────────┐
│        E2E Tests (Playwright)        │  ← Flujos críticos de usuario
│  ~10% del total, ejecución en CI     │
├──────────────────────────────────────┤
│     Integration Tests (Vitest)       │  ← IPC handlers, DB repositories
│  ~30% del total                      │
├──────────────────────────────────────┤
│       Unit Tests (Vitest)            │  ← Lógica de negocio pura
│  ~60% del total                      │
└──────────────────────────────────────┘
```

### 10.2 Tests unitarios críticos

- `PathSanitizer` — todos los casos de path traversal
- `AgentExecutor` — construcción de system prompt, gestión de tool calls
- `SessionOutputBuffer` — comportamiento del buffer circular
- `PTYManager` — gestión del ciclo de vida
- Todos los `Repository` — CRUD con base de datos en memoria (`:memory:`)

### 10.3 Tests de integración

- Canales IPC con main process mockeado
- Flujo completo de mensaje → LLM → tool call → resultado (con provider mockeado)
- Persistencia de historial de conversación

### 10.4 Tests E2E

- Creación de sesión de terminal y escritura de comandos
- Envío de mensaje al agente y visualización de respuesta en streaming
- Aprobación/rechazo de `bash_execute`
- Persistencia entre reinicios de la aplicación

---

## 11. Build y distribución

### 11.1 Targets de distribución Linux

| Formato | Target |
| --- | --- |
| `.deb` | Distribuciones basadas en Debian/Ubuntu |
| `.AppImage` | Universal (portable, sin instalación) |
| `.rpm` | Distribuciones basadas en Red Hat/Fedora |
| `.tar.gz` | Distribución manual |

### 11.2 Scripts de npm

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "dist": "npm run build && electron-builder",
    "dist:deb": "npm run build && electron-builder --linux deb",
    "dist:appimage": "npm run build && electron-builder --linux AppImage",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

### 11.3 Auto-actualizaciones

Se implementa `electron-updater` para distribución de actualizaciones OTA. El servidor de actualizaciones puede ser un bucket S3 o GitHub Releases. Las actualizaciones se verifican con firma criptográfica.

---

## 12. Roadmap técnico

### v0.1 — MVP

- [ ]  Shell de la aplicación: Topbar, Sidenav, layout base
- [ ]  Emulador de terminal funcional (PTY + Xterm.js) con gestión de sesiones
- [ ]  Persistencia básica (SQLite): proyectos, sesiones
- [ ]  Panel de chat básico con Anthropic (sin herramientas)
- [ ]  Configuración: clave API, shell, fuente

### v0.2 — Agente contextual

- [ ]  Sistema de proyectos completo (documentos adjuntos, instrucciones)
- [ ]  Tool `file_read` y `file_list`
- [ ]  Tool `bash_execute` con confirmación de usuario
- [ ]  Visualización inline de tool calls en el chat
- [ ]  Indicador de tokens / contexto
- [ ]  Historial de conversación persistente

### v0.3 — Multi-proveedor y panel de agentes

- [ ]  Soporte OpenAI
- [ ]  Selector de modelo en el panel de chat
- [ ]  Panel de agentes: crear/editar agentes personalizados
- [ ]  Tool `terminal_read` (acceso al output del terminal activo)
- [ ]  Búsqueda en buffer de terminal (Xterm addon-search)

### v1.0 — Distribución pública

- [ ]  Auto-actualizaciones
- [ ]  Tema claro
- [ ]  Atajos de teclado personalizables
- [ ]  Tests E2E completos en CI/CD
- [ ]  Documentación de usuario
- [ ]  Packaging: .deb, .AppImage, .rpm

---

*Documento generado para uso interno del equipo de desarrollo de Termimate.*