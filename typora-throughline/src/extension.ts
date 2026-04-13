import * as path from 'path';
import { spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';

const COMMAND_OPEN = 'openInTypora.open';
const COMMAND_OPEN_WORKSPACE = 'openInTypora.openWorkspace';
const COMMAND_OPEN_SETTINGS = 'openInTypora.openSettings';
const CONTEXT_SUPPORTED_WITH_DOT = 'openInTypora.supportedExtensionsWithDot';
const CONFIG_SECTION = 'openInTypora';
const CONFIG_SUPPORTED_EXTENSIONS = 'supportedExtensions';
const CONFIG_SHOW_STATUS_BAR_ITEM = 'showStatusBarItem';
const CONFIG_EXECUTABLE_PATH = 'executablePath';
const CONFIG_EXECUTABLE_PATH_WINDOWS = 'executablePathWindows';
const CONFIG_EXECUTABLE_PATH_MACOS = 'executablePathMacOS';
const CONFIG_EXECUTABLE_PATH_LINUX = 'executablePathLinux';
const GLOBAL_STATE_SETTINGS_SHOWN = 'openInTypora.didShowSettingsOnFirstInstallV2';
const GLOBAL_STATE_SETTINGS_INSTALL_MARKER = 'openInTypora.settingsInstallMarkerV1';
const SETTINGS_OPEN_DELAY_MS = 1500;
const EXECUTABLE_CONFIG_KEYS = [
  CONFIG_EXECUTABLE_PATH,
  CONFIG_EXECUTABLE_PATH_WINDOWS,
  CONFIG_EXECUTABLE_PATH_MACOS,
  CONFIG_EXECUTABLE_PATH_LINUX
];

const DEFAULT_SUPPORTED_EXTENSIONS = [
  'md',
  'markdown',
  'mdown',
  'mmd',
  'text',
  'txt',
  'rmarkdown',
  'mkd',
  'mdwn',
  'mdtxt',
  'rmd',
  'qmd',
  'mdtext',
  'mdx'
];

let isNormalizingExecutablePathSettings = false;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Open in Typora');
  const settingsQuery = getSettingsQuery(context.extension.id);
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN_SETTINGS, async () => {
      await openExtensionSettings(outputChannel, settingsQuery);
    })
  );

  await maybeOpenSettingsOnFirstInstall(context, outputChannel, settingsQuery);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(book) Typora';
  statusBarItem.tooltip = 'Open workspace in Typora';
  statusBarItem.command = COMMAND_OPEN_WORKSPACE;
  context.subscriptions.push(statusBarItem);

  await refreshSupportedExtensionsContext(outputChannel);
  await normalizeExecutablePathSettings(outputChannel, false);
  updateStatusBarItemVisibility(statusBarItem);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(`${CONFIG_SECTION}.${CONFIG_SUPPORTED_EXTENSIONS}`)) {
        await refreshSupportedExtensionsContext(outputChannel);
      }

      if (event.affectsConfiguration(`${CONFIG_SECTION}.${CONFIG_SHOW_STATUS_BAR_ITEM}`)) {
        updateStatusBarItemVisibility(statusBarItem);
      }

      if (affectsExecutablePathConfiguration(event)) {
        await normalizeExecutablePathSettings(outputChannel, true);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      updateStatusBarItemVisibility(statusBarItem);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMAND_OPEN,
      async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        if (!clickedUri && (!selectedUris || selectedUris.length === 0)) {
          await runOpenFromPalette(outputChannel);
          return;
        }

        const candidateUris = collectCandidateUris(clickedUri, selectedUris);
        await openUrisInTypora(candidateUris, outputChannel);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN_WORKSPACE, async () => {
      const workspaceUri = await resolveWorkspaceFolderUri();
      if (!workspaceUri) {
        return;
      }

      await openUrisInTypora([workspaceUri], outputChannel);
    })
  );
}

export function deactivate(): void {
  // No resources to release.
}

