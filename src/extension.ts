import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LeetCodeAuthManager, BoilerplateManager } from './leetcode';
import { LeetCodeStatusBarController } from './statusBar';
import { DailyChallengeTreeDataProvider } from './tree/DailyChallengeTreeDataProvider';
import { AllProblemsTreeDataProvider } from './tree/AllProblemsTreeDataProvider';
import { StudyListsTreeDataProvider } from './tree/StudyListsTreeDataProvider';
import { ContestsTreeDataProvider } from './tree/ContestsTreeDataProvider';
import { ProblemWebview } from './webview/ProblemWebview';
import { TestResultsPanel } from './webview/TestResultsPanel';
import { ProblemDetails, ProblemMetaData, SubmissionCheckResult } from './leetcode/types';
import { Logger, parseLogLevel } from './logger';

/**
 * Maps file extensions to LeetCode language slugs.
 * Used consistently for submit, test, and language detection.
 */
export const EXT_TO_LANG_MAP: Record<string, string> = {
  cpp: 'cpp',
  java: 'java',
  py: 'python3',
  js: 'javascript',
  ts: 'typescript',
  cs: 'csharp',
  c: 'c',
  go: 'golang',
  kt: 'kotlin',
  swift: 'swift',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  sql: 'mysql',
};

/**
 * Derives the LeetCode language slug from a file extension.
 * Returns the language slug, or null if the extension is unknown.
 *
 * @param filePath - Absolute path to the solution file.
 * @returns The LeetCode language slug, or null.
 */
export function deriveLangFromExtension(filePath: string): string | null {
  const ext = path.extname(filePath).replace('.', '');
  return EXT_TO_LANG_MAP[ext] ?? null;
}

/**
 * Metadata stored alongside each solution file for round-trip boilerplate handling.
 */
export interface ProblemMetadata {
  questionId: string;
  titleSlug: string;
  lang: string;
  originalSnippet: string;
  sampleTestCase: string;
  exampleTestcases?: string;
  inputLineCount: number;
}

/**
 * Handles the Sign In command.
 * Presents a Quick Pick with Web Authorization (recommended) and
 * manual Cookie entry options.
 *
 * @param authManager - The LeetCode authentication manager instance.
 * @param context - The VS Code extension context, used to build the redirect URI.
 */
async function handleSignIn(
  authManager: LeetCodeAuthManager,
  context: vscode.ExtensionContext,
): Promise<void> {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: '$(globe) Web Authorization',
        description: '(Recommended)',
        detail: 'Open browser to authorize login on the website',
        value: 'WebAuth',
      },
      {
        label: '$(key) LeetCode Cookie',
        description: '',
        detail: 'Use LeetCode cookie copied from browser to login',
        value: 'Cookie',
      },
    ],
    { placeHolder: 'Select a sign-in method' },
  );

  if (!choice) {
    return;
  }

  if (choice.value === 'WebAuth') {
    const endpoint = authManager.getClient().getEndpoint();
    const uriScheme = vscode.env.uriScheme; // 'vscode', 'vscode-insiders', etc.
    const extensionId = context.extension.id;
    const authUrl = `${endpoint}/authorize-login/${uriScheme}/?path=${extensionId}`;
    void vscode.env.openExternal(vscode.Uri.parse(authUrl));
    return;
  }

  // ── Cookie flow (fallback) ─────────────────────────────────────────
  await handleCookieSignIn(authManager);
}

/**
 * Handles the manual Cookie sign-in flow.
 * Prompts the user for their LEETCODE_SESSION and csrftoken values,
 * validates the cookie, and logs in.
 *
 * @param authManager - The LeetCode authentication manager instance.
 */
