import * as vscode from 'vscode';
import { LeetCodeClient } from './client';
import { UserStatus } from './types';
import { Logger } from '../logger';

/**
 * Manages the LeetCode authentication session and secure storage of cookies.
 */
export class LeetCodeAuthManager {
  private static readonly SECRET_KEY = 'better-leetcode.cookie';
  private readonly client: LeetCodeClient;
  private readonly context: vscode.ExtensionContext;
  private userStatus: UserStatus | undefined;
  private readonly _onDidChangeSession = new vscode.EventEmitter<UserStatus | undefined>();

  /**
   * Event fired when the user's session state changes.
   */
  public readonly onDidChangeSession = this._onDidChangeSession.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.client = new LeetCodeClient();
    this.updateClientEndpoint();

    // Listen for settings changes to update client endpoint and re-verify
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('better-leetcode.endpoint')) {
          this.updateClientEndpoint();
          await this.verifySession();
        }
      }),
    );
  }

  /**
   * Initializes the manager by reading the saved cookie from secure storage
   * and verifying the session if one exists.
   */
  public async initialize(): Promise<void> {
    const cookie = await this.context.secrets.get(LeetCodeAuthManager.SECRET_KEY);
    if (cookie !== undefined) {
      Logger.getInstance().info('auth', 'Restoring saved session from secure storage');
      this.client.setCookieString(cookie);
      await this.verifySession();
    } else {
      Logger.getInstance().debug('auth', 'No saved session found in secure storage');
    }
  }

  /**
   * Verifies the current session cookie against the configured LeetCode endpoint.
   * Updates the user status accordingly.
   *
   * @returns The user's status if successfully verified, otherwise undefined.
   */
  public async verifySession(): Promise<UserStatus | undefined> {
    if (!this.client.hasCredentials()) {
      this.setSession(undefined);
      return undefined;
    }

    try {
      const status = await this.client.getUserStatus();
      if (status.isSignedIn) {
        Logger.getInstance().info('auth', `Session verified for user: ${status.username}`);
        this.setSession(status);
        return status;
      }
      Logger.getInstance().warn('auth', 'Session cookie present but user is not signed in');
      this.setSession(undefined);
      return undefined;
    } catch (err) {
      // Gracefully handle validation failure (e.g. invalid cookie, network down)
      Logger.getInstance().error('auth', 'Session verification failed', err);
      this.setSession(undefined);
      return undefined;
    }
  }

  /**
   * Attempts to sign in the user using a raw cookie string.
   * Validates the cookie first, then stores it securely on success.
   *
   * @param cookieString - The raw cookie header string to authenticate.
   * @returns UserStatus representing the signed-in user profile.
   */
  public async login(cookieString: string): Promise<UserStatus> {
    const tempClient = new LeetCodeClient();
    tempClient.setEndpoint(this.client.getEndpoint());
    tempClient.setCookieString(cookieString);

    const status = await tempClient.getUserStatus();
    if (!status.isSignedIn) {
      Logger.getInstance().error(
        'auth',
        'Login failed: user is not signed in after cookie validation',
      );
      throw new Error('Authentication failed: user is not signed in.');
    }

    // Save to secure SecretStorage
    await this.context.secrets.store(LeetCodeAuthManager.SECRET_KEY, cookieString);
    this.client.setCookieString(cookieString);
    this.setSession(status);
    Logger.getInstance().info('auth', `Login successful: ${status.username}`);
    return status;
  }

  /**
   * Logs out the user by clearing credentials and deleting the stored cookie.
   */
  public async logout(): Promise<void> {
    Logger.getInstance().info('auth', 'User logging out');
    await this.context.secrets.delete(LeetCodeAuthManager.SECRET_KEY);
    this.client.clearCredentials();
    this.setSession(undefined);
  }

  /**
   * Gets the currently authenticated user's profile status.
   */
  public getStatus(): UserStatus | undefined {
    return this.userStatus;
  }

  /**
   * Gets the LeetCode API client instance.
   */
  public getClient(): LeetCodeClient {
    return this.client;
  }

  /**
   * Updates the client's endpoint from the vscode settings.
   */
  private updateClientEndpoint(): void {
    const endpoint = vscode.workspace
      .getConfiguration('better-leetcode')
      .get<string>('endpoint', 'https://leetcode.com');
    this.client.setEndpoint(endpoint);
  }

  /**
   * Updates the internal user status and triggers the change event.
   */
  private setSession(status: UserStatus | undefined): void {
    this.userStatus = status;
    void vscode.commands.executeCommand(
      'setContext',
      'better-leetcode.isSignedIn',
      status !== undefined ? status.isSignedIn : false,
    );
    this._onDidChangeSession.fire(status);
  }
}