async function runOpenFromPalette(outputChannel: vscode.OutputChannel): Promise<void> {
  const quickPickSelection = await vscode.window.showQuickPick(
    [
      { label: 'Open current file', value: 'currentFile' },
      { label: 'Open current workspace folder', value: 'workspaceFolder' },
      { label: 'Choose...', value: 'choose' }
    ],
    {
      title: 'Typora: Open in Typora',
      placeHolder: 'Select what to open in Typora'
    }
  );

  if (!quickPickSelection) {
    return;
  }

  switch (quickPickSelection.value) {
    case 'currentFile': {
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      if (!activeUri) {
        vscode.window.showInformationMessage('No active file to open.');
        return;
      }

      await openUrisInTypora([activeUri], outputChannel);
      return;
    }

    case 'workspaceFolder': {
      const workspaceUri = await resolveWorkspaceFolderUri();
      if (!workspaceUri) {
        return;
      }

      await openUrisInTypora([workspaceUri], outputChannel);
      return;
    }

    case 'choose': {
      const chosenUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Open in Typora'
      });

      if (!chosenUris || chosenUris.length === 0) {
        return;
      }

      await openUrisInTypora(chosenUris, outputChannel);
      return;
    }

    default:
      return;
  }
}

function collectCandidateUris(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
  if (selectedUris && selectedUris.length > 0) {
    return selectedUris;
  }

  if (clickedUri) {
    return [clickedUri];
  }

  return [];
}

async function resolveWorkspaceFolderUri(): Promise<vscode.Uri | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showInformationMessage('No workspace folder is currently open.');
    return undefined;
  }

  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri;
  }

  const selectedWorkspace = await vscode.window.showQuickPick(
    workspaceFolders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath,
      folder
    })),
    {
      title: 'Typora: Open Workspace in Typora',
      placeHolder: 'Select workspace folder to open in Typora'
    }
  );

  return selectedWorkspace?.folder.uri;
}

async function openUrisInTypora(
  uris: vscode.Uri[],
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (uris.length === 0) {
    return;
  }

  const supportedExtensionSet = new Set(getSupportedExtensions());
  let hadLaunchFailure = false;
  const launchTargets: string[] = [];

  for (const uri of uris) {
    const resolvedPath = await resolveLaunchablePath(uri, supportedExtensionSet, outputChannel);
    if (!resolvedPath) {
      continue;
    }

    launchTargets.push(resolvedPath);
  }

  const uniqueLaunchTargets = dedupeLaunchTargets(launchTargets);

  if (launchTargets.length > 1 && uniqueLaunchTargets.length < launchTargets.length) {
    outputChannel.appendLine(
      `Deduplicated ${launchTargets.length - uniqueLaunchTargets.length} duplicate launch target(s) for this invocation.`
    );
  }

  for (const targetPath of uniqueLaunchTargets) {
    try {
      await launchTypora(targetPath, outputChannel);
    } catch (error) {
      hadLaunchFailure = true;
      logLaunchFailure(vscode.Uri.file(targetPath), error, outputChannel);
    }
  }

  if (hadLaunchFailure) {
    vscode.window.showErrorMessage(
      'Could not launch Typora. Is it installed and on PATH? See output for details.'
    );
  }
}

function dedupeLaunchTargets(paths: string[]): string[] {
  const unique = new Map<string, string>();

  for (const value of paths) {
    const key = process.platform === 'win32' ? value.toLowerCase() : value;
    if (!unique.has(key)) {
      unique.set(key, value);
    }
  }

  return [...unique.values()];
}

async function resolveLaunchablePath(
  uri: vscode.Uri,
  supportedExtensions: Set<string>,
  outputChannel: vscode.OutputChannel
): Promise<string | undefined> {
  if (uri.scheme !== 'file') {
    outputChannel.appendLine(`Skipping non-file URI: ${uri.toString()}`);
    return undefined;
  }

  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if ((stat.type & vscode.FileType.Directory) !== 0) {
      return uri.fsPath;
    }

    if ((stat.type & vscode.FileType.File) !== 0 && isSupportedMarkdownLikeFile(uri, supportedExtensions)) {
      return uri.fsPath;
    }

    return undefined;
  } catch (error) {
    outputChannel.appendLine(`Failed to stat URI: ${uri.fsPath}`);
    outputChannel.appendLine(formatError(error));
    return undefined;
  }
}

function isSupportedMarkdownLikeFile(uri: vscode.Uri, supportedExtensions: Set<string>): boolean {
  const extension = path.extname(uri.fsPath).toLowerCase().replace(/^\./, '');
  return extension.length > 0 && supportedExtensions.has(extension);
}

