/**
 * Hook system types for Termimate.
 * Hooks run shell commands before/after tool execution.
 * Config file: {projectRoot}/.termimate/hooks.json
 */

/** Events that can trigger a hook. */
export type HookEvent = 'PreToolUse' | 'PostToolUse';

/**
 * A single hook definition.
 *
 * @example
 * { "event": "PreToolUse", "tool": "bash_execute", "command": "echo pre", "timeout": 5000 }
 * { "event": "PostToolUse", "tool": "*", "command": "make lint" }
 */
export interface HookDefinition {
  /** When to fire. */
  event: HookEvent;
  /** Tool name pattern. Omit (or use '*') to match any tool. */
  tool?: string;
  /** Shell command to execute. Receives TERMIMATE_* env vars. */
  command: string;
  /**
   * Max milliseconds to wait for the hook process.
   * Default: 10 000 ms. Only relevant for PreToolUse (PostToolUse is always async).
   */
  timeout?: number;
}

/** Root schema of .termimate/hooks.json */
export interface HookConfig {
  hooks: HookDefinition[];
}

/** Decision returned by a PreToolUse hook.
 *  - `allow`  (default): proceed with tool execution
 *  - `block`:  skip tool execution, surface `message` as the tool error
 */
export type HookDecision = 'allow' | 'block';

export interface PreHookResult {
  decision: HookDecision;
  /** Only set when decision === 'block'. Sourced from hook stdout. */
  message?: string;
}
