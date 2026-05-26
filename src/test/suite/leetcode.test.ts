import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseCookies, LeetCodeClient, LeetCodeAuthManager } from '../../leetcode';

class MockSecretStorage implements vscode.SecretStorage {
  private storage = new Map<string, string>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  public readonly onDidChange = this._onDidChange.event;

  public async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  public async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  public async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    this._onDidChange.fire({ key });
  }

  public async delete(key: string): Promise<void> {
    this.storage.delete(key);
    this._onDidChange.fire({ key });
  }
}

function createMockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

suite('LeetCode Module Test Suite', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

  setup(() => {
    fetchMock = () => Promise.reject(new Error('Fetch mock not configured'));
    globalThis.fetch = (url, init) => fetchMock(url, init);
  });

  teardown(() => {
    globalThis.fetch = originalFetch;
  });

  suite('Cookie Parser', () => {
    test('Should parse valid cookies containing session and csrf tokens', () => {
      const cookieStr = 'LEETCODE_SESSION=session123; csrftoken=csrf456; otherCookie=value;';
      const parsed = parseCookies(cookieStr);
      assert.ok(parsed);
      assert.strictEqual(parsed.session, 'session123');
      assert.strictEqual(parsed.csrfToken, 'csrf456');
    });

    test('Should return undefined if LEETCODE_SESSION is missing', () => {
      const cookieStr = 'csrftoken=csrf456; otherCookie=value;';
      const parsed = parseCookies(cookieStr);
      assert.strictEqual(parsed, undefined);
    });

    test('Should return undefined if csrftoken is missing', () => {
      const cookieStr = 'LEETCODE_SESSION=session123; otherCookie=value;';
      const parsed = parseCookies(cookieStr);
      assert.strictEqual(parsed, undefined);
    });
  });

  suite('LeetCodeClient', () => {
    test('Should make query and return results', async () => {
      const client = new LeetCodeClient();
      client.setCookieString('LEETCODE_SESSION=session123; csrftoken=csrf456;');

      const expectedData = { matchedUser: { username: 'testuser' } };
      fetchMock = async (url, init) => {
        assert.strictEqual(url.toString(), 'https://leetcode.com/graphql/');
        assert.ok(init);
        assert.strictEqual(init.method, 'POST');
        const headers = init.headers as Record<string, string>;
        assert.strictEqual(headers['x-csrftoken'], 'csrf456');
        assert.strictEqual(
          headers['Cookie'],
          'LEETCODE_SESSION=session123; csrftoken=csrf456;'
        );
        return createMockResponse({ data: expectedData });
      };

      const result = await client.query<{ matchedUser: { username: string } }>('query test {}');
      assert.deepStrictEqual(result, expectedData);
    });

    test('Should throw error when GraphQL returns errors', async () => {
      const client = new LeetCodeClient();
      fetchMock = async () => {
        return createMockResponse({
          errors: [{ message: 'Something went wrong' }],
        });
      };

      await assert.rejects(
        () => client.query('query {}'),
        /Something went wrong/
      );
    });

    test('Should get user status', async () => {
      const client = new LeetCodeClient();
      const mockStatus = {
        isSignedIn: true,
        isPremium: false,
        username: 'coder123',
        realName: 'Coder',
        avatar: 'avatar_url',
        userSlug: 'coder123',
        isAdmin: false,
      };

      fetchMock = async () => {
        return createMockResponse({
          data: { userStatus: mockStatus },
        });
      };

      const status = await client.getUserStatus();
      assert.deepStrictEqual(status, mockStatus);
    });
  });

  suite('LeetCodeAuthManager', () => {
    let mockContext: vscode.ExtensionContext;
    let mockSecrets: MockSecretStorage;

    setup(() => {
      mockSecrets = new MockSecretStorage();
      mockContext = {
        secrets: mockSecrets,
        subscriptions: [],
      } as unknown as vscode.ExtensionContext;
    });

    test('Should initialize with no session when no cookie is stored', async () => {
      const manager = new LeetCodeAuthManager(mockContext);
      await manager.initialize();
      assert.strictEqual(manager.getStatus(), undefined);
    });

    test('Should initialize with session when valid cookie is stored', async () => {
      const cookieStr = 'LEETCODE_SESSION=session123; csrftoken=csrf456;';
      await mockSecrets.store('better-leetcode.cookie', cookieStr);

      const mockStatus = {
        isSignedIn: true,
        isPremium: true,
        username: 'premium_user',
        realName: 'Premium User',
        avatar: 'avatar',
        userSlug: 'premium_user',
        isAdmin: false,
      };

      fetchMock = async () => {
        return createMockResponse({
          data: { userStatus: mockStatus },
        });
      };

      const manager = new LeetCodeAuthManager(mockContext);
      await manager.initialize();

      assert.ok(manager.getStatus());
      assert.strictEqual(manager.getStatus()?.username, 'premium_user');
      assert.strictEqual(manager.getStatus()?.isPremium, true);
    });

    test('Should handle login and save cookie to secure storage', async () => {
      const mockStatus = {
        isSignedIn: true,
        isPremium: false,
        username: 'new_user',
        realName: 'New User',
        avatar: 'avatar',
        userSlug: 'new_user',
        isAdmin: false,
      };

      fetchMock = async () => {
        return createMockResponse({
          data: { userStatus: mockStatus },
        });
      };

      const manager = new LeetCodeAuthManager(mockContext);
      const cookieStr = 'LEETCODE_SESSION=session_login; csrftoken=csrf_login;';

      const status = await manager.login(cookieStr);
      assert.strictEqual(status.username, 'new_user');
      assert.strictEqual(manager.getStatus()?.username, 'new_user');

      const savedSecret = await mockSecrets.get('better-leetcode.cookie');
      assert.strictEqual(savedSecret, cookieStr);
    });

    test('Should handle logout and delete cookie from storage', async () => {
      const manager = new LeetCodeAuthManager(mockContext);
      const cookieStr = 'LEETCODE_SESSION=session_logout; csrftoken=csrf_logout;';

      await mockSecrets.store('better-leetcode.cookie', cookieStr);
      manager.getClient().setCookieString(cookieStr);

      await manager.logout();
      assert.strictEqual(manager.getStatus(), undefined);
      assert.strictEqual(manager.getClient().hasCredentials(), false);

      const savedSecret = await mockSecrets.get('better-leetcode.cookie');
      assert.strictEqual(savedSecret, undefined);
    });
  });
});