async function launchTypora(targetPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
  const commonOptions: SpawnOptions = {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  };

  const configuredExecutable = getConfiguredExecutableForCurrentPlatform();
  if (configuredExecutable) {
    if (isWindowsShortcutPath(configuredExecutable)) {
      const resolvedShortcutTarget = await resolveWindowsShortcutTarget(configuredExecutable, outputChannel);
      if (resolvedShortcutTarget) {
        await spawnAndValidate(resolvedShortcutTarget, [targetPath], commonOptions, true);
        return;
      }

      const args = [
        '/c',
        'start',
        '""',
        `"${escapeForCmdArgument(configuredExecutable)}"`,
        `"${escapeForCmdArgument(targetPath)}"`
      ];
      await spawnAndValidate('cmd', args, { ...commonOptions, shell: true }, false);
      return;
    }

    await spawnAndValidate(configuredExecutable, [targetPath], commonOptions, true);
    return;
  }

  if (process.platform === 'win32') {
    try {
      await spawnAndValidate('typora', [targetPath], commonOptions, true);
      return;
    } catch (error) {
      outputChannel.appendLine('Direct Typora launch failed on Windows, retrying with cmd/start.');
      outputChannel.appendLine(formatError(error));

      const args = ['/c', 'start', '""', 'typora', `"${escapeForCmdArgument(targetPath)}"`];
      await spawnAndValidate('cmd', args, { ...commonOptions, shell: true }, false);
    }

    return;
  }

  if (process.platform === 'darwin') {
    await spawnAndValidate('open', ['-a', 'Typora', targetPath], commonOptions, false);
    return;
  }

  await spawnAndValidate('typora', [targetPath], commonOptions, true);
}

function escapeForCmdArgument(value: string): string {
  return value.replace(/"/g, '""');
}

function isWindowsShortcutPath(value: string): boolean {
  return process.platform === 'win32' && value.toLowerCase().endsWith('.lnk');
}

async function resolveWindowsShortcutTarget(
  shortcutPath: string,
  outputChannel: vscode.OutputChannel
): Promise<string | undefined> {
  const script =
    '$ErrorActionPreference = "Stop"; ' +
    '$shell = New-Object -ComObject WScript.Shell; ' +
    '$shortcut = $shell.CreateShortcut($args[0]); ' +
    'if ($shortcut -and $shortcut.TargetPath) { ' +
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ' +
    'Write-Output $shortcut.TargetPath }';

  try {
    const rawOutput = await runCommandForStdout('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
      shortcutPath
    ]);

    const targetPath = rawOutput.trim();
    if (targetPath.length === 0) {
      outputChannel.appendLine(`Configured shortcut did not resolve to a target path: ${shortcutPath}`);
      return undefined;
    }

    outputChannel.appendLine(`Resolved Typora shortcut: ${shortcutPath} -> ${targetPath}`);
    return targetPath;
  } catch (error) {
    outputChannel.appendLine(`Failed to resolve shortcut target: ${shortcutPath}`);
    outputChannel.appendLine(formatError(error));
    return undefined;
  }
}

function runCommandForStdout(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      const signalMessage = signal ? ` (signal: ${signal})` : '';
      const exitCodeMessage = code === null ? 'unknown' : String(code);
      const stderrMessage = stderr.trim();
      reject(
        new Error(
          stderrMessage.length > 0
            ? `Exit code ${exitCodeMessage}${signalMessage}: ${stderrMessage}`
            : `Exit code ${exitCodeMessage}${signalMessage}`
        )
      );
    });
  });
}

function getConfiguredExecutableForCurrentPlatform(): string | undefined {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  const platformSetting =
    process.platform === 'win32'
      ? config.get<string>(CONFIG_EXECUTABLE_PATH_WINDOWS, '')
      : process.platform === 'darwin'
        ? config.get<string>(CONFIG_EXECUTABLE_PATH_MACOS, '')
        : config.get<string>(CONFIG_EXECUTABLE_PATH_LINUX, '');

  const normalizedPlatformSetting = normalizeExecutableSetting(platformSetting);
  if (normalizedPlatformSetting) {
    return normalizedPlatformSetting;
  }

  return normalizeExecutableSetting(config.get<string>(CONFIG_EXECUTABLE_PATH, ''));
}

