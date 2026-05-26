import { LeetCodeCookies, UserStatus, GraphQLResponse, GlobalDataResponse } from './types';

/**
 * Helper to parse a raw cookie string and extract LeetCode session and CSRF token.
 *
 * @param cookieString - The raw cookie header string.
 * @returns Parsed LeetCodeCookies or undefined if key tokens are missing.
 */
export function parseCookies(cookieString: string): LeetCodeCookies | undefined {
  let session: string | undefined;
  let csrfToken: string | undefined;

  const pairs = cookieString.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) {
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();

    if (key === 'LEETCODE_SESSION') {
      session = val;
    } else if (key === 'csrftoken') {
      csrfToken = val;
    }
  }

  if (session && csrfToken) {
    return { session, csrfToken };
  }
  return undefined;
}

/**
 * Client for interacting with the LeetCode GraphQL API.
 */
export class LeetCodeClient {
  private endpoint = 'https://leetcode.com';
  private cookies: LeetCodeCookies | undefined;

  /**
   * Updates the target LeetCode endpoint (e.g. https://leetcode.com or https://leetcode.cn).
   *
   * @param endpoint - The target endpoint base URL.
   */
  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  /**
   * Returns the current LeetCode endpoint.
   */
  public getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Sets the cookie credentials from a raw cookie string.
   *
   * @param cookieString - The raw cookie string containing session and csrf tokens.
   */
  public setCookieString(cookieString: string): void {
    const parsed = parseCookies(cookieString);
    if (!parsed) {
      throw new Error('Invalid cookie string: LEETCODE_SESSION and csrftoken are required.');
    }
    this.cookies = parsed;
  }

  /**
   * Returns whether the client has credentials configured.
   */
  public hasCredentials(): boolean {
    return this.cookies !== undefined;
  }

  /**
   * Clears the current credentials from the client.
   */
  public clearCredentials(): void {
    this.cookies = undefined;
  }

  /**
   * Executes a GraphQL query against the LeetCode API.
   *
   * @param query - The GraphQL query string.
   * @param variables - Variables to pass along with the query.
   * @returns The typed data response from GraphQL.
   */
  public async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `${this.endpoint}/graphql/`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': this.endpoint,
      'Origin': this.endpoint,
    };

    if (this.cookies) {
      const { session, csrfToken } = this.cookies;
      headers['Cookie'] = `LEETCODE_SESSION=${session}; csrftoken=${csrfToken};`;
      headers['x-csrftoken'] = csrfToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const errMsg = firstError ? firstError.message : 'Unknown GraphQL error';
      throw new Error(errMsg);
    }

    if (!result.data) {
      throw new Error('GraphQL response returned no data.');
    }

    return result.data;
  }

  /**
   * Fetches the profile and sign-in status of the authenticated user.
   *
   * @returns UserStatus containing session information.
   */
  public async getUserStatus(): Promise<UserStatus> {
    const queryStr = `
      query globalData {
        userStatus {
          isSignedIn
          isPremium
          username
          realName
          avatar
          userSlug
          isAdmin
        }
      }
    `;

    const data = await this.query<GlobalDataResponse>(queryStr);
    return data.userStatus;
  }

  /**
   * Fetches the current daily coding challenge.
   */
  public async getDailyChallenge(): Promise<any> {
    const queryStr = `
      query questionOfToday {
        activeDailyCodingChallengeQuestion {
          date
          link
          question {
            frontendQuestionId: questionFrontendId
            title
            titleSlug
            difficulty
            acRate
            paidOnly: isPaidOnly
            status
            topicTags {
              name
              slug
            }
          }
        }
      }
    `;
    const data = await this.query<any>(queryStr);
    return data?.activeDailyCodingChallengeQuestion?.question;
  }

  /**
   * Fetches a paginated list of problems.
   */
  public async getProblems(skip: number = 0, limit: number = 50): Promise<any[]> {
    const queryStr = `
      query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
        problemsetQuestionList: questionList(
          categorySlug: $categorySlug
          limit: $limit
          skip: $skip
          filters: $filters
        ) {
          total: totalNum
          questions: data {
            frontendQuestionId: questionFrontendId
            title
            titleSlug
            difficulty
            acRate
            paidOnly: isPaidOnly
            status
            topicTags {
              name
              slug
            }
          }
        }
      }
    `;
    const variables = {
      categorySlug: "",
      skip,
      limit,
      filters: {}
    };
    const data = await this.query<any>(queryStr, variables);
    return data?.problemsetQuestionList?.questions || [];
  }
}

