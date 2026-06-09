import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseCookies, LeetCodeClient, LeetCodeAuthManager } from '../../leetcode';
import { Logger, LogLevel } from '../../logger';

class MockSecretStorage implements vscode.SecretStorage {
  private storage = new Map<string, string>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  public readonly onDidChange = this._onDidChange.event;

  public keys(): Promise<string[]> {
    return Promise.resolve(Array.from(this.storage.keys()));
  }

  public get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.storage.get(key));
  }

  public store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    this._onDidChange.fire({ key });
    return Promise.resolve();
  }

  public delete(key: string): Promise<void> {
    this.storage.delete(key);
    this._onDidChange.fire({ key });
    return Promise.resolve();
  }
}

function createMockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

suite('LeetCode Module Test Suite', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

  suiteSetup(() => {
    Logger.initialize({
      level: LogLevel.DEBUG,
      fileConfig: {
        logDir: Logger.getDefaultLogDir(),
        baseFileName: 'better-leetcode-test',
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 5,
      },
      redactPatterns: [],
    });
  });

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

    test('Should handle empty string, extra whitespace, and malformed pairs', () => {
      assert.strictEqual(parseCookies(''), undefined);
      assert.strictEqual(parseCookies('   '), undefined);

      const parsed = parseCookies('  LEETCODE_SESSION=sess ;   csrftoken=csrf  ; malformedPair ;');
      assert.ok(parsed);
      assert.strictEqual(parsed.session, 'sess');
      assert.strictEqual(parsed.csrfToken, 'csrf');
    });
  });

  suite('LeetCodeClient', () => {
    test('Should make query and return results', async () => {
      const client = new LeetCodeClient();
      client.setCookieString('LEETCODE_SESSION=session123; csrftoken=csrf456;');

      const expectedData = { matchedUser: { username: 'testuser' } };
      fetchMock = (url, init) => {
        const urlStr =
          typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        assert.strictEqual(urlStr, 'https://leetcode.com/graphql/');
        assert.ok(init);
        assert.strictEqual(init.method, 'POST');
        const headers = init.headers as Record<string, string>;
        assert.strictEqual(headers['x-csrftoken'], 'csrf456');
        assert.strictEqual(headers['Cookie'], 'LEETCODE_SESSION=session123; csrftoken=csrf456;');
        return Promise.resolve(createMockResponse({ data: expectedData }));
      };

      const result = await client.query<{ matchedUser: { username: string } }>('query test {}');
      assert.deepStrictEqual(result, expectedData);
    });

    test('Should throw error when GraphQL returns errors', async () => {
      const client = new LeetCodeClient();
      fetchMock = () => {
        return Promise.resolve(
          createMockResponse({
            errors: [{ message: 'Something went wrong' }],
          }),
        );
      };

      await assert.rejects(() => client.query('query {}'), /Something went wrong/);
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

      fetchMock = () => {
        return Promise.resolve(
          createMockResponse({
            data: { userStatus: mockStatus },
          }),
        );
      };

      const status = await client.getUserStatus();
      assert.deepStrictEqual(status, mockStatus);
    });

    test('Should fetch problem details with topic tags and hints', async () => {
      const client = new LeetCodeClient();
      const mockDetails = {
        questionId: '1',
        questionFrontendId: '1',
        title: 'Two Sum',
        titleSlug: 'two-sum',
        content: '<p>Solve it.</p>',
        difficulty: 'Easy' as const,
        codeSnippets: [{ lang: 'Go', langSlug: 'golang', code: 'func twoSum...' }],
        sampleTestCase: '[2,7,11,15]\n9',
        exampleTestcases: '[2,7,11,15]\n9',
        metaData: '{}',
        paidOnly: false,
        topicTags: [
          { name: 'Array', slug: 'array' },
          { name: 'Hash Table', slug: 'hash-table' },
        ],
        hints: ['Hint 1', 'Hint 2'],
      };

      fetchMock = (_url, init) => {
        const bodyStr = init?.body as string;
        assert.ok(bodyStr.includes('topicTags'));
        assert.ok(bodyStr.includes('hints'));
        return Promise.resolve(
          createMockResponse({
            data: { question: mockDetails },
          }),
        );
      };

      const details = await client.getProblemDetails('two-sum');
      assert.deepStrictEqual(details, mockDetails);
      assert.ok(details.topicTags);
      const tags = details.topicTags!;
      assert.strictEqual(tags.length, 2);
      assert.strictEqual(tags[0]!.name, 'Array');
      assert.strictEqual(tags[1]!.name, 'Hash Table');

      assert.ok(details.hints);
      const hints = details.hints!;
      assert.strictEqual(hints.length, 2);
      assert.strictEqual(hints[0], 'Hint 1');
      assert.strictEqual(hints[1], 'Hint 2');
    });

    test('Should fetch contests list successfully', async () => {
      const client = new LeetCodeClient();
      const mockContests = [
        {
          titleSlug: 'weekly-contest-504',
          title: 'Weekly Contest 504',
          startTime: 1779802484,
          duration: 5400,
        },
      ];

      fetchMock = (_url, init) => {
        const bodyStr = init?.body as string;
        assert.ok(bodyStr.includes('contestV2HistoryContests'));
        return Promise.resolve(
          createMockResponse({
            data: {
              contestV2HistoryContests: {
                contests: mockContests,
              },
            },
          }),
        );
      };

      const contests = await client.getContests(5);
      assert.strictEqual(contests.length, 1);
      assert.ok(contests[0]);
      assert.strictEqual(contests[0]!.titleSlug, 'weekly-contest-504');
    });

    test('Should fall back to contestV2PastContest query on getContests primary query failure', async () => {
      const client = new LeetCodeClient();
      const mockFallbackContests = [
        {
          titleSlug: 'weekly-contest-fallback',
          title: 'Weekly Contest Fallback',
          startTime: 1779802484,
          duration: 5400,
        },
      ];

      let callsCount = 0;
      fetchMock = (_url, init) => {
        callsCount++;
        const bodyStr = init?.body as string;
        if (bodyStr.includes('contestV2HistoryContests')) {
          return Promise.reject(new Error('GraphQL Error'));
        }
        if (bodyStr.includes('contestV2PastContest')) {
          return Promise.resolve(
            createMockResponse({
              data: {
                contestV2PastLlmContest: mockFallbackContests,
              },
            }),
          );
        }
        return Promise.reject(new Error('Unexpected fetch'));
      };

      const contests = await client.getContests(5);
      assert.strictEqual(contests.length, 1);
      assert.ok(contests[0]);
      assert.strictEqual(contests[0]!.titleSlug, 'weekly-contest-fallback');
      assert.strictEqual(callsCount, 2);
    });

    test('Should fetch contest info and questions successfully via GraphQL', async () => {
      const client = new LeetCodeClient();

      fetchMock = (url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        assert.ok(urlStr.includes('/graphql/'));
        const bodyStr = init?.body as string;
        assert.ok(bodyStr.includes('contest'));
        assert.ok(bodyStr.includes('weekly-contest-504'));
        return Promise.resolve(
          createMockResponse({
            data: {
              contest: {
                title: 'Weekly Contest 504',
                titleSlug: 'weekly-contest-504',
                description: 'A weekly contest',
                startTime: 1779802484,
                duration: 5400,
                questions: [
                  {
                    title: 'Q1 Title',
                    titleSlug: 'q1-slug',
                    credit: 3,
                    questionId: '1001',
                  },
                ],
              },
            },
          }),
        );
      };

      const info = await client.getContestInfo('weekly-contest-504');
      assert.strictEqual(info.contest.title, 'Weekly Contest 504');
      assert.strictEqual(info.contest.title_slug, 'weekly-contest-504');
      assert.strictEqual(info.questions.length, 1);
      assert.ok(info.questions[0]);
      assert.strictEqual(info.questions[0]!.title_slug, 'q1-slug');
      assert.strictEqual(info.questions[0]!.question_id, 1001);
      assert.strictEqual(info.questions[0]!.credit, 3);
    });

    test('Should handle REST interpretSolution request', async () => {
      const client = new LeetCodeClient();
      client.setCookieString('LEETCODE_SESSION=s; csrftoken=c;');
      fetchMock = (url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        assert.ok(urlStr.includes('/interpret_solution/'));
        assert.strictEqual(init?.method, 'POST');
        return Promise.resolve(createMockResponse({ interpret_id: 'test-interpret-id' }));
      };
      const res = await client.interpretSolution('two-sum', '1', 'python3', 'print(1)', '1\\n2');
      assert.strictEqual(res.interpret_id, 'test-interpret-id');
    });

    test('Should fetch getAllProblems efficiently via batching', async () => {
      const client = new LeetCodeClient();
      let reqCount = 0;
      fetchMock = () => {
        reqCount++;
        return Promise.resolve(
          createMockResponse({
            data: {
              problemsetQuestionList: {
                total: 5,
                questions: [{ frontendQuestionId: reqCount.toString() }], // Mock varying question
              },
            },
          }),
        );
      };

      const problems = await client.getAllProblems(2); // Batch size 2, total 5 means 3 requests (0, 2, 4)
      assert.strictEqual(problems.length, 3);
      assert.strictEqual(reqCount, 3);
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
        extension: {
          id: 'ayanrocks.better-leetcode',
        },
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

      fetchMock = () => {
        return Promise.resolve(
          createMockResponse({
            data: { userStatus: mockStatus },
          }),
        );
      };

      const manager = new LeetCodeAuthManager(mockContext);
      await manager.initialize();

      assert.ok(manager.getStatus());
      assert.strictEqual(manager.getStatus()?.username, 'premium_user');
      assert.strictEqual(manager.getStatus()?.isPremium, true);
    });

    test('Should fail login when user is not signed in', async () => {
      fetchMock = () =>
        Promise.resolve(createMockResponse({ data: { userStatus: { isSignedIn: false } } }));
      const manager = new LeetCodeAuthManager(mockContext);
      await assert.rejects(
        () => manager.login('LEETCODE_SESSION=a; csrftoken=b;'),
        /user is not signed in/,
      );
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

      fetchMock = () => {
        return Promise.resolve(
          createMockResponse({
            data: { userStatus: mockStatus },
          }),
        );
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

    suite('handleUri (Web Authorization callback)', () => {
      test('Should login successfully when URI contains a valid cookie and there is a pending auth request', async () => {
        const mockStatus = {
          isSignedIn: true,
          isPremium: false,
          username: 'web_auth_user',
          realName: 'Web Auth User',
          avatar: 'avatar',
          userSlug: 'web_auth_user',
          isAdmin: false,
        };

        fetchMock = () => {
          return Promise.resolve(
            createMockResponse({
              data: { userStatus: mockStatus },
            }),
          );
        };

        const manager = new LeetCodeAuthManager(mockContext);
        manager.pendingAuth = true;
        const cookieValue = 'LEETCODE_SESSION=web_sess; csrftoken=web_csrf;';
        const uri = vscode.Uri.parse(
          `vscode://ayanrocks.better-leetcode/?cookie=${encodeURIComponent(cookieValue)}`,
        );

        await manager.handleUri(uri);
        assert.ok(manager.getStatus());
        assert.strictEqual(manager.getStatus()?.username, 'web_auth_user');

        const savedSecret = await mockSecrets.get('better-leetcode.cookie');
        assert.strictEqual(savedSecret, cookieValue);
      });

      test('Should not crash when URI has no cookie parameter', async () => {
        const manager = new LeetCodeAuthManager(mockContext);
        manager.pendingAuth = true;
        const uri = vscode.Uri.parse('vscode://ayanrocks.better-leetcode/?other=value');

        // Should not throw — just shows an error message internally
        await manager.handleUri(uri);
        assert.strictEqual(manager.getStatus(), undefined);

        // Assert failed callback does not persist credentials
        const savedSecret = await mockSecrets.get('better-leetcode.cookie');
        assert.strictEqual(savedSecret, undefined);
        assert.strictEqual(manager.getClient().hasCredentials(), false);
      });

      test('Should handle login failure from invalid cookie gracefully', async () => {
        fetchMock = () =>
          Promise.resolve(createMockResponse({ data: { userStatus: { isSignedIn: false } } }));

        const manager = new LeetCodeAuthManager(mockContext);
        manager.pendingAuth = true;
        const cookieValue = 'LEETCODE_SESSION=bad; csrftoken=bad;';
        const uri = vscode.Uri.parse(
          `vscode://ayanrocks.better-leetcode/?cookie=${encodeURIComponent(cookieValue)}`,
        );

        // Should not throw — handleUri catches errors and shows an error message
        await manager.handleUri(uri);
        assert.strictEqual(manager.getStatus(), undefined);

        // Assert failed callback does not persist credentials
        const savedSecret = await mockSecrets.get('better-leetcode.cookie');
        assert.strictEqual(savedSecret, undefined);
        assert.strictEqual(manager.getClient().hasCredentials(), false);
      });

      test('Should reject callback when there is no pending auth request', async () => {
        const manager = new LeetCodeAuthManager(mockContext);
        const cookieValue = 'LEETCODE_SESSION=web_sess; csrftoken=web_csrf;';
        const uri = vscode.Uri.parse(
          `vscode://ayanrocks.better-leetcode/?cookie=${encodeURIComponent(cookieValue)}`,
        );

        await manager.handleUri(uri);
        assert.strictEqual(manager.getStatus(), undefined);

        const savedSecret = await mockSecrets.get('better-leetcode.cookie');
        assert.strictEqual(savedSecret, undefined);
        assert.strictEqual(manager.getClient().hasCredentials(), false);
      });

      test('Should reject callback when host or path does not match extension ID', async () => {
        const manager = new LeetCodeAuthManager(mockContext);
        manager.pendingAuth = true;
        const cookieValue = 'LEETCODE_SESSION=web_sess; csrftoken=web_csrf;';
        const uri = vscode.Uri.parse(
          `vscode://invalid-host/path?cookie=${encodeURIComponent(cookieValue)}`,
        );

        await manager.handleUri(uri);
        assert.strictEqual(manager.getStatus(), undefined);
        assert.strictEqual(manager.pendingAuth, true);

        const savedSecret = await mockSecrets.get('better-leetcode.cookie');
        assert.strictEqual(savedSecret, undefined);
        assert.strictEqual(manager.getClient().hasCredentials(), false);
      });
    });
  });
});
