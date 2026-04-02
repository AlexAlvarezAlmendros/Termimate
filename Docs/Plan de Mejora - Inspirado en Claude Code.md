# Plan de Mejora de Termimate — Inspirado en Claude Code v2.1.88

> Análisis comparativo basado en el source map restaurado de `@anthropic-ai/claude-code@2.1.88` (4756 archivos, 1884 fuentes TS/TSX).

---

## Resumen Ejecutivo

Termimate tiene una base sólida con buena arquitectura Electron (context isolation, safeStorage, PTY con persistencia de scrollback). Sin embargo, comparado con la arquitectura de Claude Code, hay **oportunidades significativas** en 6 áreas clave: gestión de contexto, sistema de tools, orquestación multi-agente, seguridad, hooks/extensibilidad y UX.

---

## Tabla de Prioridades

| # | Mejora | Impacto | Esfuerzo | Prioridad |
|---|--------|---------|----------|-----------|
| 1 | Formato nativo de tool_use/tool_result | 🔴 Crítico | Medio | P0 |
| 2 | Gestión de ventana de contexto + Auto-Compact | 🔴 Crítico | Alto | P0 |
| 3 | Fix: cancelación de streams (streamId mismatch) | 🔴 Crítico | Bajo | P0 |
| 4 | Seguridad: path traversal en rutas absolutas | 🔴 Crítico | Bajo | P0 |
| 5 | Ejecución paralela de tools | 🟠 Alto | Medio | P1 |
| 6 | Sistema de permisos granular (approval levels) | 🟠 Alto | Medio | P1 |
| 7 | Sub-agentes (AgentTool) | 🟠 Alto | Alto | P1 |
| 8 | Hooks system (pre/post tool) | 🟡 Medio | Alto | P2 |
| 9 | Nuevas tools (GrepTool, GlobTool, FileEditTool) | 🟡 Medio | Medio | P2 |
| 10 | Memoria de sesión y extracción automática | 🟡 Medio | Alto | P2 |
| 11 | Token estimation y barra de uso real | 🟡 Medio | Medio | P2 |
| 12 | Retry/backoff en llamadas a LLM | 🟡 Medio | Bajo | P2 |
| 13 | Modo Plan (read-only exploration) | 🟢 Bajo | Medio | P3 |
| 14 | Soporte MCP (Model Context Protocol) | 🟢 Bajo | Alto | P3 |
| 15 | Streaming de errores parciales y recovery | 🟢 Bajo | Medio | P3 |

---

## P0 — Correcciones Críticas

### 1. Formato Nativo de tool_use / tool_result

**Problema actual:** Los tool calls se almacenan como texto plano (`Called: tool_name({...})`) y los resultados como mensajes de usuario con `[Tool Results]`. El LLM nunca ve bloques nativos `tool_use`/`tool_result` en turnos subsiguientes, lo que degrada la precisión multi-turno.

**Cómo lo hace Claude Code:** Cada proveedor mantiene el formato nativo del API. Anthropic usa `content_block` con `type: "tool_use"` y `type: "tool_result"`. Los mensajes se almacenan en formato rico que preserva la estructura.

**Implementación propuesta:**
```
1. Modificar el schema de mensajes en la DB para almacenar JSON estructurado
   (no solo `role` + `content` string)
2. Añadir campos: `tool_calls?: ToolCall[]`, `tool_results?: ToolResult[]`
3. En AgentExecutor, al construir el historial, mapear al formato nativo
   de cada provider (Anthropic tool_use blocks, OpenAI function_call, Gemini functionCall)
4. Mantener el texto plano como fallback para visualización en el UI
```

**Archivos afectados:**
- `src/main/database/repositories/MessageRepository.ts`
- `src/main/agent/AgentExecutor.ts` (buildHistory, storeMessages)
- `src/main/agent/providers/*.ts` (mapeo a formato nativo)
- `src/shared/types/session.types.ts`

---

### 2. Gestión de Ventana de Contexto + Auto-Compact