function normalizeExecutableSetting(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted.length > 0 ? unquoted : undefined;
  }

  return trimmed;
}

function affectsExecutablePathConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
  return EXECUTABLE_CONFIG_KEYS.some((key) =>
    event.affectsConfiguration(`${CONFIG_SECTION}.${key}`)
  );
}

async function normalizeExecutablePathSettings(
  outputChannel: vscode.OutputChannel,
  showNotification: boolean
): Promise<void> {
  if (process.platform !== 'win32' || isNormalizingExecutablePathSettings) {
    return;
  }

  isNormalizingExecutablePathSettings = true;

  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const updates: Array<{
      key: string;
      target: vscode.ConfigurationTarget;
      original: string;
      resolved: string;
    }> = [];

    for (const key of EXECUTABLE_CONFIG_KEYS) {
      const inspected = config.inspect<string>(key);
      if (!inspected) {
        continue;
      }

      const candidates: Array<{
        target: vscode.ConfigurationTarget;
        value: string | undefined;
      }> = [
        { target: vscode.ConfigurationTarget.Global, value: inspected.globalValue },
        { target: vscode.ConfigurationTarget.Workspace, value: inspected.workspaceValue },
        { target: vscode.ConfigurationTarget.WorkspaceFolder, value: inspected.workspaceFolderValue }
      ];

      for (const candidate of candidates) {
        const normalized = normalizeExecutableSetting(candidate.value);
        if (!normalized || !isWindowsShortcutPath(normalized)) {
          continue;
        }

        const resolved = await resolveWindowsShortcutTarget(normalized, outputChannel);
        if (!resolved || resolved.toLowerCase() === normalized.toLowerCase()) {
          continue;
        }

        updates.push({
          key,
          target: candidate.target,
          original: normalized,
          resolved
        });
      }
    }

    if (updates.length === 0) {
      return;
    }

    const updatedSettings: string[] = [];

    for (const update of updates) {
      try {
        if (update.target === vscode.ConfigurationTarget.WorkspaceFolder) {
          const primaryWorkspaceFolderUri = vscode.workspace.workspaceFolders?.[0]?.uri;
          if (!primaryWorkspaceFolderUri) {
            outputChannel.appendLine(
              `Skipping ${CONFIG_SECTION}.${update.key} workspace-folder update: no workspace folder is open.`
            );
            continue;
          }

          const workspaceFolderConfig = vscode.workspace.getConfiguration(
            CONFIG_SECTION,
            primaryWorkspaceFolderUri
          );
          await workspaceFolderConfig.update(
            update.key,
            update.resolved,
            vscode.ConfigurationTarget.WorkspaceFolder
          );
        } else {
          await config.update(update.key, update.resolved, update.target);
        }

        outputChannel.appendLine(
          `Normalized ${CONFIG_SECTION}.${update.key}: ${update.original} -> ${update.resolved}`
        );
        updatedSettings.push(`${CONFIG_SECTION}.${update.key}`);
      } catch (error) {
        outputChannel.appendLine(`Failed to update ${CONFIG_SECTION}.${update.key} after shortcut resolution.`);
        outputChannel.appendLine(formatError(error));
      }
    }

    if (showNotification && updatedSettings.length > 0) {
      const uniqueSettings = [...new Set(updatedSettings)].join(', ');
      vscode.window.showInformationMessage(
        `Resolved Windows shortcut path to Typora executable and updated setting(s): ${uniqueSettings}`
      );
    }
  } finally {
    isNormalizingExecutablePathSettings = false;
  }
}

function spawnAndValidate(
  command: string,
  args: string[],
  options: SpawnOptions,
  resolveOnSpawn: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, options);
      let settled = false;

      const settle = (handler: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        child.removeListener('error', onError);
        child.removeListener('spawn', onSpawn);
        child.removeListener('close', onClose);
        handler();
      };

      const onError = (error: Error): void => {
        settle(() => reject(error));
      };

      const onSpawn = (): void => {
        if (resolveOnSpawn) {
          settle(resolve);
        }
      };

      const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
        if (resolveOnSpawn) {
          return;
        }

        if (code === 0) {
          settle(resolve);
          return;
        }

        const signalMessage = signal ? ` (signal: ${signal})` : '';
        const exitCodeMessage = code === null ? 'unknown' : String(code);
        settle(() => reject(new Error(`Exit code ${exitCodeMessage}${signalMessage}`)));
      };

      child.once('error', onError);
      child.once('spawn', onSpawn);
      child.once('close', onClose);
      child.unref();
    } catch (error) {
      reject(error);
    }
  });
}