async function handleCookieSignIn(authManager: LeetCodeAuthManager): Promise<void> {
  const endpoint = authManager.getClient().getEndpoint();
  const loginUrl = `${endpoint}/accounts/login/`;

  const subChoice = await vscode.window.showInformationMessage(
    'Log in to LeetCode in your browser and copy your session cookies.',
    'Open Browser & Login',
    'Read from Clipboard',
    'Paste Manually',
  );

  if (!subChoice) {
    return;
  }

  let cookieString: string | undefined;

  if (subChoice === 'Open Browser & Login') {
    void vscode.env.openExternal(vscode.Uri.parse(loginUrl));
    const readyChoice = await vscode.window.showInformationMessage(
      'After logging in, copy the Cookie header from Developer Tools Network tab.',
      'Read from Clipboard',
      'Paste Manually',
    );
    if (!readyChoice) {
      return;
    }

    if (readyChoice === 'Read from Clipboard') {
      cookieString = await vscode.env.clipboard.readText();
    }
  } else if (subChoice === 'Read from Clipboard') {
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

    if (leetcodeSession === undefined || leetcodeSession === '') {
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

    if (csrfToken === undefined || csrfToken === '') {
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
      { modal: true },
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
      },
    );
    void vscode.window.showInformationMessage(
      `Successfully signed in to LeetCode as ${authManager.getStatus()?.username}.`,
      { modal: true },
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
    'Sign Out',
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
 * @param context - The VS Code extension context, forwarded to handleSignIn.
 */
async function handleShowUser(
  authManager: LeetCodeAuthManager,
  context: vscode.ExtensionContext,
): Promise<void> {
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
    void handleSignIn(authManager, context);
  } else if (selected.label.includes('Sign Out')) {
    void handleSignOut(authManager);
  } else if (selected.label.includes('Change Endpoint')) {
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'better-leetcode.endpoint',
    );
  } else if (selected.label.includes('Account:')) {
    const profileUrl = `${authManager.getClient().getEndpoint()}/u/${status?.username}/`;
    void vscode.env.openExternal(vscode.Uri.parse(profileUrl));
  }
}

/**
 * Handles opening a problem by generating local files and displaying description & code side-by-side.
 */
async function handleOpenProblem(
  authManager: LeetCodeAuthManager,
  context: vscode.ExtensionContext,
  problemSlug: string,
  preferredLang?: string,
): Promise<void> {
  const config = vscode.workspace.getConfiguration('better-leetcode');
  let storagePath = config.get<string>('storagePath');

  if (storagePath === undefined || storagePath === '') {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Storage Folder for Better LeetCode Solutions',
    });

    if (selected === undefined || selected.length === 0) {
      void vscode.window.showWarningMessage('Storage folder is required to open problems.');
      return;
    }
    const firstSelected = selected[0];
    if (firstSelected === undefined) {
      void vscode.window.showWarningMessage('Storage folder is required to open problems.');
      return;
    }
    storagePath = firstSelected.fsPath;
    await config.update('storagePath', storagePath, vscode.ConfigurationTarget.Global);
  }

  let defaultLanguage = preferredLang || config.get<string>('defaultLanguage');
  let defaultDbLanguage = config.get<string>('defaultDbLanguage') || 'mysql';
  if (defaultLanguage === undefined || defaultLanguage === '') {
    const languages = [
      { label: 'Python3', value: 'python3' },
      { label: 'Go', value: 'golang' },
      { label: 'TypeScript', value: 'typescript' },
      { label: 'JavaScript', value: 'javascript' },
      { label: 'C++', value: 'cpp' },
      { label: 'Java', value: 'java' },
      { label: 'Rust', value: 'rust' },
      { label: 'C', value: 'c' },
      { label: 'C#', value: 'csharp' },
      { label: 'MySQL', value: 'mysql' },
      { label: 'MS SQL Server', value: 'mssql' },
      { label: 'Oracle', value: 'oraclesql' },
      { label: 'PostgreSQL', value: 'postgresql' },
    ];

    const selected = await vscode.window.showQuickPick(languages, {
      placeHolder: 'Select your default coding language for LeetCode',
    });

    if (!selected) {
      void vscode.window.showWarningMessage('Default language is required to open problems.');
      return;
    }
    defaultLanguage = selected.value;
    await config.update('defaultLanguage', defaultLanguage, vscode.ConfigurationTarget.Global);
  }

  let details: ProblemDetails;
  try {
    details = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching problem details for "${problemSlug}"...`,
        cancellable: false,
      },
      async () => {
        return await authManager.getClient().getProblemDetails(problemSlug);
      },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Failed to load problem details: ${errMsg}`);
    return;
  }

  if (details.paidOnly) {
    const status = authManager.getStatus();
    if (!status?.isPremium) {
      void vscode.window.showErrorMessage(
        `"${details.title}" is a premium problem. Please upgrade to LeetCode Premium to view it.`,
      );
      return;
    }
  }

  const problemDir = path.join(storagePath, problemSlug);
  if (!fs.existsSync(problemDir)) {
    fs.mkdirSync(problemDir, { recursive: true });
  }

  const extMap: Record<string, string> = {
    cpp: 'cpp',
    java: 'java',
    python3: 'py',
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    csharp: 'cs',
    c: 'c',
    golang: 'go',
    kotlin: 'kt',
    swift: 'swift',
    rust: 'rs',
    ruby: 'rb',
    php: 'php',
    mysql: 'sql',
    mssql: 'sql',
    oraclesql: 'sql',
    postgresql: 'sql',
  };

  let targetLang = defaultLanguage;
  const dbLangs = ['mysql', 'mssql', 'oraclesql', 'postgresql'];

  if (details.codeSnippets.length > 0) {
    const hasDefaultLang = details.codeSnippets.some((s) => s.langSlug === defaultLanguage);
    if (!hasDefaultLang) {
      const hasDbLangs = details.codeSnippets.some((s) => dbLangs.includes(s.langSlug));
      if (hasDbLangs) {
        if (details.codeSnippets.some((s) => s.langSlug === defaultDbLanguage)) {
          targetLang = defaultDbLanguage;
        } else {
          const dbSnippet = details.codeSnippets.find((s) => dbLangs.includes(s.langSlug));
          const firstSnippet = details.codeSnippets[0];
          targetLang = dbSnippet?.langSlug ?? firstSnippet?.langSlug ?? targetLang;
        }
      } else {
        const firstSnippet = details.codeSnippets[0];
        if (firstSnippet !== undefined) {
          targetLang = firstSnippet.langSlug;
        }
      }
    }
  }

  const ext = extMap[targetLang] !== undefined ? extMap[targetLang] : 'txt';
  const codeFilePath = path.join(problemDir, `main.${ext}`);

  let codeSnippet = '';
  if (details.codeSnippets.length > 0) {
    const found = details.codeSnippets.find((s) => s.langSlug === targetLang);
    if (found !== undefined) {
      codeSnippet = found.code;
    } else {
      const firstSnippet = details.codeSnippets[0];
      if (firstSnippet !== undefined) {
        codeSnippet = firstSnippet.code;
      }
    }
  }

  if (fs.existsSync(codeFilePath)) {
    const existingMetadata = readProblemMetadata(codeFilePath);
    if (existingMetadata) {
      targetLang = existingMetadata.lang;
      codeSnippet = existingMetadata.originalSnippet;
    }
  } else {
    // Wrap snippet with language-specific boilerplate to prevent linter errors
    const wrappedCode = BoilerplateManager.wrapWithBoilerplate(targetLang, codeSnippet);
    fs.writeFileSync(codeFilePath, wrappedCode, 'utf-8');
  }

  // Resolve inputLineCount using priority chain: cache → metaData → HTML → default 1
  const globalStoragePath = context.globalStorageUri.fsPath;
  const inputLineCount = resolveInputLineCount(globalStoragePath, details);

  // Store metadata for boilerplate extraction during test/submit
  const metadataPath = path.join(problemDir, '.metadata.json');
  const metadata: ProblemMetadata = {
    questionId: details.questionId,
    titleSlug: details.titleSlug,
    lang: targetLang,
    originalSnippet: codeSnippet,
    sampleTestCase: details.sampleTestCase,
    exampleTestcases: details.exampleTestcases ?? '',
    inputLineCount,
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  const testcasesPath = path.join(problemDir, 'testcases.txt');
  const allTestCases =
    details.exampleTestcases !== undefined && details.exampleTestcases !== ''
      ? details.exampleTestcases
      : details.sampleTestCase;

  if (!fs.existsSync(testcasesPath)) {
    if (allTestCases !== '') {
      fs.writeFileSync(testcasesPath, allTestCases, 'utf-8');
    }
  } else {
    // Upgrade old testcases.txt that only have the single sampleTestCase
    const existing = fs.readFileSync(testcasesPath, 'utf-8');
    if (
      details.sampleTestCase &&
      existing.trim() === details.sampleTestCase.trim() &&
      details.exampleTestcases
    ) {
      fs.writeFileSync(testcasesPath, details.exampleTestcases, 'utf-8');
    }
  }

  // Check if a *visible* editor tab for this problem is already open.
  // We use visibleTextEditors (actual on-screen tabs) instead of
  // workspace.textDocuments (which includes closed/cached documents).
  const visibleProblemEditor = vscode.window.visibleTextEditors.find((e) => {
    const meta = readProblemMetadata(e.document.uri.fsPath);
    return meta !== null && meta.titleSlug === problemSlug;
  });

  // Open Webview in Column One
  ProblemWebview.createOrShow(context.extensionUri, details);

  if (visibleProblemEditor) {
    // A tab for this problem is already visible — leave it untouched.
    // Only the webview (problem statement) is refreshed above.
    return;
  }

  // No visible editor for this problem — open the target language file.
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(codeFilePath));
  if (ext === 'sql') {
    const vscodeLangMap: Record<string, string> = {
      mysql: 'mysql',
      postgresql: 'postgres',
      mssql: 'sql',
      oraclesql: 'oraclesql',
    };
    const vscodeLangId = vscodeLangMap[targetLang] || 'sql';
    try {
      await vscode.languages.setTextDocumentLanguage(doc, vscodeLangId);
    } catch {
      try {
        await vscode.languages.setTextDocumentLanguage(doc, 'sql');
      } catch {}
    }
  }
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
}