**Problema actual:** Se envía todo el historial de mensajes en cada ronda sin recorte ni estimación de tokens. Eventualmente se alcanza el límite del API.

**Cómo lo hace Claude Code:** Implementa un sistema completo en `services/compact/`:
- `tokenEstimation.ts` — Estimación de tokens por mensaje
- `autoCompact.ts` — Auto-compactación cuando el uso supera ~87% del contexto efectivo
- `compact.ts` — Resumen del historial preservando contexto esencial
- `sessionMemoryCompact.ts` — Compactación con memoria de sesión
- Circuit breaker tras 3 fallos consecutivos
- `microCompact.ts` — Micro-compactación para tool results grandes

**Implementación propuesta:**
```
Fase 1: Token Estimation
- Crear src/main/agent/context/TokenEstimator.ts
- Implementar estimación por caracteres (1 token ≈ 4 chars para inglés, ≈ 2 para código)
- Trackear uso acumulado en cada ronda

Fase 2: Context Trimming
- Cuando el uso supere el 80% de la ventana del modelo, resumir mensajes antiguos
- Preservar: system prompt, últimos N mensajes, tool calls activos
- Hacer una llamada al LLM con prompt de compactación

Fase 3: Auto-Compact
- Disparar automáticamente antes de cada ronda si uso > threshold
- Mostrar indicador en el UI cuando se compacte
```

**Archivos nuevos:**
- `src/main/agent/context/TokenEstimator.ts`
- `src/main/agent/context/ContextCompactor.ts`
- `src/main/agent/context/CompactPrompts.ts`

---

### 3. Fix: Cancelación de Streams (streamId mismatch)

**Problema actual:** El renderer llama `agent.cancel(activeSessionId)` pero el executor indexa streams activos por `streamId` (uuid generado internamente). La cancelación probablemente nunca funciona.

**Fix:**
```typescript
// Opción A: Indexar por sessionId en vez de streamId
// En AgentExecutor.ts, cambiar activeStreams Map key a sessionId

// Opción B: Exponer streamId al renderer al iniciar el stream
// y que el renderer lo use para cancelar
```

**Archivos afectados:**
- `src/main/agent/AgentExecutor.ts` — `activeStreams` Map
- `src/main/ipc/handlers/agentHandlers.ts` — handler de cancel
- `src/renderer/components/agent/ChatPane.tsx` — llamada a cancel

---

### 4. Seguridad: Path Traversal en Rutas Absolutas

**Problema actual:** `FileReadTool` y `FileWriteTool` llaman a `sanitizePath` solo para rutas relativas. Las rutas absolutas pasan sin validación, permitiendo que el agente lea/escriba cualquier archivo del sistema. `FileReadTool` además no requiere confirmación.

**Cómo lo hace Claude Code:** `utils/permissions/filesystem.ts` + `pathValidation.ts` validan **todas** las rutas contra un directorio raíz del proyecto. También tiene un sistema de `dangerousPatterns.ts` para detectar escrituras peligrosas.

**Fix:**
```typescript
// En PathSanitizer.ts:
static sanitizePath(filePath: string, projectRoot: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  // SIEMPRE validar contra projectRoot, incluso para rutas absolutas
  if (!resolved.startsWith(path.resolve(projectRoot))) {
    throw new SecurityError(`Path outside project: ${filePath}`);
  }
  return resolved;
}

// En FileReadTool.ts y FileWriteTool.ts:
// Siempre pasar por sanitizePath, sin bypass para absolutas
```

**Archivos afectados:**
- `src/main/security/PathSanitizer.ts`
- `src/main/agent/tools/FileReadTool.ts`
- `src/main/agent/tools/FileWriteTool.ts`

---

## P1 — Mejoras de Alto Impacto

### 5. Ejecución Paralela de Tools

**Problema actual:** Los tools se ejecutan secuencialmente en un `for` loop. Si el LLM devuelve 3 file_reads, se esperan uno tras otro.

**Cómo lo hace Claude Code:** Los tool calls independientes se ejecutan en paralelo con `Promise.all`. Solo se serializan los que tienen dependencias (ej: write después de read).

