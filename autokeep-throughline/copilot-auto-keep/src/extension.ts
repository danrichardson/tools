import * as vscode from 'vscode';

const CONFIG_SECTION = 'copilotAutoKeep';
const TOGGLE_COMMAND = 'copilotAutoKeep.toggle';
const ACCEPT_NOW_COMMAND = 'copilotAutoKeep.acceptNow';
const OUTPUT_CHANNEL_NAME = 'Copilot Auto-Keep';

const KNOWN_ACCEPT_ALL_COMMANDS = [
  'chatEditing.acceptAllFiles',
  'chatEditor.action.acceptAllEdits',
  'workbench.action.chat.applyAll',
];

const SINGLE_FILE_FALLBACK_COMMANDS = [
  'chatEditor.action.accept',
  'chatEditing.acceptFile',
  'chatEditor.action.acceptHunk',
];

class CopilotAutoKeepController implements vscode.Disposable {
  private readonly output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  private readonly statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  private readonly disposables: vscode.Disposable[] = [];

  private debounceTimer: NodeJS.Timeout | undefined;
  private acceptInFlight = false;
  private resolvedAcceptCommand = KNOWN_ACCEPT_ALL_COMMANDS[0];

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async initialize(): Promise<void> {
    this.registerCommands();
    this.registerEventHandlers();
    this.configureStatusBar();
    await this.refreshResolvedAcceptCommand();

    this.log('Activated.');
    this.log(`Discovered accept-all command: ${this.resolvedAcceptCommand}`);
    this.log('Known context keys from VS Code internals: hasUndecidedChatEditingResource, inChatInput, chatEdits.hasEditorModifications, chatEdits.isCurrentlyBeingModified.');
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.statusBarItem.dispose();
    this.output.dispose();
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(CONFIG_SECTION);
  }

  private isEnabled(): boolean {
    return this.config().get<boolean>('enabled', true);
  }

  private debounceMs(): number {
    return this.config().get<number>('debounceMs', 300);
  }

  private commandOverride(): string {
    return this.config().get<string>('acceptCommand', '').trim();
  }

  private configureStatusBar(): void {
    this.statusBarItem.command = TOGGLE_COMMAND;
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  private updateStatusBar(): void {
    const enabled = this.isEnabled();
    this.statusBarItem.text = enabled ? '$(check) Auto-Keep' : '$(circle-slash) Auto-Keep';
    this.statusBarItem.tooltip = enabled
      ? 'Copilot Auto-Keep is enabled. Click to disable.'
      : 'Copilot Auto-Keep is disabled. Click to enable.';
  }

  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand(TOGGLE_COMMAND, async () => {
        await this.toggleEnabled();
      }),
    );

    this.disposables.push(
      vscode.commands.registerCommand(ACCEPT_NOW_COMMAND, async () => {
        await this.runAcceptCycle('manual-command', true);
      }),
    );
  }

  private registerEventHandlers(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (!this.isEnabled()) {
          return;
        }

        if (!this.shouldTrackDocument(event.document) || event.contentChanges.length === 0) {
          return;
        }

        this.scheduleAccept('text-document-change');
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration(CONFIG_SECTION)) {
          return;
        }

        if (!this.isEnabled() && this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = undefined;
        }

        this.updateStatusBar();
        await this.refreshResolvedAcceptCommand();
        this.log('Configuration changed.');
      }),
    );
  }

  private shouldTrackDocument(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== 'file') {
      return false;
    }

    return vscode.workspace.getWorkspaceFolder(document.uri) !== undefined;
  }

  private scheduleAccept(trigger: string): void {
    if (!this.isEnabled()) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    const delay = this.debounceMs();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.runAcceptCycle(`debounced:${trigger}`, false);
    }, delay);
  }

  private async toggleEnabled(): Promise<void> {
    const next = !this.isEnabled();
    await this.config().update('enabled', next, vscode.ConfigurationTarget.Global);
    this.log(`Enabled set to ${next}.`);
    this.updateStatusBar();
  }

  private async refreshResolvedAcceptCommand(): Promise<void> {
    const override = this.commandOverride();
    if (override.length > 0) {
      this.resolvedAcceptCommand = override;
      this.log(`Using configured command override: ${override}`);
      return;
    }

    try {
      const allCommands = await vscode.commands.getCommands(true);
      const available = new Set(allCommands);
      const discovered = KNOWN_ACCEPT_ALL_COMMANDS.find((commandId) => available.has(commandId));

      this.resolvedAcceptCommand = discovered ?? KNOWN_ACCEPT_ALL_COMMANDS[0];
    } catch (error) {
      this.resolvedAcceptCommand = KNOWN_ACCEPT_ALL_COMMANDS[0];
      this.log(`Could not discover command list, falling back to ${this.resolvedAcceptCommand}: ${this.formatError(error)}`);
    }
  }

  private async runAcceptCycle(trigger: string, manual: boolean): Promise<void> {
    if (!manual && !this.isEnabled()) {
      this.log(`Skipping auto-accept from ${trigger}: extension disabled.`);
      return;
    }

    if (this.acceptInFlight) {
      this.log(`Skipping auto-accept from ${trigger}: accept already in flight.`);
      return;
    }

    this.acceptInFlight = true;

    try {
      const accepted = await this.executeAcceptWithFallbacks();
      if (accepted) {
        this.log(`Auto-accept invoked (${trigger}) and completed successfully.`);
      } else {
        this.log(`Auto-accept invoked (${trigger}) but no command succeeded.`);
      }
    } finally {
      this.acceptInFlight = false;
    }
  }

  private async executeAcceptWithFallbacks(): Promise<boolean> {
    const commandChain = this.buildAcceptCommandChain();

    for (const commandId of commandChain) {
      try {
        await vscode.commands.executeCommand(commandId);
        this.log(`Executed accept command: ${commandId}`);
        return true;
      } catch (error) {
        this.log(`Accept command failed: ${commandId} -> ${this.formatError(error)}`);
      }
    }

    for (const commandId of SINGLE_FILE_FALLBACK_COMMANDS) {
      let executions = 0;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          await vscode.commands.executeCommand(commandId);
          executions += 1;
        } catch (error) {
          if (attempt === 0) {
            this.log(`Single-file fallback command failed: ${commandId} -> ${this.formatError(error)}`);
          }
          break;
        }
      }

      if (executions > 0) {
        this.log(`Single-file fallback command executed in loop: ${commandId} (${executions} attempts).`);
        return true;
      }
    }

    return false;
  }

  private buildAcceptCommandChain(): string[] {
    const override = this.commandOverride();
    const commands = override.length > 0
      ? [override, ...KNOWN_ACCEPT_ALL_COMMANDS]
      : [this.resolvedAcceptCommand, ...KNOWN_ACCEPT_ALL_COMMANDS];

    const deduped: string[] = [];
    const seen = new Set<string>();

    for (const commandId of commands) {
      if (!seen.has(commandId)) {
        deduped.push(commandId);
        seen.add(commandId);
      }
    }

    return deduped;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.output.appendLine(`[${timestamp}] ${message}`);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

let controller: CopilotAutoKeepController | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  controller = new CopilotAutoKeepController(context);
  context.subscriptions.push(controller);
  await controller.initialize();
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}