/**
 * Handles the fuzzy search command.
 * Awaits full problem catalog loading to search all ~4k problems,
 * not just the subset that's been lazily loaded into the tree view.
 */
async function handleSearch(allProblemsProvider: AllProblemsTreeDataProvider): Promise<void> {
  const problems = await allProblemsProvider.loadProblemsAsync();
  if (problems.length === 0) {
    void vscode.window.showInformationMessage(
      'The problem catalog is empty. Please check your connection and try again.',
    );
    return;
  }

  const items = problems.map((problem) => ({
    label: `${problem.paidOnly ? '🔒 ' : ''}${problem.frontendQuestionId}. ${problem.title}`,
    description: problem.difficulty,
    detail: problem.titleSlug,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Search problem by ID or title (fuzzy match)...',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    void vscode.commands.executeCommand('better-leetcode.openProblem', selected.detail);
  }
}

/**
 * Reads the .metadata.json file from the same directory as the active solution file.
 * Returns null if the file doesn't exist or can't be parsed.
 *
 * @param filePath - Absolute path to the active solution file.
 * @returns The parsed problem metadata, or null.
 */
export function readProblemMetadata(filePath: string): ProblemMetadata | null {
  const dir = path.dirname(filePath);
  const metadataPath = path.join(dir, '.metadata.json');

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(raw) as ProblemMetadata;
  } catch {
    return null;
  }
}

/**
 * Reads test cases from the testcases.txt file in the solution directory.
 * Falls back to the sampleTestCase from metadata if the file doesn't exist.
 *
 * @param filePath - Absolute path to the active solution file.
 * @param fallback - Fallback test case string from metadata.
 * @returns The test cases string.
 */
export function readTestCases(filePath: string, fallback: string): string {
  const dir = path.dirname(filePath);
  const testcasesPath = path.join(dir, 'testcases.txt');

  if (fs.existsSync(testcasesPath)) {
    return fs.readFileSync(testcasesPath, 'utf-8');
  }
  return fallback;
}

// ── Global inputLineCount Cache ──────────────────────────────────────

/**
 * Path to the global inputLineCount cache file.
 * Stored at the extension's global storage path so it persists across sessions.
 */
function getInputLineCountCachePath(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'inputLineCount.json');
}