**Implementación:**
```typescript
// En AgentExecutor.ts, reemplazar el for secuencial:
const results = await Promise.all(
  toolCalls.map(tc => this.executeTool(tc, context))
);
// Para tools que requieren confirmación, mantener secuencial
// (no se puede pedir 3 confirmaciones en paralelo)
```

---

### 6. Sistema de Permisos Granular (Approval Levels)

**Problema actual:** El UI tiene selector de approval level (`default`/`confirm_all`/`auto`) pero el valor nunca se envía al backend. La confirmación está hardcodeada por tool.

**Cómo lo hace Claude Code:** `utils/permissions/` implementa:
- `PermissionMode.ts` — Modos: plan (read-only), normal (confirmar destructivos), auto (YOLO)
- `bashClassifier.ts` — Clasifica comandos bash por peligrosidad
- `PermissionRule.ts` — Reglas configurables por patrón (ej: "allow Bash(git *)")
- `yoloClassifier.ts` — Auto-aprobación con lista de patrones seguros

**Implementación:**
```
1. Pasar approvalLevel desde ChatInput → IPC → AgentExecutor
2. En AgentExecutor.requestConfirmation():
   - Si level === 'auto': aprobar todo automáticamente
   - Si level === 'confirm_all': confirmar TODO incluyendo reads
   - Si level === 'default': comportamiento actual (confirmar solo destructivos)
3. Crear BashClassifier para clasificar comandos por peligrosidad:
   - safe: ls, cat, echo, git status, git log, etc.
   - moderate: npm install, pip install, etc.
   - dangerous: rm, chmod, git push, etc.
```

---

### 7. Sub-agentes (AgentTool)

**Problema actual:** Termimate ejecuta todo en un solo hilo de agente. No hay capacidad de delegar subtareas.

**Cómo lo hace Claude Code:**
- `tools/AgentTool/` — Spawning de sub-agentes con contexto aislado
- `coordinator/coordinatorMode.ts` — Modo coordinador que orquesta workers en paralelo
- Workers tienen sus propios tool calls, context, y reportan resultados via `<task-notification>` XML
- `SendMessageTool` para continuar workers existentes
- `TaskStopTool` para detener workers

**Implementación (simplificada para Termimate):**
```
Fase 1: AgentTool básico
- Nuevo tool "agent_spawn" que crea una instancia secundaria de AgentExecutor
- Contexto aislado: system prompt + prompt del spawn, sin historial del padre
- El resultado se devuelve como tool_result al agente padre
- Límite: profundidad máx 2 (no sub-sub-agentes)

Fase 2: Ejecución paralela de sub-agentes
- Permitir múltiples agent_spawn en un solo turno
- Ejecutar en paralelo con Promise.all
- Mostrar en el UI como "Worker: [título]" con su propia timeline
```

---

## P2 — Mejoras de Impacto Medio

### 8. Sistema de Hooks (Pre/Post Tool)

**Cómo lo hace Claude Code:** `utils/hooks.ts` (1500+ líneas) implementa:
- **20+ tipos de eventos**: PreToolUse, PostToolUse, SessionStart, SessionEnd, Stop, Compact, etc.
- Hooks ejecutables: shell commands, prompts, HTTP, callbacks, agent hooks
- Matching por patrón: `PreToolUse:Bash(git *)` ejecuta solo para comandos git
- Async hooks que se ejecutan en background
- Trust requirement para seguridad
- JSON output schema para control flow (approve/block/continue)

**Implementación para Termimate:**
```
Fase 1: Hooks básicos
- PreToolUse: ejecutar script antes de cada tool call
- PostToolUse: ejecutar script después de cada tool call
- Configuración en .termimate/hooks.json o settings

Fase 2: Hooks como guardrails
- Pre-Bash: validar comando contra lista de patrones peligrosos
- Pre-FileWrite: backup automático antes de sobreescribir
- Post-Bash: capturar exit codes y alertar errores
```

---

### 9. Nuevas Tools

Claude Code tiene 30+ tools. Las más útiles que faltan en Termimate:

| Tool | Descripción | Prioridad |
|------|-------------|-----------|
| **FileEditTool** | Edición quirúrgica (old_string → new_string) sin reescribir todo el archivo | Alta |
| **GrepTool** | Búsqueda regex en el codebase con ripgrep | Alta |
| **GlobTool** | Búsqueda de archivos por patrón glob | Alta |
| **AskUserQuestionTool** | El agente puede hacer preguntas al usuario | Media |
| **TodoWriteTool** | Gestión de TODOs/tareas persistentes | Media |
| **WebSearchTool** | Búsqueda web (no solo fetch, sino search) | Media |
| **LSPTool** | Integración con Language Server Protocol | Baja |
| **NotebookEditTool** | Edición de Jupyter notebooks | Baja |

**FileEditTool es crítico** — actualmente `FileWriteTool` reescribe el archivo completo, lo cual:
- Consume muchos tokens (el LLM debe generar todo el contenido)
- Es propenso a errores (puede perder contenido)
- Es lento para archivos grandes

```typescript
// Interfaz propuesta para FileEditTool:
{
  name: "file_edit",
  inputSchema: z.object({
    file_path: z.string(),
    old_string: z.string().describe("Texto exacto a reemplazar"),
    new_string: z.string().describe("Texto nuevo"),
  }),
  requiresConfirmation: true,
}
```

---

### 10. Memoria de Sesión y Extracción Automática

**Cómo lo hace Claude Code:**
- `services/SessionMemory/` — Almacena memorias extraídas de conversaciones
- `services/extractMemories/` — Extrae automáticamente insights, preferencias, patrones
- `services/teamMemorySync/` — Sincronización de memoria entre sesiones
- Las memorias se inyectan en el system prompt de futuras sesiones

**Implementación para Termimate:**
```
1. Nuevo modelo "SessionMemory" en la DB:
   { id, sessionId, projectId, key, content, createdAt }

2. Al finalizar una sesión (o al compactar):
   - Enviar historial al LLM con prompt de extracción
   - Almacenar insights como memorias del proyecto

3. En futuras sesiones:
   - Inyectar memorias relevantes en el system prompt
   - Sección "[Project Memories]" con contexto previo
```

---

### 11. Token Estimation y Barra de Uso Real

**Problema actual:** La barra de tokens en ChatInput muestra `tokensUsed` del store pero no hay tracking real en el backend.

**Cómo lo hace Claude Code:** `utils/tokens.ts` + `services/tokenEstimation.ts`:
- Estimación por encoding del modelo (cl100k_base para Claude, etc.)
- Tracking acumulativo por turno
- `tokenBudget.ts` permite al usuario especificar presupuesto ("+500k", "use 2M tokens")
- Warnings visuales al 80%, 90% y bloqueo al 95%

**Implementación:**
```
1. Enviar token counts desde el provider (la mayoría de APIs devuelven usage)
2. Acumular en el agentStore: inputTokens, outputTokens, totalTokens
3. Calcular % de ventana de contexto del modelo seleccionado
4. Actualizar la barra de progreso con colores (verde → amarillo → rojo)
```

---

### 12. Retry/Backoff en Llamadas LLM

**Problema actual:** Sin manejo de errores transitorios en API calls. Un 429 o 503 mata la conversación.

**Cómo lo hace Claude Code:** `services/api/` implementa retry con exponential backoff, rate limit handling, y circuit breakers.

