import type { ToolsConfig } from '../../shared/types/agent.types';

export class PermissionGuard {
  private toolsConfig: ToolsConfig | null;

  constructor(toolsConfig: ToolsConfig | null) {
    this.toolsConfig = toolsConfig;
  }

  isToolEnabled(toolName: string): boolean {
    if (!this.toolsConfig) return true; // All tools enabled by default
    return this.toolsConfig.enabledTools.includes(toolName);
  }

  isBashCommandAllowed(command: string): boolean {
    if (!this.toolsConfig?.bashAllowlist) return true; // No restrictions
    const executable = command.trim().split(/\s+/)[0];
    return this.toolsConfig.bashAllowlist.includes(executable);
  }
}