/**
 * Reads the global inputLineCount cache.
 *
 * @param globalStoragePath - Extension's global storage path.
 * @returns A map of titleSlug → inputLineCount.
 */
function readInputLineCountCache(globalStoragePath: string): Record<string, number> {
  const cachePath = getInputLineCountCachePath(globalStoragePath);
  if (!fs.existsSync(cachePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * Writes a single entry to the global inputLineCount cache.
 *
 * @param globalStoragePath - Extension's global storage path.
 * @param slug - The problem's titleSlug.
 * @param count - The resolved inputLineCount.
 */
function writeInputLineCountCache(globalStoragePath: string, slug: string, count: number): void {
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath, { recursive: true });
  }
  const cache = readInputLineCountCache(globalStoragePath);
  cache[slug] = count;
  const cachePath = getInputLineCountCachePath(globalStoragePath);
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

// ── inputLineCount Resolution ───────────────────────────────────────

/**
 * Attempts to derive inputLineCount from LeetCode's metaData JSON string.
 * Returns the number of function parameters, or null if unparseable.
 *
 * @param metaDataStr - The raw metaData JSON string from the API.
 */
export function deriveFromMetaData(metaDataStr: string | undefined): number | null {
  if (metaDataStr === undefined || metaDataStr === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(metaDataStr) as ProblemMetaData;
    if (parsed.params !== undefined && Array.isArray(parsed.params) && parsed.params.length > 0) {
      return parsed.params.length;
    }
  } catch {
    // Malformed JSON — fall through
  }
  return null;
}

/**
 * Attempts to derive inputLineCount by parsing the problem's HTML content.
 * Extracts example input blocks from <pre> tags and counts lines per case.
 *
 * @param content - The problem's HTML content string.
 * @param exampleTestcases - The raw exampleTestcases string from the API.
 */
export function deriveFromHtmlContent(
  content: string | undefined,
  exampleTestcases: string | undefined,
): number | null {
  if (
    content === undefined ||
    content === '' ||
    exampleTestcases === undefined ||
    exampleTestcases === ''
  ) {
    return null;
  }

  // Count non-empty lines in exampleTestcases
  const totalInputLines = exampleTestcases.split('\n').filter((l) => l.trim() !== '').length;
  if (totalInputLines === 0) {
    return null;
  }

  // Count example cases from the HTML by matching <strong>Input:</strong> occurrences
  const inputMatches = content.match(/<strong>Input:?<\/strong>/gi);
  const exampleCount = inputMatches !== null ? inputMatches.length : 0;
  if (exampleCount === 0) {
    return null;
  }

  // Lines per case = total input lines / number of examples
  const linesPerCase = Math.floor(totalInputLines / exampleCount);
  if (linesPerCase >= 1) {
    return linesPerCase;
  }

  return null;
}

/**
 * Resolves the inputLineCount for a problem using the priority chain:
 * 1. Global cache (instant, no computation)
 * 2. metaData.params.length (API field)
 * 3. HTML content parsing (fallback)
 * 4. Default: 1
 *
 * @param globalStoragePath - Extension's global storage path for the cache.
 * @param details - The fetched problem details.
 * @returns The resolved inputLineCount.
 */
export function resolveInputLineCount(globalStoragePath: string, details: ProblemDetails): number {
  // 1. Check global cache
  const cache = readInputLineCountCache(globalStoragePath);
  const cached = cache[details.titleSlug];
  if (cached !== undefined && cached >= 1) {
    return cached;
  }

  // 2. Try metaData
  const fromMetaData = deriveFromMetaData(details.metaData);
  if (fromMetaData !== null) {
    writeInputLineCountCache(globalStoragePath, details.titleSlug, fromMetaData);
    return fromMetaData;
  }

  // 3. Try HTML content parsing
  const fromHtml = deriveFromHtmlContent(details.content, details.exampleTestcases);
  if (fromHtml !== null) {
    writeInputLineCountCache(globalStoragePath, details.titleSlug, fromHtml);
    return fromHtml;
  }

  // 4. Default
  const defaultCount = 1;
  writeInputLineCountCache(globalStoragePath, details.titleSlug, defaultCount);
  return defaultCount;
}

/**
 * Splits a test case string into per-case groups for display.
 * Each test case consists of exactly `linesPerCase` non-empty lines.
 *
 * @param testCaseStr - The raw test case string (newline-separated).
 * @param linesPerCase - Number of input lines per test case (from inputLineCount).
 * @returns An array of test input strings, one per case.
 */
export function parseTestInputs(testCaseStr: string, linesPerCase: number): string[] {
  const lines = testCaseStr.split('\n').filter((line) => line.trim() !== '');
  if (linesPerCase <= 0 || lines.length === 0) {
    return [];
  }

  const inputs: string[] = [];
  for (let i = 0; i + linesPerCase <= lines.length; i += linesPerCase) {
    inputs.push(lines.slice(i, i + linesPerCase).join('\n'));
  }

  return inputs;
}

/**
 * Normalizes a SubmissionCheckResult by ensuring all array and string fields
 * have safe default values. LeetCode's API can return undefined for these
 * fields depending on the result type (compile error, runtime error, etc.).
 *
 * @param raw - The raw result from LeetCode's check endpoint.
 * @returns A normalized result safe for property access.
 */
export function normalizeResult(raw: SubmissionCheckResult): SubmissionCheckResult {
  return {
    state: raw.state ?? 'UNKNOWN',
    status_code: raw.status_code ?? 0,
    status_msg: raw.status_msg ?? 'Unknown',
    run_success: raw.run_success ?? false,
    total_correct: raw.total_correct ?? null,
    total_testcases: raw.total_testcases ?? null,
    status_runtime: raw.status_runtime ?? '',
    status_memory: raw.status_memory ?? '',
    memory_percentile: raw.memory_percentile ?? null,
    runtime_percentile: raw.runtime_percentile ?? null,
    code_answer: raw.code_answer ?? [],
    // LeetCode uses 'expected_code_answer' for interpret (test) runs and
    // 'expected_answer' for submissions. An empty array [] is not nullish,
    // so ?? alone won't fall through — check length explicitly.
    expected_answer:
      raw.expected_answer && raw.expected_answer.length > 0
        ? raw.expected_answer
        : (raw.expected_code_answer ?? []),
    code_output: raw.code_output ?? [],
    std_output_list: raw.std_output_list ?? [],
    compile_error: raw.compile_error ?? '',
    full_compile_error: raw.full_compile_error ?? '',
    runtime_error: raw.runtime_error ?? '',
    full_runtime_error: raw.full_runtime_error ?? '',
    input_formatted: raw.input_formatted ?? '',
    expected_output: raw.expected_output ?? '',
    last_testcase: raw.last_testcase ?? '',
  };
}

/**
 * Handles the Test Solution command.
 * Reads the active editor, extracts solution code (stripping boilerplate),
 * submits to LeetCode's interpret endpoint, polls for results, and displays
 * them in the Test Results panel.
 *
 * @param authManager - The LeetCode auth manager with an authenticated client.
 * @param testResultsPanel - The test results panel instance.
 */
async function handleTestSolution(
  authManager: LeetCodeAuthManager,
  testResultsPanel: TestResultsPanel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage('No active editor found. Open a solution file first.');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const metadata = readProblemMetadata(filePath);
  if (metadata === null) {
    void vscode.window.showErrorMessage(
      'Could not find problem metadata. Open a problem from the sidebar first.',
    );
    return;
  }

  const client = authManager.getClient();
  if (!client.hasCredentials()) {
    void vscode.window.showErrorMessage('Please sign in to LeetCode first.');
    return;
  }

  // Extract solution code by stripping boilerplate
  const fileContent = editor.document.getText();

  const submitLang = deriveLangFromExtension(filePath) ?? metadata.lang;

  const solutionCode = BoilerplateManager.extractSolutionCode(
    submitLang,
    fileContent,
    metadata.originalSnippet,
  );

  // Read test cases and trim to avoid phantom empty cases from trailing newlines
  let testCases = readTestCases(filePath, metadata.sampleTestCase).trim();
  if (testCases === '') {
    testCases = (metadata.exampleTestcases ?? metadata.sampleTestCase).trim();
  }

  // Ensure the Test Results panel is visible
  await vscode.commands.executeCommand('better-leetcode.views.testResults.focus');

  // Show loading state
  testResultsPanel.showLoading('Testing solution...');

  try {
    const interpretResult = await client.interpretSolution(
      metadata.titleSlug,
      metadata.questionId,
      submitLang,
      solutionCode,
      testCases,
    );

    const checkResult = await client.checkSubmissionStatus(interpretResult.interpret_id);
    const result = normalizeResult(checkResult);

    // Use inputLineCount from metadata to deterministically parse test inputs.
    // Backward compat: old .metadata.json files may not have inputLineCount, default to 1.
    const linesPerCase = metadata.inputLineCount ?? 1;
    const testInputs = parseTestInputs(testCases, linesPerCase);
    const caseCount = testInputs.length;

    // Truncate response arrays to match actual case count
    result.code_answer = result.code_answer.slice(0, caseCount);
    result.expected_answer = result.expected_answer.slice(0, caseCount);
    result.code_output = result.code_output.slice(0, caseCount);
    result.std_output_list = result.std_output_list.slice(0, caseCount);

    testResultsPanel.showResults({
      type: 'test',
      result,
      testInputs,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Test failed: ${errMsg}`);
  }
}

/**
 * Handles the Submit Solution command.
 * Similar to test but uses the formal submit endpoint, which runs against
 * all hidden test cases and counts as an official submission.
 *
 * @param authManager - The LeetCode auth manager with an authenticated client.
 * @param testResultsPanel - The test results panel instance.
 */
async function handleSubmitSolution(
  authManager: LeetCodeAuthManager,
  testResultsPanel: TestResultsPanel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage('No active editor found. Open a solution file first.');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const metadata = readProblemMetadata(filePath);
  if (metadata === null) {
    void vscode.window.showErrorMessage(
      'Could not find problem metadata. Open a problem from the sidebar first.',
    );
    return;
  }

  const client = authManager.getClient();
  if (!client.hasCredentials()) {
    void vscode.window.showErrorMessage('Please sign in to LeetCode first.');
    return;
  }

  // Extract solution code by stripping boilerplate
  const fileContent = editor.document.getText();

  const submitLang = deriveLangFromExtension(filePath) ?? metadata.lang;

  const solutionCode = BoilerplateManager.extractSolutionCode(
    submitLang,
    fileContent,
    metadata.originalSnippet,
  );

  // Ensure the Test Results panel is visible
  await vscode.commands.executeCommand('better-leetcode.views.testResults.focus');

  // Show loading state
  testResultsPanel.showLoading('Submitting solution...');

  try {
    const submitResult = await client.submit(
      metadata.titleSlug,
      metadata.questionId,
      submitLang,
      solutionCode,
    );

    const rawResult = await client.checkSubmissionStatus(String(submitResult.submission_id));
    const result = normalizeResult(rawResult);

    // For submissions, test inputs come from the last_testcase field if available
    const testInputs: string[] = [];
    if (result.last_testcase !== undefined && result.last_testcase !== '') {
      testInputs.push(result.last_testcase);
    }

    testResultsPanel.showResults({
      type: 'submit',
      result,
      testInputs,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Submit failed: ${errMsg}`);
  }
}

/**
 * Handles the Change Language command.
 * Reads the current problem metadata, fetches available code snippets,
 * lets the user pick a new language, and creates/opens the new solution file.
 *
 * @param authManager - The LeetCode auth manager.
 * @param context - The extension context for storage URI access.
 */
async function handleChangeLanguage(
  authManager: LeetCodeAuthManager,
  _context: vscode.ExtensionContext,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage('No active editor. Open a solution file first.');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const metadata = readProblemMetadata(filePath);
  if (metadata === null) {
    void vscode.window.showErrorMessage(
      'Could not find problem metadata. Open a problem from the sidebar first.',
    );
    return;
  }

  let details: ProblemDetails;
  try {
    details = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching available languages...',
        cancellable: false,
      },
      async () => {
        return await authManager.getClient().getProblemDetails(metadata.titleSlug);
      },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Failed to fetch problem details: ${errMsg}`);
    return;
  }

  if (details.codeSnippets.length === 0) {
    void vscode.window.showWarningMessage('No code snippets available for this problem.');
    return;
  }

  // Derive the current language from the active tab's file extension
  // instead of relying on metadata.lang, which may be stale.
  const activeLang = deriveLangFromExtension(filePath) ?? metadata.lang;

  const langItems = details.codeSnippets.map((snippet) => ({
    label: snippet.lang,
    description: snippet.langSlug === activeLang ? '(current)' : '',
    value: snippet.langSlug,
  }));

  const selected = await vscode.window.showQuickPick(langItems, {
    placeHolder: `Current: ${activeLang} — Select a new language`,
    matchOnDescription: true,
  });

  if (!selected) {
    return;
  }

  if (selected.value === activeLang) {
    const confirm = await vscode.window.showWarningMessage(
      `Do you want to reset the editor to the default ${selected.label} snippet? This will overwrite your current code.`,
      { modal: true },
      'Reset',
    );
    if (confirm !== 'Reset') {
      return;
    }
  }

  const newLang = selected.value;
  const config = vscode.workspace.getConfiguration('better-leetcode');
  const storagePath = config.get<string>('storagePath');

  if (storagePath === undefined || storagePath === '') {
    void vscode.window.showErrorMessage('Storage path not configured.');
    return;
  }

  const extMap: Record<string, string> = {
    cpp: 'cpp',
    java: 'java',
    python3: 'py',
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    csharp: 'cs',
    c: 'c',
    golang: 'go',
    kotlin: 'kt',
    swift: 'swift',
    rust: 'rs',
    ruby: 'rb',
    php: 'php',
    mysql: 'sql',
    mssql: 'sql',
    oraclesql: 'sql',
    postgresql: 'sql',
  };

  const ext = extMap[newLang] !== undefined ? extMap[newLang] : 'txt';
  const problemDir = path.dirname(filePath);
  const newFilePath = path.join(problemDir, `main.${ext}`);

  const snippet = details.codeSnippets.find((s) => s.langSlug === newLang);
  const codeSnippet = snippet !== undefined ? snippet.code : '';

  // NOTE: We intentionally do NOT update the global defaultLanguage setting here.
  // The language switcher only changes the language for this specific problem.
  // Use the "Change Default Language" command to change the global default.

  if (!fs.existsSync(newFilePath)) {
    const wrappedCode = BoilerplateManager.wrapWithBoilerplate(newLang, codeSnippet);
    fs.writeFileSync(newFilePath, wrappedCode, 'utf-8');
  } else if (newFilePath === filePath) {
    const wrappedCode = BoilerplateManager.wrapWithBoilerplate(newLang, codeSnippet);
    const visibleEditor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.fsPath === newFilePath,
    );
    if (visibleEditor) {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        visibleEditor.document.positionAt(0),
        visibleEditor.document.positionAt(visibleEditor.document.getText().length),
      );
      edit.replace(visibleEditor.document.uri, fullRange, wrappedCode);
      await vscode.workspace.applyEdit(edit);
    } else {
      fs.writeFileSync(newFilePath, wrappedCode, 'utf-8');
    }
  }

  // Update metadata with new language
  const metadataPath = path.join(problemDir, '.metadata.json');
  const updatedMetadata: ProblemMetadata = {
    ...metadata,
    lang: newLang,
    originalSnippet: codeSnippet,
  };
  fs.writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2), 'utf-8');

  // Open the new file
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(newFilePath));
  if (ext === 'sql') {
    const vscodeLangMap: Record<string, string> = {
      mysql: 'mysql',
      postgresql: 'postgres',
      mssql: 'sql',
      oraclesql: 'oraclesql',
    };
    const vscodeLangId = vscodeLangMap[newLang] || 'sql';
    try {
      await vscode.languages.setTextDocumentLanguage(doc, vscodeLangId);
    } catch {
      try {
        await vscode.languages.setTextDocumentLanguage(doc, 'sql');
      } catch {}
    }
  }
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);

  void vscode.window.showInformationMessage(`Language switched to ${selected.label}.`);
}

/**
 * Handles changing the default language configuration.
 */
async function handleChangeDefaultLanguage(): Promise<void> {
  const config = vscode.workspace.getConfiguration('better-leetcode');
  const currentLang = config.get<string>('defaultLanguage', '');
  const langs = [
    'cpp',
    'java',
    'python3',
    'python',
    'javascript',
    'typescript',
    'csharp',
    'c',
    'golang',
    'kotlin',
    'swift',
    'rust',
    'ruby',
    'php',
  ];
  const items = langs.map((lang) => ({
    label: lang,
    description: lang === currentLang ? '(current default)' : '',
    value: lang,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Current: ${currentLang || 'None'} — Select a new default language`,
  });

  if (selected) {
    await config.update('defaultLanguage', selected.value, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`Default language set to ${selected.label}.`);
  }
}

/**
 * Handles changing the default SQL language configuration.
 */
async function handleChangeDefaultDbLanguage(): Promise<void> {
  const config = vscode.workspace.getConfiguration('better-leetcode');
  const currentDbLang = config.get<string>('defaultDbLanguage', 'mysql');
  const dbLangs = ['mysql', 'mssql', 'oraclesql', 'postgresql'];

  const items = dbLangs.map((lang) => ({
    label: lang,
    description: lang === currentDbLang ? '(current default)' : '',
    value: lang,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Current: ${currentDbLang} — Select a new default SQL language`,
  });

  if (selected) {
    await config.update('defaultDbLanguage', selected.value, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`Default SQL language set to ${selected.label}.`);
  }
}

/**
 * Activates the VS Code extension.
 * Sets up the auth manager, status bar controller, and registers user commands.
 *
 * @param context - The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // ── Initialize Logger ────────────────────────────────────────────
  const config = vscode.workspace.getConfiguration('better-leetcode');
  const logLevelStr = config.get<string>('logLevel', 'info');
  const logger = Logger.initialize({
    level: parseLogLevel(logLevelStr),
    fileConfig: {
      logDir: Logger.getDefaultLogDir(),
      baseFileName: 'app',
      maxFileSize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
    },
    redactPatterns: [],
  });
  context.subscriptions.push(logger);
  logger.info('extension', 'Better LeetCode extension activating');

  // Listen for log level changes at runtime
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('better-leetcode.logLevel')) {
        const newLevel = vscode.workspace
          .getConfiguration('better-leetcode')
          .get<string>('logLevel', 'info');
        logger.setLevel(parseLogLevel(newLevel));
        logger.info('extension', `Log level changed to ${newLevel}`);
      }
    }),
  );

  const authManager = new LeetCodeAuthManager(context);
  const statusBar = new LeetCodeStatusBarController(authManager);

  context.subscriptions.push(statusBar);
  statusBar.show();

  await authManager.initialize();

  // Register URI handler for Web Authorization callback
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        await authManager.handleUri(uri);
      },
    }),
  );

  // Register Tree Views
  const dailyChallengeProvider = new DailyChallengeTreeDataProvider(authManager);
  vscode.window.registerTreeDataProvider(
    'better-leetcode.views.dailyChallenge',
    dailyChallengeProvider,
  );

  const allProblemsProvider = new AllProblemsTreeDataProvider(authManager);
  vscode.window.registerTreeDataProvider('better-leetcode.views.allProblems', allProblemsProvider);

  const studyListsProvider = new StudyListsTreeDataProvider(authManager);
  vscode.window.registerTreeDataProvider('better-leetcode.views.studyLists', studyListsProvider);

  const contestsProvider = new ContestsTreeDataProvider(authManager, allProblemsProvider);
  vscode.window.registerTreeDataProvider('better-leetcode.views.contests', contestsProvider);

  // Register Test Results Panel
  const testResultsPanel = new TestResultsPanel(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TestResultsPanel.viewType, testResultsPanel),
  );

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('better-leetcode.signin', () =>
      handleSignIn(authManager, context),
    ),
    vscode.commands.registerCommand('better-leetcode.signout', () => handleSignOut(authManager)),
    vscode.commands.registerCommand('better-leetcode.showUser', () =>
      handleShowUser(authManager, context),
    ),
    vscode.commands.registerCommand('better-leetcode.openProblem', (problemSlug: string) => {
      void handleOpenProblem(authManager, context, problemSlug);
    }),
    vscode.commands.registerCommand('better-leetcode.showProblemStatement', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const metadata = readProblemMetadata(editor.document.uri.fsPath);
      if (metadata) {
        void handleOpenProblem(authManager, context, metadata.titleSlug, metadata.lang);
      }
    }),
    vscode.commands.registerCommand('better-leetcode.openEditor', () => {
      if (ProblemWebview.currentPanel?.currentProblemSlug) {
        void handleOpenProblem(
          authManager,
          context,
          ProblemWebview.currentPanel.currentProblemSlug,
        );
      }
    }),
    vscode.commands.registerCommand('better-leetcode.search', () => {
      void handleSearch(allProblemsProvider);
    }),
    vscode.commands.registerCommand('better-leetcode.changeLanguage', () => {
      void handleChangeLanguage(authManager, context);
    }),
    vscode.commands.registerCommand('better-leetcode.changeDefaultLanguage', () => {
      void handleChangeDefaultLanguage();
    }),
    vscode.commands.registerCommand('better-leetcode.changeDefaultDbLanguage', () => {
      void handleChangeDefaultDbLanguage();
    }),
    vscode.commands.registerCommand('better-leetcode.testSolution', () => {
      void handleTestSolution(authManager, testResultsPanel);
    }),
    vscode.commands.registerCommand('better-leetcode.submitSolution', () => {
      void handleSubmitSolution(authManager, testResultsPanel);
    }),
    vscode.commands.registerCommand('better-leetcode.refresh', () => {
      logger.debug('extension', 'Manual refresh triggered (global)');
      dailyChallengeProvider.refresh();
      allProblemsProvider.refresh();
      studyListsProvider.refresh();
      contestsProvider.refresh();
    }),
    vscode.commands.registerCommand('better-leetcode.refreshDailyChallenge', () => {
      logger.debug('extension', 'Manual refresh triggered (Daily Challenge)');
      dailyChallengeProvider.refresh();
    }),
    vscode.commands.registerCommand('better-leetcode.refreshAllProblems', () => {
      logger.debug('extension', 'Manual refresh triggered (All Problems)');
      allProblemsProvider.refresh();
    }),
    vscode.commands.registerCommand('better-leetcode.refreshStudyLists', () => {
      logger.debug('extension', 'Manual refresh triggered (Study Lists)');
      studyListsProvider.refresh();
    }),
    vscode.commands.registerCommand('better-leetcode.refreshContests', () => {
      logger.debug('extension', 'Manual refresh triggered (Contests)');
      contestsProvider.refresh();
    }),
    vscode.commands.registerCommand('better-leetcode.fullRefreshProblems', () => {
      logger.info('extension', 'Full refresh triggered — clearing disk cache');
      allProblemsProvider.fullRefresh();
    }),
    vscode.commands.registerCommand('better-leetcode.deleteCache', () => {
      allProblemsProvider.deleteCache();
      void vscode.window.showInformationMessage(
        `Problem cache deleted: ${allProblemsProvider.getCacheFilePath()}`,
      );
    }),
    vscode.commands.registerCommand('better-leetcode.showLogs', () => {
      logger.show();
    }),
  );

  // Trigger a global refresh when auth session changes
  context.subscriptions.push(
    authManager.onDidChangeSession(() => {
      logger.info('extension', 'Auth state changed, triggering global refresh');
      void vscode.commands.executeCommand('better-leetcode.refresh');
    }),
  );

  // Track if active editor is a LeetCode problem
  const updateLeetCodeEditorContext = (editor: vscode.TextEditor | undefined) => {
    let isLeetCodeEditor = false;
    if (editor) {
      const metadata = readProblemMetadata(editor.document.uri.fsPath);
      if (metadata !== null) {
        isLeetCodeEditor = true;
      }
    }
    void vscode.commands.executeCommand(
      'setContext',
      'better-leetcode.isLeetCodeEditor',
      isLeetCodeEditor,
    );
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateLeetCodeEditorContext),
  );
  updateLeetCodeEditorContext(vscode.window.activeTextEditor);

  // Handle messages from the test results webview
  testResultsPanel.onMessage((message: { command: string; input?: unknown }) => {
    if (message.command === 'openProblemStatement') {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const filePath = editor.document.uri.fsPath;
      const metadata = readProblemMetadata(filePath);
      if (metadata === null) {
        void vscode.window.showWarningMessage(
          'Could not find problem metadata for the current file.',
        );
        return;
      }
      void handleOpenProblem(authManager, context, metadata.titleSlug, metadata.lang);
    } else if (message.command === 'addTestCase' && message.input) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const dir = path.dirname(editor.document.uri.fsPath);
      const testcasesPath = path.join(dir, 'testcases.txt');
      let existing = '';
      if (fs.existsSync(testcasesPath)) {
        existing = fs.readFileSync(testcasesPath, 'utf-8');
      }
      const inputStr =
        typeof message.input === 'string' ? message.input : String(message.input || '');
      const existingLines = existing
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '');
      if (!existingLines.includes(inputStr.trim())) {
        const newContent = existing.trim() !== '' ? existing.trim() + '\n' + inputStr : inputStr;
        fs.writeFileSync(testcasesPath, newContent, 'utf-8');
        void vscode.window.showInformationMessage('Test case added to testcases.txt');
      } else {
        void vscode.window.showInformationMessage('Test case already exists in testcases.txt');
      }
    }
  });
}

/**
 * Deactivates the VS Code extension.
 */
export function deactivate(): void {
  // Resources managed via context.subscriptions are automatically disposed.
}
