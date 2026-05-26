import * as vscode from 'vscode';
import { LeetCodeAuthManager } from './leetcode';
import { LeetCodeStatusBarController } from './statusBar';

/**
 * Handles the Sign In command.
 * Prompts the user for their cookie string, validates it, and logs in.
 *
 * @param authManager - The LeetCode authentication manager instance.
 */
async function handleSignIn(authManager: LeetCodeAuthManager): Promise<void> {
  const endpoint = authManager.getClient().getEndpoint();
  const loginUrl = `${endpoint}/accounts/login/`;

  const choice = await vscode.window.showInformationMessage(
    'To sign in, please log in to LeetCode in your browser and copy your session cookies.',
    'Open Browser & Login',
    'Read from Clipboard',
    'Paste Manually'
  );

  if (!choice) {
    return;
  }

  let cookieString: string | undefined;

  if (choice === 'Open Browser & Login') {
    void vscode.env.openExternal(vscode.Uri.parse(loginUrl));
    const readyChoice = await vscode.window.showInformationMessage(
      'After logging in to LeetCode, copy the Cookie header from the Developer Tools Network tab.',
      'Read from Clipboard',
      'Paste Manually'
    );
    if (!readyChoice) {
      return;
    }
    
    if (readyChoice === 'Read from Clipboard') {
      cookieString = await vscode.env.clipboard.readText();
    }
  } else if (choice === 'Read from Clipboard') {
    cookieString = await vscode.env.clipboard.readText();
  }

  if (cookieString === undefined) {
    const leetcodeSession = await vscode.window.showInputBox({
      prompt: 'Paste your LEETCODE_SESSION value here.',
      placeHolder: 'e.g., eyJ0e...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) return 'LEETCODE_SESSION cannot be empty.';
        return null;
      },
    });

    if (!leetcodeSession) {
      return;
    }

    const csrfToken = await vscode.window.showInputBox({
      prompt: 'Paste your csrftoken value here.',
      placeHolder: 'e.g., zFULsdRN...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) return 'csrftoken cannot be empty.';
        return null;
      },
    });

    if (!csrfToken) {
      return;
    }

    let sessionVal = leetcodeSession.trim();
    if (sessionVal.startsWith('LEETCODE_SESSION=')) {
      sessionVal = sessionVal.substring('LEETCODE_SESSION='.length);
    }
    if (sessionVal.endsWith(';')) sessionVal = sessionVal.slice(0, -1);

    let csrfVal = csrfToken.trim();
    if (csrfVal.startsWith('csrftoken=')) {
      csrfVal = csrfVal.substring('csrftoken='.length);
    }
    if (csrfVal.endsWith(';')) csrfVal = csrfVal.slice(0, -1);

    cookieString = `LEETCODE_SESSION=${sessionVal}; csrftoken=${csrfVal};`;
  }

  if (!cookieString) {
    return;
  }

  cookieString = cookieString.trim();
  if (!cookieString.includes('LEETCODE_SESSION') || !cookieString.includes('csrftoken')) {
    void vscode.window.showErrorMessage(
      'Invalid cookie string. It must contain both LEETCODE_SESSION and csrftoken.',
      { modal: true }
    );
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Verifying LeetCode credentials...',
        cancellable: false,
      },
      async () => {
        await authManager.login(cookieString);
      }
    );
    void vscode.window.showInformationMessage(
      `Successfully signed in to LeetCode as ${authManager.getStatus()?.username}.`,
      { modal: true }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Failed to sign in: ${errMsg}`, { modal: true });
  }
}

/**
 * Handles the Sign Out command.
 * Confirms with the user before performing logout.
 *
 * @param authManager - The LeetCode authentication manager instance.
 */
async function handleSignOut(authManager: LeetCodeAuthManager): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Are you sure you want to sign out of LeetCode?',
    { modal: true },
    'Sign Out'
  );

  if (confirm === 'Sign Out') {
    await authManager.logout();
    void vscode.window.showInformationMessage('Successfully signed out of LeetCode.');
  }
}

/**
 * Handles the Show User command, presenting a Quick Pick interface.
 * Shows account details if signed in, or provides choices to sign in/out/configure.
 *
 * @param authManager - The LeetCode authentication manager instance.
 */
async function handleShowUser(authManager: LeetCodeAuthManager): Promise<void> {
  const status = authManager.getStatus();
  const items: vscode.QuickPickItem[] = [];

  if (status && status.isSignedIn) {
    const accountType = status.isPremium ? 'Premium Account' : 'Standard Account';
    items.push({
      label: `$(account) Account: ${status.username}`,
      description: status.realName ? `${status.realName} (${accountType})` : accountType,
      detail: 'View your public profile on LeetCode',
    });
    items.push({
      label: '$(signout) Sign Out',
      detail: 'Remove LeetCode session cookies from secure storage',
    });
  } else {
    items.push({
      label: '$(signin) Sign In',
      detail: 'Authenticate with LeetCode cookies',
    });
  }

  items.push({
    label: '$(settings) Change Endpoint',
    description: `Current: ${authManager.getClient().getEndpoint()}`,
    detail: 'Configure global or China endpoint settings',
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'LeetCode Account Actions',
  });

  if (!selected) {
    return;
  }

  if (selected.label.includes('Sign In')) {
    void handleSignIn(authManager);
  } else if (selected.label.includes('Sign Out')) {
    void handleSignOut(authManager);
  } else if (selected.label.includes('Change Endpoint')) {
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'better-leetcode.endpoint'
    );
  } else if (selected.label.includes('Account:')) {
    const profileUrl = `${authManager.getClient().getEndpoint()}/u/${status?.username}/`;
    void vscode.env.openExternal(vscode.Uri.parse(profileUrl));
  }
}

/**
 * Activates the VS Code extension.
 * Sets up the auth manager, status bar controller, and registers user commands.
 *
 * @param context - The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const authManager = new LeetCodeAuthManager(context);
  const statusBar = new LeetCodeStatusBarController(authManager);

  context.subscriptions.push(statusBar);
  statusBar.show();

  await authManager.initialize();

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('better-leetcode.signin', () => handleSignIn(authManager)),
    vscode.commands.registerCommand('better-leetcode.signout', () => handleSignOut(authManager)),
    vscode.commands.registerCommand('better-leetcode.showUser', () => handleShowUser(authManager))
  );
}

/**
 * Deactivates the VS Code extension.
 */
export function deactivate(): void {
  // Resources managed via context.subscriptions are automatically disposed.
}