function logLaunchFailure(uri: vscode.Uri, error: unknown, outputChannel: vscode.OutputChannel): void {
  outputChannel.appendLine(`Failed to launch Typora for: ${uri.fsPath || uri.toString()}`);
  outputChannel.appendLine(formatError(error));
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

async function refreshSupportedExtensionsContext(outputChannel: vscode.OutputChannel): Promise<void> {
  try {
    const withDot = getSupportedExtensions().map((extension) => `.${extension}`);
    await vscode.commands.executeCommand('setContext', CONTEXT_SUPPORTED_WITH_DOT, withDot);
  } catch (error) {
    outputChannel.appendLine('Failed to update supported extension context key.');
    outputChannel.appendLine(formatError(error));
  }
}

function getSupportedExtensions(): string[] {
  const configured = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string[]>(CONFIG_SUPPORTED_EXTENSIONS, DEFAULT_SUPPORTED_EXTENSIONS);

  if (!Array.isArray(configured)) {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  const normalized = configured
    .map((value) => value.trim().toLowerCase().replace(/^\./, ''))
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  return [...new Set(normalized)];
}

function updateStatusBarItemVisibility(statusBarItem: vscode.StatusBarItem): void {
  if (shouldShowStatusBarItem()) {
    statusBarItem.show();
    return;
  }

  statusBarItem.hide();
}

function shouldShowStatusBarItem(): boolean {
  const showStatusBarItem = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>(CONFIG_SHOW_STATUS_BAR_ITEM, true);

  const hasWorkspaceFolder =
    Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0;

  return showStatusBarItem && hasWorkspaceFolder;
}

async function maybeOpenSettingsOnFirstInstall(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  settingsQuery: string
): Promise<void> {
  const currentInstallMarker = getCurrentInstallMarker(context, outputChannel);
  const lastInstallMarker = context.globalState.get<string>(GLOBAL_STATE_SETTINGS_INSTALL_MARKER);

  if (lastInstallMarker === currentInstallMarker) {
    return;
  }

  setTimeout(() => {
    void openExtensionSettings(outputChannel, settingsQuery).then(async (didOpen) => {
      if (didOpen) {
        await context.globalState.update(
          GLOBAL_STATE_SETTINGS_INSTALL_MARKER,
          currentInstallMarker
        );
        await context.globalState.update(GLOBAL_STATE_SETTINGS_SHOWN, true);
      }
    });
  }, SETTINGS_OPEN_DELAY_MS);
}

function getCurrentInstallMarker(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): string {
  const version = String(context.extension.packageJSON?.version ?? 'unknown-version');

  try {
    const stats = fs.statSync(context.extension.extensionPath);
    return `${version}:${Math.floor(stats.mtimeMs)}`;
  } catch (error) {
    outputChannel.appendLine('Failed to compute install marker for onboarding settings flow.');
    outputChannel.appendLine(formatError(error));
    return `${version}:unknown-install-time`;
  }
}

function getSettingsQuery(extensionId: string): string {
  return `@ext:${extensionId} ${CONFIG_SECTION}`;
}

async function openExtensionSettings(
  outputChannel: vscode.OutputChannel,
  settingsQuery: string
): Promise<boolean> {
  try {
    await vscode.commands.executeCommand('workbench.action.openSettings', settingsQuery);
    return true;
  } catch (error) {
    outputChannel.appendLine('Failed to open Open in Typora settings.');
    outputChannel.appendLine(formatError(error));

    const openAction = 'Open Settings';
    const selectedAction = await vscode.window.showInformationMessage(
      'Open in Typora is installed. Open settings now?',
      openAction,
      'Not Now'
    );

    if (selectedAction === openAction) {
      try {
        await vscode.commands.executeCommand('workbench.action.openSettings', settingsQuery);
        return true;
      } catch (retryError) {
        outputChannel.appendLine('Retry to open Open in Typora settings failed.');
        outputChannel.appendLine(formatError(retryError));
      }
    }

    return false;
  }
}
