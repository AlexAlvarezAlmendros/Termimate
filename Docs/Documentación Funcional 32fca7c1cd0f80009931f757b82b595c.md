# Documentación Funcional

**Versión:** 1.0.0-draft

**Fecha:** Marzo 2026

**Estado:** Draft inicial

---

## Tabla de contenidos

1. [Propósito del producto](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#1-prop%C3%B3sito-del-producto)
2. [Usuarios objetivo](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#2-usuarios-objetivo)
3. [Mapa de funcionalidades](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#3-mapa-de-funcionalidades)
4. [Estructura de la interfaz](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#4-estructura-de-la-interfaz)
5. [Módulo: Sesiones de terminal](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#5-m%C3%B3dulo-sesiones-de-terminal)
6. [Módulo: Sistema de proyectos](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#6-m%C3%B3dulo-sistema-de-proyectos)
7. [Módulo: Agente IA](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#7-m%C3%B3dulo-agente-ia)
8. [Módulo: Panel de agentes](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#8-m%C3%B3dulo-panel-de-agentes)
9. [Módulo: Configuración global](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#9-m%C3%B3dulo-configuraci%C3%B3n-global)
10. [Flujos de usuario principales](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#10-flujos-de-usuario-principales)
11. [Estados y comportamientos del sistema](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#11-estados-y-comportamientos-del-sistema)
12. [Casos límite y manejo de errores](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#12-casos-l%C3%ADmite-y-manejo-de-errores)
13. [Criterios de aceptación por módulo](https://claude.ai/chat/6eab70eb-c923-4a1e-87eb-541e440d6962#13-criterios-de-aceptaci%C3%B3n-por-m%C3%B3dulo)

---

## 1. Propósito del producto

Termimate es una aplicación de escritorio para Linux diseñada para reemplazar la terminal del sistema del desarrollador. Combina un emulador de terminal completo con un agente de inteligencia artificial contextual que opera en el mismo espacio de trabajo, con acceso real al proyecto activo.

### Qué es

- Un emulador de terminal completo y funcional que puede sustituir a herramientas como GNOME Terminal, Alacritty o Kitty.
- Un sistema de agentes IA integrado que conoce el contexto del proyecto en el que el usuario está trabajando.
- Una herramienta de gestión de sesiones y proyectos que organiza el trabajo del usuario.

### Qué no es

- **No es un IDE.** No edita código, no tiene árbol de archivos, no gestiona extensiones.
- **No es un chatbot genérico.** El agente tiene contexto real del proyecto: sabe qué archivos hay, puede leerlos, puede ejecutar comandos.
- **No es un wrapper de IA sobre la terminal.** El agente opera en un panel separado. La terminal es libre, el agente no la instrumentaliza ni intercepta comandos.

### Propuesta de valor central

El desarrollador trabaja en la terminal con total libertad. Cuando necesita ayuda, el agente ya sabe dónde está, qué proyecto tiene abierto y qué hay en el código. No hay que copiar y pegar contexto, no hay que cambiar de ventana, no hay que explicar de cero.

---

## 2. Usuarios objetivo

### Perfil principal: Desarrollador backend / fullstack

- Vive en la terminal: git, docker, ssh, scripts, deploys.
- Utiliza múltiples proyectos simultáneamente con diferentes stacks.
- Ya usa herramientas de IA (ChatGPT, Claude, Copilot) pero el flujo de copiar/pegar contexto es costoso.
- Valora la velocidad y el control sobre la "magia" de los IDEs.

### Perfil secundario: DevOps / SRE

- Gestiona múltiples servidores y entornos.
- Necesita contexto rápido sobre lo que está pasando en el terminal sin salir de él.
- Valora que el agente pueda leer outputs de comandos sin intervención manual.

### Lo que el usuario espera

| Expectativa | Implicación funcional |
| --- | --- |
| La terminal se comporta exactamente igual que su terminal actual | stdin/stdout nativo sin modificaciones, soporte completo de colores ANSI, atajos de teclado estándar |
| El agente responde con contexto real, no genérico | El agente tiene acceso al proyecto, a los archivos y al output del terminal |
| Saber exactamente qué hace el agente en todo momento | Todas las acciones del agente son visibles y auditables en el chat |
| Ninguna acción destructiva sin confirmación explícita | Cualquier ejecución de comandos requiere aprobación del usuario |

---

## 3. Mapa de funcionalidades

```
TERMIMATE
│
├── SESIONES DE TERMINAL
│   ├── Crear nueva sesión
│   ├── Cambiar entre sesiones (pestañas)
│   ├── Cerrar sesión
│   ├── Renombrar sesión
│   ├── Asociar sesión a proyecto
│   └── Resize del panel de terminal
│
├── SISTEMA DE PROYECTOS
│   ├── Crear proyecto
│   ├── Editar proyecto (nombre, icono, color, ruta raíz)
│   ├── Eliminar proyecto
│   ├── Instrucciones personalizadas para el agente
│   ├── Documentos adjuntos
│   │   ├── Adjuntar archivo
│   │   └── Eliminar documento adjunto
│   └── Asignar agente por defecto
│
├── AGENTE IA (por sesión)
│   ├── Enviar mensaje al agente
│   ├── Recibir respuesta en streaming
│   ├── Visualizar tool calls inline
│   ├── Aprobar / rechazar ejecución de comandos bash
│   ├── Adjuntar archivo al mensaje
│   ├── Cambiar modelo LLM activo
│   ├── Ver indicador de tokens consumidos
│   ├── Autorizar lectura del output del terminal
│   └── Historial de conversación por sesión
│
├── PANEL DE AGENTES
│   ├── Listar agentes configurados
│   ├── Crear agente personalizado
│   ├── Editar agente (nombre, system prompt, modelo base)
│   ├── Configurar herramientas del agente
│   ├── Ver historial de uso y tokens
│   └── Eliminar agente
│
└── CONFIGURACIÓN GLOBAL
    ├── Claves API (Anthropic, OpenAI)
    ├── Tema visual
    ├── Shell por defecto
    ├── Fuente y tamaño de terminal
    ├── Atajos de teclado
    └── Perfil de usuario
```

---

## 4. Estructura de la interfaz

La aplicación tiene una estructura de tres zonas fijas:

```html
<!DOCTYPE html><html class="dark" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Synthetic Architect | Command Center</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;family=Fira+Code:wght@400;500&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-primary-fixed": "#001d33",
                        "inverse-on-surface": "#313030",
                        "tertiary-container": "#d19000",
                        "background": "#131313",
                        "surface-dim": "#131313",
                        "primary-container": "#00a3ff",
                        "on-error": "#690005",
                        "surface-container-highest": "#353534",
                        "on-secondary-fixed-variant": "#0c5300",
                        "tertiary-fixed-dim": "#ffba43",
                        "secondary-fixed-dim": "#34e507",
                        "on-background": "#e5e2e1",
                        "primary-fixed-dim": "#98cbff",
                        "surface-container": "#201f1f",
                        "on-primary-fixed-variant": "#004a77",
                        "outline": "#88919d",
                        "outline-variant": "#3f4852",
                        "surface-container-low": "#1c1b1b",
                        "inverse-primary": "#00629d",
                        "on-primary-container": "#00375a",
                        "primary-fixed": "#cfe5ff",
                        "on-tertiary-fixed": "#281800",
                        "surface": "#131313",
                        "on-secondary-container": "#0f5e00",
                        "secondary-fixed": "#79ff59",
                        "on-tertiary-container": "#482f00",
                        "secondary": "#5dff3b",
                        "error-container": "#93000a",
                        "on-surface-variant": "#bec7d4",
                        "tertiary": "#ffba43",
                        "error": "#ffb4ab",
                        "surface-bright": "#393939",
                        "surface-tint": "#98cbff",
                        "primary": "#98cbff",
                        "surface-container-high": "#2a2a2a",
                        "surface-variant": "#353534",
                        "secondary-container": "#30e200",
                        "tertiary-fixed": "#ffddaf",
                        "on-secondary": "#063900",
                        "on-surface": "#e5e2e1",
                        "inverse-surface": "#e5e2e1",
                        "on-tertiary": "#432c00",
                        "on-primary": "#003354",
                        "on-error-container": "#ffdad6",
                        "on-tertiary-fixed-variant": "#614000",
                        "on-secondary-fixed": "#022100",
                        "surface-container-lowest": "#0e0e0e"
                    },
                    fontFamily: {
                        "headline": ["Space Grotesk"],
                        "body": ["Inter"],
                        "label": ["Inter"],
                        "mono": ["Fira Code", "monospace"]
                    },
                    borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        .terminal-scroll::-webkit-scrollbar {
            width: 4px;
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
            background: #3F4852;
            border-radius: 10px;
        }
        .glass-panel {
            background: rgba(42, 42, 42, 0.6);
            backdrop-filter: blur(12px);
        }
    </style>
</head>
<body class="bg-background text-on-background font-body selection:bg-primary/30 h-screen overflow-hidden">
<!-- Top Navigation Bar -->
<header class="fixed top-0 left-0 right-0 z-50 bg-[#131313] transition-colors flex items-center justify-between px-6 py-2 w-full border-b border-outline-variant/10">
<div class="flex items-center gap-4">
<span class="font-['Space_Grotesk'] text-lg font-bold text-[#98CBFF]" style="">TermiMate</span>
</div>
<nav class="flex items-center gap-1 bg-surface-container-lowest rounded-lg p-1">
<button class="px-4 py-1.5 text-sm font-['Space_Grotesk'] uppercase tracking-widest text-[#00A3FF] border-b-2 border-[#00A3FF]" style="">Session 1</button>
<button class="px-4 py-1.5 text-sm font-['Space_Grotesk'] uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors" style="">Session 2</button>
<button class="px-4 py-1.5 text-sm font-['Space_Grotesk'] uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors" style="">Agent Chat</button>
</nav>
<div class="flex items-center gap-4 text-[#98CBFF]">
<button class="p-2 hover:bg-[#2A2A2A] rounded-md transition-all active:opacity-80 scale-95 duration-100" style="">
<span class="material-symbols-outlined" data-icon="terminal" style="">terminal</span>
</button>
<button class="p-2 hover:bg-[#2A2A2A] rounded-md transition-all active:opacity-80 scale-95 duration-100" style="">
<span class="material-symbols-outlined" data-icon="settings" style="">settings</span>
</button>
</div>
</header>
<div class="flex h-full pt-12">
<!-- Sidebar Navigation -->
<aside class="fixed left-0 top-12 h-[calc(100%-3rem)] w-64 bg-[#1C1B1B] flex flex-col py-4 shadow-inner border-r border-outline-variant/5">
<div class="px-4 mb-6">
<div class="flex flex-col gap-2">
<button class="flex items-center gap-3 px-3 py-2 bg-primary text-on-primary font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all" style="">
<span class="material-symbols-outlined" data-icon="add" style="">add</span>
<span class="text-sm" style="">New Session</span>
</button>
<button class="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-[#2A2A2A]/50 rounded-lg transition-colors" style="">
<span class="material-symbols-outlined" data-icon="smart_toy" style="">smart_toy</span>
<span class="text-sm" style="">Agents</span>
</button>
</div>
</div>
<div class="flex-1 overflow-y-auto px-2 space-y-6">
<!-- Projects Section -->
<div>
<h3 class="px-4 mb-2 text-[10px] uppercase tracking-[0.2em] text-outline font-bold" style="">Projects</h3>
<div class="space-y-1">
<div class="group flex items-center justify-between px-3 py-2 bg-[#2A2A2A] text-[#00A3FF] font-semibold rounded-lg mx-2 cursor-pointer">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-sm" data-icon="folder" style="">folder</span>
<span class="text-xs" style="">Web Development</span>
</div>
<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-[14px]" data-icon="description" style="">description</span>
<span class="material-symbols-outlined text-[14px]" data-icon="rule" style="">rule</span>
</div>
</div>
<div class="group flex items-center justify-between px-3 py-2 text-slate-500 hover:bg-[#2A2A2A]/50 mx-2 rounded-lg cursor-pointer">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-sm" data-icon="folder" style="">folder</span>
<span class="text-xs" style="">Infrastructure</span>
</div>
<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-[14px]" data-icon="description" style="">description</span>
<span class="material-symbols-outlined text-[14px]" data-icon="rule" style="">rule</span>
</div>
</div>
</div>
</div>
<!-- History Section -->
<div>
<h3 class="px-4 mb-2 text-[10px] uppercase tracking-[0.2em] text-outline font-bold" style="">HISTORY</h3>
<div class="space-y-1">
<div class="px-3 py-2 text-slate-500 hover:bg-[#2A2A2A]/50 mx-2 rounded-lg cursor-pointer text-xs flex items-center gap-3">
<span class="material-symbols-outlined text-sm" data-icon="history" style="">history</span>
<span class="" style="">Fix: Auth Middleware</span>
</div>
<div class="px-3 py-2 text-slate-500 hover:bg-[#2A2A2A]/50 mx-2 rounded-lg cursor-pointer text-xs flex items-center gap-3">
<span class="material-symbols-outlined text-sm" data-icon="history" style="">history</span>
<span class="" style="">Refactor: DB Schema</span>
</div>
</div>
</div>
</div>
<!-- Sidebar Footer -->
<div class="mt-auto pt-4 border-t border-outline-variant/10 px-2 space-y-1">
<div class="flex items-center gap-3 px-3 py-2 text-slate-500 hover:bg-[#2A2A2A]/50 rounded-lg cursor-pointer transition-colors">
<span class="material-symbols-outlined" data-icon="settings" style="">settings</span>
<span class="text-sm" style="">Settings</span>
</div>
<div class="flex items-center gap-3 px-3 py-2 text-slate-500 hover:bg-[#2A2A2A]/50 rounded-lg cursor-pointer transition-colors">
<div class="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-[10px] text-on-primary-container font-bold" style="">SA</div>
<span class="text-sm" style="">Architect Admin</span>
</div>
</div>
</aside>
<!-- Main Workspace -->
<main class="ml-64 flex-1 flex flex-col p-6 gap-6 h-full overflow-hidden bg-surface-dim">
<div class="flex gap-6 h-full">
<!-- Terminal Interface -->
<section class="flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shadow-2xl">
<!-- Terminal Header -->
<div class="bg-surface-container-low px-4 py-2 flex items-center justify-between border-b border-outline-variant/5">
<div class="flex gap-2">
<div class="w-3 h-3 rounded-full bg-error/40"></div>
<div class="w-3 h-3 rounded-full bg-tertiary/40"></div>
<div class="w-3 h-3 rounded-full bg-secondary/40"></div>
</div>
<span class="text-[10px] font-mono text-outline uppercase tracking-widest" style="">zsh — session_842.log</span>
<div class="w-12"></div>
</div>
<!-- Terminal Body -->
<div class="flex-1 p-4 font-mono text-sm overflow-y-auto terminal-scroll space-y-3">
<div class="flex gap-3">
<span class="text-secondary" style="">➜</span>
<span class="text-primary-fixed-dim" style="">~/projects/web-dev</span>
<span class="text-on-surface-variant" style="">git status</span>
</div>
<div class="text-on-surface-variant/70 pl-6 leading-relaxed" style="">
                            On branch <span class="text-secondary" style="">main</span><br>
                            Your branch is up to date with 'origin/main'.<br><br>
                            Changes not staged for commit:<br>
                            &nbsp;&nbsp;(use "git add &lt;file&gt;..." to update what will be committed)<br>
                            &nbsp;&nbsp;<span class="text-error" style="">modified:   src/components/Navigation.tsx</span><br>
                            &nbsp;&nbsp;<span class="text-error" style="">modified:   tailwind.config.js</span>
</div>
<div class="flex gap-3">
<span class="text-secondary" style="">➜</span>
<span class="text-primary-fixed-dim" style="">~/projects/web-dev</span>
<span class="text-on-surface-variant" style="">npm run build</span>
</div>
<div class="text-secondary-fixed-dim pl-6" style="">
                            [BUILD SUCCESS] Process finished in 1.4s
                        </div>
<div class="flex items-center gap-3">
<span class="text-secondary" style="">➜</span>
<span class="text-primary-fixed-dim" style="">~/projects/web-dev</span>
<div class="w-2 h-5 bg-primary-fixed-dim animate-pulse"></div>
</div>
</div>
<!-- Command Bar -->
<div class="p-4 bg-surface-container-high/30">
<div class="relative">
<input class="w-full bg-surface-container-highest border-none rounded-lg py-3 pl-4 pr-12 text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-outline/50" placeholder="Type a command or ask the architect..." type="text">
<div class="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
<span class="material-symbols-outlined text-primary-container cursor-pointer hover:text-primary" data-icon="bolt" style="">bolt</span>
</div>
</div>
</div>
</section>
<!-- AI Assistant Sidebar -->
<aside class="w-80 flex flex-col gap-4">
<!-- Agent Info Card -->
<div class="bg-surface-container-high rounded-xl p-5 border border-outline-variant/10 shadow-lg">
<div class="flex items-center gap-3 mb-4">
<div class="relative">
<img class="w-10 h-10 rounded-lg object-cover" data-alt="close-up portrait of a sleek humanoid robotic head with glowing blue optic sensors and polished metallic surfaces" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBaz3_iQ7rQwT47gJAPu328gMSY40mU9dvg8buMpXjUT0iQhlWG1VP3XSrYYxQKesyfFCid2GV9aKz8cAQX9O8jdRdcpYnmhBxnZEY9n1zKKFU5-f4oUnhKWggrLfF8oh9-tho1OzyumQnkDSfQdS-ZXg-SvXLsWnhrseoOoxHEWlcLCxEaTffXy1RRys0qnjUzGCW5eNOhZ0s3B4RK6WKVlbmpnf_78xw6S-KnquGZ47_aTuNJSodggxIDE9tlPrQlRCJduwshadk" style="">
<div class="absolute -bottom-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-surface-container-high"></div>
</div>
<div>
<h2 class="text-sm font-bold font-headline text-primary" style="">Architect v2.1</h2>
<p class="text-[10px] text-outline uppercase tracking-wider" style="">Model: GPT-4o-Turbo</p>
</div>
</div>
<div class="space-y-3">
<div class="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/5">
<p class="text-xs text-on-surface-variant leading-relaxed" style="">
                                    I noticed you're updating the navigation component. Should I suggest a responsive layout pattern for the mobile view?
                                </p>
</div>
<div class="flex gap-2">
<button class="flex-1 py-1.5 text-[10px] font-bold bg-primary-container/20 text-primary-fixed-dim border border-primary-container/30 rounded-md hover:bg-primary-container/30 transition-all uppercase tracking-widest" style="">Approve</button>
<button class="flex-1 py-1.5 text-[10px] font-bold bg-surface-bright/50 text-outline border border-outline-variant/20 rounded-md hover:bg-surface-bright transition-all uppercase tracking-widest" style="">Ignore</button>
</div>
</div>
</div>
<!-- Suggestions Grid -->
<div class="flex-1 space-y-3 overflow-y-auto pr-1">
<div class="group p-4 bg-surface-container-low hover:bg-surface-container rounded-xl border border-outline-variant/5 cursor-pointer transition-all">
<div class="flex items-center gap-2 mb-2">
<span class="material-symbols-outlined text-secondary text-lg" data-icon="auto_awesome" style="">auto_awesome</span>
<span class="text-[10px] font-bold text-outline uppercase tracking-widest" style="">Refactor Suggestion</span>
</div>
<p class="text-xs text-on-surface mb-3 line-clamp-2" style="">Optimize the loop in `AuthMiddleware.ts` to reduce O(n) complexity.</p>
<div class="flex justify-between items-center">
<span class="text-[10px] text-tertiary" style="">+12% Performance</span>
<span class="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity" data-icon="arrow_forward" style="">arrow_forward</span>
</div>
</div>
<div class="group p-4 bg-surface-container-low hover:bg-surface-container rounded-xl border border-outline-variant/5 cursor-pointer transition-all">
<div class="flex items-center gap-2 mb-2">
<span class="material-symbols-outlined text-primary text-lg" data-icon="schema" style="">schema</span>
<span class="text-[10px] font-bold text-outline uppercase tracking-widest" style="">Infrastructure Check</span>
</div>
<p class="text-xs text-on-surface mb-3 line-clamp-2" style="">The docker-compose.yml file is missing the Redis volume mapping.</p>
<div class="flex justify-between items-center">
<span class="text-[10px] text-primary" style="">Reliability Fix</span>
<span class="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity" data-icon="arrow_forward" style="">arrow_forward</span>
</div>
</div>
</div>
<!-- Stats / Context Glass Panel -->
<div class="glass-panel p-4 rounded-xl border border-white/5 space-y-2">
<div class="flex justify-between text-[10px] font-mono text-outline">
<span class="" style="">CONTEXT WINDOW</span>
<span class="text-primary" style="">82%</span>
</div>
<div class="w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
<div class="bg-primary h-full w-[82%]"></div>
</div>
<div class="flex justify-between text-[10px] font-mono text-outline pt-2">
<span class="" style="">ACTIVE TOKENS</span>
<span class="" style="">12.4k</span>
</div>
</div>
</aside>
</div>
</main>
</div>
<!-- Floating Action Element -->
</body></html>
```

### 4.1 Topbar

Barra superior fija presente en todo momento. Contiene:

- **Wordmark** "Termimate" — posición fija a la izquierda. No es interactivo en v1.
- **Pestañas de sesión** — centradas horizontalmente. Cada pestaña muestra el nombre de la sesión y un indicador de estado circular:
    - 🟢 Verde: sesión activa (visible en el panel terminal)
    - 🔵 Azul: sesión en background (proceso corriendo, no visible)
    - 🟡 Ámbar: sesión con advertencia (proceso terminado inesperadamente, error de conexión)
- **Botón "+"** — a la derecha de la última pestaña. Crea una nueva sesión sin proyecto.
- **Pestaña Chat** — a la derecha de la última pestaña. Abre una pantalla de chat donde sale el historial de mensajes.

**Comportamiento de pestañas:**

- Click en pestaña → activa esa sesión en el panel terminal
- Click en "×" de la pestaña → solicita confirmación si hay proceso activo; cierra sin confirmación si el shell está en idle
- Click derecho en pestaña → menú contextual: Renombrar, Duplicar, Mover a proyecto, Cerrar

### 4.2 Sidenav

Navegación lateral izquierda de ancho fijo (colapsable en iteraciones futuras). Cuatro bloques verticales:

**Bloque superior:**

- Botón **"Nueva sesión"** (icono +) — crea sesión sin proyecto asignado
- Botón **"Panel de agentes"** (icono robot) — navega al panel de gestión de agentes

**Bloque central superior — Proyectos:**

- Lista de proyectos, cada uno colapsable
- Cada proyecto muestra su icono con color identificativo y nombre
- Al expandir, lista las sesiones asociadas al proyecto
- Click en sesión → la activa en el panel terminal y la selecciona en la topbar
- Click derecho en proyecto → menú: Editar, Nueva sesión en este proyecto, Eliminar
- Indicador visual en el proyecto si alguna de sus sesiones tiene estado ámbar

**Bloque central inferior — Sin proyecto:**

- Lista de sesiones sin proyecto asignado
- Comportamiento idéntico al anterior, sin agrupación

**Bloque inferior:**

- Avatar del usuario (iniciales si no hay imagen)
- Nombre y rol del usuario
- Botón de configuración (engranaje) → abre configuración global

### 4.3 Área principal

Dividida verticalmente en dos paneles redimensionables mediante un divisor arrastrable:

- **Panel superior:** emulador de terminal. Ocupa por defecto el 65% del área.
- **Panel inferior:** panel del agente IA. Ocupa por defecto el 35%.
- El divisor puede arrastrarse para ajustar la proporción. Los límites son: terminal mínimo 25%, agente mínimo 20%.
- Doble click en el divisor → restaura la proporción por defecto (65/35).

---

## 5. Módulo: Sesiones de terminal

### 5.1 Qué es una sesión

Una sesión es una instancia de terminal activa. Cada sesión corre un proceso shell independiente (bash, zsh o fish, según configuración). Las sesiones persisten entre reinicios de la aplicación: si el usuario cierra Termimate con sesiones abiertas, al volver aparecen las mismas sesiones (aunque el proceso shell no persiste, se reinicia en el mismo directorio).

### 5.2 Creación de sesión

**Desde la topbar:** click en el botón "+". Crea una sesión sin proyecto en el directorio home del usuario.

**Desde la sidenav:** click en "Nueva sesión" → crea sesión sin proyecto. Click derecho en proyecto → "Nueva sesión en este proyecto" → crea sesión con ese proyecto asignado, con el CWD establecido en la ruta raíz del proyecto.

**Parámetros de una sesión nueva:**

- Nombre autogenerado: "sesión N" donde N es el número correlativo
- Shell: el definido en configuración global
- CWD: home del usuario (sin proyecto) o ruta raíz del proyecto (con proyecto)

### 5.3 Comportamiento del terminal

El panel de terminal es un emulador VT100/xterm completo. Soporta:

- Colores ANSI de 256 colores y true color
- Cursor posicionado (aplicaciones como `vim`, `htop`, `tmux`)
- Historial de scroll con ratón y teclado
- Selección de texto con ratón y copia al portapapeles
- Click en URLs detectadas (abre en el navegador del sistema)
- Búsqueda en el buffer del terminal (Ctrl+Shift+F)
- Resize dinámico: al redimensionar el panel, el terminal se ajusta automáticamente

**Atajos por defecto en el terminal:**

| Atajo | Acción |
| --- | --- |
| Ctrl+Shift+C | Copiar selección |
| Ctrl+Shift+V | Pegar |
| Ctrl+Shift+F | Buscar en buffer |
| Ctrl+Shift+T | Nueva sesión |
| Ctrl+Tab | Siguiente sesión |
| Ctrl+Shift+Tab | Sesión anterior |
| Ctrl+Shift+W | Cerrar sesión activa |

> Todos los atajos son personalizables en Configuración global.
> 

### 5.4 Estados de una sesión

| Estado | Indicador | Descripción |
| --- | --- | --- |
| **Activa** | 🟢 Verde | Sesión visible en el panel principal, proceso shell corriendo |
| **Background** | 🔵 Azul | Sesión no visible, proceso corriendo (por ejemplo, un servidor de desarrollo) |
| **Advertencia** | 🟡 Ámbar | El proceso shell terminó inesperadamente (exit code ≠ 0) o hay un error de pty |
| **Idle** | Sin indicador especial | Shell activo pero sin proceso en primer plano |

### 5.5 Cierre de sesión

- Si el shell está en **idle**: cierre inmediato sin confirmación.
- Si hay un **proceso activo**: diálogo de confirmación "Hay un proceso activo en esta sesión. ¿Cerrar igualmente?". Opciones: Cancelar / Cerrar y terminar proceso.
- Al cerrar la sesión, su historial de chat con el agente se preserva en la base de datos y es accesible desde el historial de la sidenav.

---

## 6. Módulo: Sistema de proyectos

### 6.1 Qué es un proyecto

Un proyecto agrupa sesiones de terminal bajo un contexto común. El elemento clave es que el agente IA de cada sesión perteneciente a un proyecto tiene acceso al contexto de ese proyecto: su ruta raíz, sus documentos adjuntos y sus instrucciones personalizadas.

Un proyecto no gestiona código ni archivos directamente. Apunta a un directorio existente en el filesystem del usuario.

### 6.2 Creación de proyecto

**Acceso:** click derecho en el área de proyectos de la sidenav → "Nuevo proyecto", o desde el menú contextual de una sesión sin proyecto → "Mover a proyecto" → "Nuevo proyecto".

**Campos del formulario de creación:**

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| Nombre | Texto | Sí | Nombre identificativo. Máx. 50 caracteres |
| Icono | Selector emoji | No | Emoji representativo. Por defecto: 📁 |
| Color | Selector color | No | Color del indicador en la sidenav. Por defecto: gris |
| Ruta raíz | Selector de directorio | Sí | Directorio raíz del proyecto en el filesystem |
| Instrucciones | Textarea | No | Instrucciones para el agente IA |
| Agente por defecto | Selector | No | Agente IA asignado a las sesiones de este proyecto |

### 6.3 Instrucciones personalizadas

Es un bloque de texto libre (markdown soportado) que el desarrollador usa para describir el proyecto al agente. Se incluye en el system prompt de cada conversación de las sesiones del proyecto.

**Qué puede incluir:**

- Descripción del proyecto y su propósito
- Stack tecnológico (lenguajes, frameworks, herramientas)
- Convenciones de código (naming, estructura de carpetas)
- Restricciones (qué archivos no debe leer el agente, qué no debe modificar)
- Contexto de negocio relevante
- Cómo ejecutar tests, cómo hacer deploy

**Ejemplo de instrucciones:**

```
Este es el backend de la API de pagos. Stack: Node.js 22 + Express + TypeScript.
Base de datos: PostgreSQL con Prisma ORM.
Los controladores están en src/controllers, los servicios en src/services.
Nunca toques los archivos en src/migrations directamente.
Para correr los tests: npm test. Para dev: npm run dev (puerto 3001).
```

### 6.4 Documentos adjuntos

El usuario puede adjuntar archivos al proyecto que el agente podrá leer cuando sea relevante. Son referencias a archivos existentes en el sistema (no se copian).

**Tipos soportados:** markdown, texto plano, PDF, código fuente de cualquier lenguaje, diagramas (PNG, SVG), JSON, YAML.

**Comportamiento:** el agente no carga todos los documentos automáticamente en cada conversación. Los documentos se listan en el system prompt; el agente usa la herramienta `file_read` para leer un documento específico cuando lo necesita.

**Límites:** máximo 20 documentos adjuntos por proyecto en v1.

**Gestión:**

- Botón "Adjuntar documento" → abre selector de archivos del sistema
- Click derecho en documento → "Eliminar de la lista" (no elimina el archivo del disco)

### 6.5 Edición y eliminación

**Editar:** click derecho en proyecto → "Editar proyecto" → mismo formulario de creación con los campos precargados.

**Eliminar proyecto:** click derecho → "Eliminar proyecto". Diálogo de confirmación. Al eliminar un proyecto, las sesiones asociadas no se eliminan: pasan al historial general sin proyecto asignado. Los documentos adjuntos no se eliminan del disco.

---

## 7. Módulo: Agente IA

### 7.1 Principio de operación

El agente tendra acceso total al terminal, podra ver editar escribir copiar y pegar contenido, las operaciones sensibles pediran verificacion al usuario..

Lo que el agente puede hacer está definido por sus herramientas (tools) y siempre queda visible en el chat.

### 7.2 Interfaz del panel de agente

**Barra del panel:**

- Selector de agente activo (desplegable con los agentes configurados)
- Selector de modelo LLM (modelos disponibles según el proveedor del agente)
- Indicador de contexto: `4.2k / 200k tokens`
- Botón de limpieza de conversación (icono de papelera con confirmación)

**Área de mensajes:**

- Historial de conversación en orden cronológico
- Mensajes del usuario alineados a la derecha
- Mensajes del agente alineados a la izquierda
- Tool calls incrustados inline entre los mensajes del agente (ver sección 7.4)
- Scroll automático al nuevo mensaje; el usuario puede scrollear hacia arriba libremente

**Input:**

- Campo de texto de una sola línea (expandible con Shift+Enter para multilinea)
- Botón de adjuntar archivo (📎) — adjunta un archivo a ese mensaje específico
- Botón de enviar (→) o Enter para enviar
- Estado visual de "el agente está respondiendo" con indicador de carga y botón de cancelar

### 7.3 Contexto que tiene el agente

Cuando el usuario envía un mensaje, el agente recibe automáticamente:

1. **Instrucciones del agente** — el system prompt configurado en el agente activo.
2. **Contexto del proyecto activo** (si la sesión tiene proyecto):
    - Nombre y ruta raíz del proyecto
    - Instrucciones personalizadas del proyecto
    - Listado de documentos adjuntos disponibles
    - Árbol de directorios de la ruta raíz (hasta 3 niveles de profundidad)
3. **Historial de conversación** de la sesión actual.

El agente **no** recibe automáticamente el contenido de los archivos (los lee bajo demanda con la herramienta `file_read`).

### 7.4 Herramientas del agente (Tool Calls)

Cuando el agente utiliza una herramienta, aparece una tarjeta inline en el flujo del chat. La tarjeta es compacta y colapsable.

**Herramienta: `file_read`**

Lee un archivo dentro del proyecto activo.

```
┌─ file_read ──────────────────────────────────────────────────────┐
│ 📄 src/controllers/payments.ts                      ✓ 2.1kb     │
└──────────────────────────────────────────────────────────────────┘
```

- No requiere confirmación del usuario.
- Si el archivo está fuera del directorio raíz del proyecto, la operación es rechazada automáticamente y el agente recibe un mensaje de error.
- El usuario puede expandir la tarjeta para ver el contenido leído.

### 7.5 Adjuntar archivos a un mensaje

El usuario puede adjuntar uno o varios archivos al enviar un mensaje. Los archivos adjuntos se envían como parte de ese mensaje específico (no se guardan en el proyecto). Útil para pegar un log, un stacktrace exportado, una captura de pantalla o cualquier archivo que no es parte del proyecto pero es relevante para esa pregunta.

**Formatos soportados:** texto plano, markdown, código fuente, PDF, imágenes (PNG, JPG, WebP).

**Límite:** 5 archivos adjuntos por mensaje, máximo 10MB por archivo.

### 7.6 Autorización de lectura del terminal

Por defecto, el agente puede ver el output del terminal. 

### 7.7 Indicador de contexto y límites

El indicador `4.2k / 200k tokens` muestra los tokens aproximados del contexto actual de la conversación sobre el límite del modelo activo. Cuando el contexto supera el 80% del límite, el indicador cambia a color ámbar. Al 95%, cambia a rojo.

El usuario puede comprimir la conversación entonces se analizara la inforamcion del contexto y se reducira el contenido dejando solo la información mas relevante, tambien habra la opcion de borrarla en su totalidad.

### 7.8 Historial de conversación

El historial de cada sesión se guarda en la base de datos local y persiste entre reinicios de la aplicación. Al abrir una sesión que ya tenía conversación, el historial anterior es visible pero **no se incluye automáticamente en el contexto** del agente (para no consumir tokens innecesariamente). El usuario puede hacer scroll para ver mensajes anteriores.

---

## 8. Módulo: Panel de agentes

Accesible desde el botón del robot en la parte superior de la sidenav. Es una vista dedicada que reemplaza el área principal mientras está abierta.

### 8.1 Lista de agentes

Vista principal del panel. Muestra una lista de los agentes configurados por el usuario, con:

- Nombre del agente
- Proveedor y modelo base
- Número de proyectos que lo usan
- Tokens consumidos totales (últimos 30 días)
- Botones de editar y eliminar

Siempre existe un **agente por defecto** que no puede eliminarse: "Termimate Default". Es el agente base que se usa en sesiones sin proyecto o en proyectos sin agente asignado.

### 8.2 Creación y edición de agente

**Formulario de agente:**

| Campo | Tipo | Descripción |
| --- | --- | --- |
| Nombre | Texto | Nombre identificativo del agente |
| Instrucciones de sistema (system prompt) | Textarea | Texto libre que define el comportamiento del agente |
| Proveedor | Selector | Anthropic / OpenAI |
| Modelo base | Selector | Depende del proveedor seleccionado |
| Herramientas habilitadas | Checkboxes | Qué tools puede usar este agente |
| Timeout de bash | Número | Segundos antes de cancelar un comando (por defecto: 60) |

El agente va a poder tener acceso a una carpeta de skills en la que el usuario va a poder añadirle habilidades personalizadas.

### 8.3 Historial de uso

Vista secundaria dentro del panel de agentes (pestaña "Uso"). Muestra:

- Tokens consumidos por agente, por día, en los últimos 30 días
- Coste estimado en USD basado en los precios del modelo
- Número de conversaciones y mensajes por agente

---

## 9. Módulo: Configuración global

Accesible desde el botón de configuración (engranaje) en la parte inferior de la sidenav. Se abre como una vista modal o en el área principal (a definir en diseño visual).

### 9.1 Secciones de configuración

### Claves API

| Campo | Descripción |
| --- | --- |
| Clave Anthropic | API key para modelos Claude. Se almacena en el keychain del sistema. |
| Clave OpenAI | API key para modelos GPT. Se almacena en el keychain del sistema. |

Las claves se muestran enmascaradas (•••••••••). Botón "Revelar" para mostrarlas temporalmente. Botón "Eliminar" para borrar del keychain.

Al guardar una clave, se valida con una llamada de prueba al proveedor antes de persistirla.

### Apariencia

| Configuración | Opciones | Por defecto |
| --- | --- | --- |
| Tema | Dark / Light | Dark |
| Fuente del terminal | Selector de fuentes monoespaciadas disponibles en el sistema | Monospace 13px |
| Tamaño de fuente del terminal | 10px – 24px | 13px |

### Terminal

| Configuración | Opciones | Por defecto |
| --- | --- | --- |
| Shell por defecto | bash / zsh / fish / (personalizado) | Detectado del sistema |
| Líneas de scroll (buffer) | 1000 – 100000 | 10000 |
| Líneas del buffer para el agente | 20 – 500 | 100 |

### Atajos de teclado

Lista editable de todos los atajos de la aplicación. Click en un atajo → modo de captura (el usuario pulsa la combinación deseada). Botón "Restablecer por defecto" que restaura todos los atajos a sus valores originales.

### Perfil

- Nombre del usuario
- Avatar (upload de imagen o usar iniciales)
- Rol (texto libre, se muestra en la sidenav)

---

## 10. Flujos de usuario principales

### Flujo 1: Primera vez — configurar y empezar

```
1. El usuario abre Termimate por primera vez
2. Wizard de bienvenida: 3 pasos
   a. Introduce su clave API de Anthropic (o la salta para después)
   b. Selecciona su shell por defecto (detectado, puede cambiar)
   c. Revisa la fuente y tamaño de la terminal
3. Se crea automáticamente una sesión de terminal con el shell configurado
4. El usuario ya puede trabajar
```

### Flujo 2: Crear un proyecto para un repositorio existente

```
1. El usuario tiene un repositorio en ~/projects/mi-api
2. Click derecho en el área de proyectos → "Nuevo proyecto"
3. Rellena: nombre="mi-api", emoji=🚀, ruta raíz=~/projects/mi-api
4. En el campo de instrucciones, describe el proyecto y su stack
5. Opcionalmente: adjunta el README.md y el esquema de BD
6. Guarda el proyecto
7. Nueva sesión → aparece en el proyecto, CWD apuntando a ~/projects/mi-api
8. El agente ya tiene contexto completo del proyecto
```

### Flujo 3: Usar el agente para entender un error

```
1. El usuario está trabajando en una sesión del proyecto "mi-api"
2. Ejecuta `npm test` en el terminal y ve un test fallando con un stacktrace largo
3. En el panel de agente escribe: "¿Por qué falla este test?"
4. El agente no tiene el output del terminal → usa bash_execute:
   a. Propone: $ npm test 2>&1 | tail -50
   b. Aparece la tarjeta de confirmación en el chat
   c. El usuario pulsa "Ejecutar"
   d. El agente recibe el output y lo analiza
5. El agente usa file_read para leer el archivo del test fallido
6. Responde con el análisis y la solución sugerida
```

### Flujo 4: Dar acceso al terminal al agente

```
1. El usuario tiene un servidor de desarrollo corriendo en el terminal
2. Quiere preguntarle al agente sobre el output sin copiar y pegar
3. Click en "Terminal: desconectado" en la barra del panel de agente
4. Diálogo: "¿Permitir que el agente lea el output reciente?"
5. Usuario confirma → "Terminal: conectado"
6. El usuario escribe: "¿Qué error está saliendo en el servidor?"
7. El agente usa terminal_read automáticamente para obtener el output reciente
8. Responde basándose en lo que ve en el terminal
```

### Flujo 5: Crear un agente especializado para un tipo de proyecto

```
1. El usuario trabaja mucho con proyectos de Python/Django
2. Abre el panel de agentes (botón robot en la sidenav)
3. Click en "Nuevo agente"
4. Rellena:
   - Nombre: "Django Expert"
   - System prompt: "Eres un experto en Python y Django. Conoces bien el ORM de Django, las mejores prácticas de seguridad y el despliegue con Gunicorn/Nginx..."
   - Modelo: claude-3-7-sonnet-20250219
   - bash_execute: habilitado, timeout 30s
5. Guarda el agente
6. Edita el proyecto Django → asigna "Django Expert" como agente por defecto
7. A partir de ahora, las sesiones de ese proyecto usan ese agente
```

---

## 11. Estados y comportamientos del sistema

### 11.1 Sin clave API configurada

Si el usuario no ha configurado ninguna clave API, el panel del agente muestra un estado vacío con el mensaje "Configura una clave API para empezar a usar el agente" y un botón directo a Configuración. La terminal funciona con normalidad.

### 11.2 Sin proyecto activo

Si la sesión activa no tiene proyecto asignado, el agente funciona pero sin contexto de proyecto. El system prompt solo incluye las instrucciones del agente. No hay `file_read`, `file_list` ni `terminal_read` disponibles (no hay directorio raíz contra el que operar). `bash_execute` usa el directorio home del usuario como CWD.

El panel del agente muestra un aviso: "Esta sesión no tiene proyecto asignado. El agente tiene contexto limitado. [Asignar proyecto]".

### 11.3 Respuesta del agente en streaming

Mientras el agente responde, el botón de enviar cambia a un botón de cancelar (icono de stop). El usuario puede cancelar la respuesta en cualquier momento. Los tokens ya generados se descuentan aunque el usuario cancele.

### 11.4 Múltiples sesiones activas

El usuario puede tener múltiples sesiones abiertas simultáneamente. Cada sesión tiene su propio proceso PTY y su propio historial de conversación con el agente. Cambiar de sesión en la topbar cambia tanto el panel terminal como el panel del agente a la sesión seleccionada.

### 11.5 Cierre de la aplicación

Al cerrar la aplicación, se guardan en base de datos la sesión activa y el estado de las pestañas abiertas. Los procesos PTY se terminan limpiamente (SIGHUP). Al reabrir la aplicación, se restauran las sesiones (sin el proceso shell, que se reinicia) y el historial de chat.

---

## 12. Casos límite y manejo de errores

### Terminal

| Situación | Comportamiento |
| --- | --- |
| El proceso shell muere inesperadamente | La pestaña cambia a estado ámbar. Se muestra en el terminal: `[Proceso terminado con código X]` con botón "Reiniciar sesión" |
| El shell no está disponible en el sistema | Al crear sesión, error: "El shell configurado (/bin/zsh) no se encontró. Ve a Configuración para cambiarlo." |
| Resize del terminal cuando hay un proceso activo como vim | El resize se propaga al proceso via SIGWINCH. La aplicación redrawn es responsabilidad del proceso |

### Agente

| Situación | Comportamiento |
| --- | --- |
| La API del LLM no responde (timeout) | Mensaje de error inline en el chat con opción de reintentar |
| La clave API no es válida | Error en la barra del panel con link a Configuración |
| El agente intenta leer un archivo fuera del proyecto | La tool call devuelve error: "Acceso denegado: el archivo está fuera del directorio del proyecto" |
| El comando bash tarda más del timeout | La ejecución se cancela automáticamente. La tarjeta muestra: `⏱ Timeout después de 60s` |
| El agente genera una tool call con parámetros inválidos | La tool call devuelve error de validación. El agente puede reintentar con parámetros corregidos |
| El contexto de la conversación supera el límite del modelo | Antes de enviar el mensaje, Termimate avisa al usuario: "El contexto de esta conversación está casi lleno (195k/200k tokens). Considera limpiar la conversación para continuar." |

### Proyectos

| Situación | Comportamiento |
| --- | --- |
| La ruta raíz del proyecto ya no existe | El proyecto se muestra con un aviso de advertencia en la sidenav. Las sesiones asociadas funcionan (el CWD pasa a home). Las herramientas de archivo devuelven error. |
| Un documento adjunto ya no existe en disco | Se muestra en la lista de documentos con un aviso de "Archivo no encontrado". El agente recibe error si intenta leerlo. |

---

## 13. Criterios de aceptación por módulo

### Sesiones de terminal

- [ ]  Una sesión recién creada abre un proceso shell en el directorio correcto
- [ ]  El terminal soporta colores ANSI, cursor posicionado y aplicaciones de pantalla completa (vim, htop)
- [ ]  El resize del panel redimensiona el terminal correctamente sin corromper la salida
- [ ]  Las sesiones persisten entre reinicios (nombre, proyecto asociado, CWD último conocido)
- [ ]  El indicador de estado cambia a ámbar cuando el proceso muere inesperadamente
- [ ]  Cerrar una sesión con proceso activo muestra confirmación
- [ ]  El menú contextual de pestaña funciona (renombrar, mover a proyecto, cerrar)

### Sistema de proyectos

- [ ]  Un proyecto creado aparece en la sidenav y puede expandirse para ver sus sesiones
- [ ]  Las instrucciones del proyecto se incluyen en el system prompt del agente
- [ ]  El árbol de directorios generado refleja la estructura real de la ruta raíz
- [ ]  Los documentos adjuntos son listados en el contexto del agente
- [ ]  Eliminar un proyecto mueve sus sesiones al historial general
- [ ]  Editar un proyecto actualiza el contexto en la siguiente conversación del agente

### Agente IA

- [ ]  Los mensajes del usuario se envían y la respuesta aparece en streaming
- [ ]  Las tool calls aparecen inline con su estado (cargando, completado, error)
- [ ]  `bash_execute` muestra el diálogo de confirmación antes de ejecutar
- [ ]  Rechazar un `bash_execute` no interrumpe la conversación
- [ ]  `file_read` de un archivo fuera del proyecto devuelve error (no ejecuta)
- [ ]  El indicador de tokens se actualiza después de cada respuesta
- [ ]  Cancelar una respuesta en curso detiene el streaming inmediatamente
- [ ]  El historial de conversación persiste entre reinicios
- [ ]  Limpiar la conversación borra el contexto activo pero no el historial guardado

### Panel de agentes

- [ ]  El agente por defecto no puede eliminarse
- [ ]  Los agentes creados aparecen en el selector del panel de chat
- [ ]  Los proyectos pueden asignarse a un agente específico
- [ ]  El historial de uso muestra los tokens consumidos de forma precisa
- [ ]  Las herramientas habilitadas/deshabilitadas por agente se respetan en ejecución

### Configuración

- [ ]  Las claves API se validan antes de guardarse
- [ ]  Las claves API no son visibles en texto plano en ningún archivo de disco
- [ ]  Cambiar la fuente del terminal se aplica inmediatamente a todas las sesiones
- [ ]  Cambiar el shell por defecto aplica a las nuevas sesiones (no a las existentes)
- [ ]  Los atajos personalizados funcionan en el contexto correcto

---

*Documento generado para uso interno del equipo de producto de Termimate.*