**Implementación:**
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries) throw error;
      if (isRateLimitError(error)) {
        const delay = getRetryAfter(error) || Math.pow(2, i) * 1000;
        await sleep(delay);
      } else if (isTransientError(error)) {
        await sleep(Math.pow(2, i) * 500);
      } else {
        throw error; // Non-retryable
      }
    }
  }
}
```

---

## P3 — Mejoras de Menor Prioridad

### 13. Modo Plan (Read-Only Exploration)

Claude Code tiene `EnterPlanModeTool`/`ExitPlanModeTool` que restringen al agente a solo tools de lectura. Útil para exploración del codebase sin riesgo de modificaciones.

**Para Termimate:** Añadir un toggle en el UI que filtre `enabledTools` a solo `file_list`, `file_read`, `terminal_read`, `web_fetch`.

---

### 14. Soporte MCP (Model Context Protocol)

Claude Code tiene integración completa con MCP servers (`services/mcp/`, `tools/MCPTool/`, `tools/ListMcpResourcesTool/`). MCP permite conectar herramientas externas estandarizadas.

**Para Termimate:** Considerar soporte MCP básico para conectar con herramientas de terceros (databases, APIs, CI/CD).

---

### 15. Streaming Error Recovery

**Problema actual:** Si el stream del LLM falla mid-response, no hay limpieza de mensajes parciales ni retry.

**Implementación:**
```
1. Marcar mensajes como "streaming" mientras se reciben
2. Si el stream falla:
   a. Eliminar mensaje parcial de la DB
   b. Mostrar error al usuario con opción de reintentar
   c. Auto-retry si es error transitorio (con backoff)
3. Si el stream se completa OK, desmarcar como "streaming"
```

---

## Arquitectura Propuesta Post-Mejoras

```
src/main/agent/
├── AgentExecutor.ts          (mejorado: formato nativo, parallel tools)
├── SubAgentExecutor.ts       (nuevo: ejecución de sub-agentes)
├── context/
│   ├── TokenEstimator.ts     (nuevo: estimación de tokens)
│   ├── ContextCompactor.ts   (nuevo: compactación automática)
│   └── CompactPrompts.ts     (nuevo: prompts de compactación)
├── hooks/
│   ├── HookExecutor.ts       (nuevo: ejecución de hooks)
│   ├── HookTypes.ts          (nuevo: tipos de eventos)
│   └── HookConfig.ts         (nuevo: configuración)
├── providers/                (sin cambios mayores)
├── tools/
│   ├── FileEditTool.ts       (nuevo: edición quirúrgica)
│   ├── GrepTool.ts           (nuevo: búsqueda regex)
│   ├── GlobTool.ts           (nuevo: búsqueda por patrón)
│   ├── AskUserTool.ts        (nuevo: preguntas al usuario)
│   ├── AgentSpawnTool.ts     (nuevo: spawning de sub-agentes)
│   └── ... (existentes)
└── permissions/
    ├── BashClassifier.ts     (nuevo: clasificación de comandos)
    └── ApprovalManager.ts    (nuevo: gestión de approval levels)
```

---

## Roadmap Sugerido

### Sprint 1 (Fundamentos — P0)
- [ ] Fix cancelación de streams (#3)
- [ ] Fix seguridad path traversal (#4)
- [ ] Formato nativo tool_use/tool_result (#1)
- [ ] Token estimation básica (#11 parcial)

### Sprint 2 (Contexto — P0/P1)
- [ ] Context window management (#2)
- [ ] Auto-compact básico (#2)
- [ ] Retry/backoff en API calls (#12)
- [ ] Approval levels funcionales (#6)

### Sprint 3 (Tools — P1/P2)
- [ ] FileEditTool (#9)
- [ ] GrepTool + GlobTool (#9)
- [ ] Ejecución paralela de tools (#5)
- [ ] Streaming error recovery (#15)

### Sprint 4 (Agentes — P1/P2)
- [ ] Sub-agentes básicos (#7)
- [ ] AskUserTool (#9)
- [ ] Memoria de sesión (#10)

### Sprint 5 (Extensibilidad — P2/P3)
- [ ] Hooks system básico (#8)
- [ ] Modo Plan (#13)
- [ ] MCP básico (#14)

---

## Referencias

- **Fuente de análisis:** [ChinaSiro/claude-code-sourcemap](https://github.com/ChinaSiro/claude-code-sourcemap) (v2.1.88)
- **Nota legal:** El código fuente de Claude Code es propiedad de Anthropic. Este documento es un análisis arquitectónico para fines de estudio técnico.
- **Fecha de análisis:** 2 de Abril de 2026
