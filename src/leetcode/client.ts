import {
  LeetCodeCookies,
  UserStatus,
  GraphQLResponse,
  GlobalDataResponse,
  Problem,
  ProblemDetails,
  StudyPlanDetails,
  StudyPlanQuestion,
  InterpretResponse,
  SubmitResponse,
  SubmissionCheckResult,
} from './types';
import { Logger } from '../logger';

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

  if (session !== undefined && csrfToken !== undefined) {
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
      Referer: this.endpoint,
      Origin: this.endpoint,
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
      const errorText = await response.text();
      Logger.getInstance().error('api', `GraphQL request failed with HTTP ${response.status}. Response: ${errorText}`, {
        url,
      });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const errMsg = firstError ? firstError.message : 'Unknown GraphQL error';
      Logger.getInstance().error('api', `GraphQL error: ${errMsg}`, { url });
      throw new Error(errMsg);
    }

    if (result.data === undefined) {
      Logger.getInstance().error('api', 'GraphQL response returned no data', { url });
      throw new Error('GraphQL response returned no data.');
    }

    Logger.getInstance().debug('api', `GraphQL request completed: ${query.substring(0, 100).replace(/\n/g, ' ')}...`, { url, data: result.data });
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
  public async getDailyChallenge(): Promise<Problem | undefined> {
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
    interface DailyChallengeResponse {
      activeDailyCodingChallengeQuestion: {
        question: Problem;
      } | null;
    }
    const data = await this.query<DailyChallengeResponse>(queryStr);
    if (
      data === undefined ||
      data.activeDailyCodingChallengeQuestion === null ||
      data.activeDailyCodingChallengeQuestion === undefined
    ) {
      return undefined;
    }
    return data.activeDailyCodingChallengeQuestion.question;
  }

  /**
   * Fetches a paginated list of problems.
   */
  public async getProblems(skip: number = 0, limit: number = 50): Promise<Problem[]> {
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
      categorySlug: '',
      skip,
      limit,
      filters: {},
    };
    const data = await this.query<{
      problemsetQuestionList: { total: number; questions: Problem[] };
    }>(queryStr, variables);
    if (data === undefined || data.problemsetQuestionList === undefined) {
      return [];
    }
    return data.problemsetQuestionList.questions;
  }

  /**
   * Fetches the complete problem catalog by paginating through all results.
   * LeetCode's API caps responses at ~100 problems per request, so this
   * method fetches in batches until all problems are retrieved.
   *
   * @param batchSize - Number of problems to request per batch (default: 100).
   * @returns The full list of all problems on the platform.
   */
  public async getAllProblems(batchSize: number = 100): Promise<Problem[]> {
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

    // First batch — learn total count
    const firstData = await this.query<{
      problemsetQuestionList: { total: number; questions: Problem[] };
    }>(queryStr, { categorySlug: '', skip: 0, limit: batchSize, filters: {} });

    if (firstData === undefined || firstData.problemsetQuestionList === undefined) {
      return [];
    }

    const total = firstData.problemsetQuestionList.total;
    const allProblems: Problem[] = [...firstData.problemsetQuestionList.questions];

    // Fetch remaining pages concurrently in batches
    const remainingPages: number[] = [];
    for (let skip = batchSize; skip < total; skip += batchSize) {
      remainingPages.push(skip);
    }

    if (remainingPages.length > 0) {
      const pageResults = await Promise.all(
        remainingPages.map(async (skip) => {
          const data = await this.query<{
            problemsetQuestionList: { total: number; questions: Problem[] };
          }>(queryStr, { categorySlug: '', skip, limit: batchSize, filters: {} });
          if (data === undefined || data.problemsetQuestionList === undefined) {
            return [];
          }
          return data.problemsetQuestionList.questions;
        }),
      );

      for (const pageProblems of pageResults) {
        allProblems.push(...pageProblems);
      }
    }

    return allProblems;
  }

  /**
   * Fetches detailed information for a specific problem.
   */
  public async getProblemDetails(titleSlug: string): Promise<ProblemDetails> {
    const queryStr = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          titleSlug
          content
          difficulty
          paidOnly: isPaidOnly
          codeSnippets {
            lang
            langSlug
            code
          }
          sampleTestCase
          exampleTestcases
          metaData
          topicTags {
            name
            slug
          }
        }
      }
    `;
    const variables = { titleSlug };
    const data = await this.query<{ question: ProblemDetails }>(queryStr, variables);
    return data.question;
  }

  /**
   * Fetches detailed questions and structure for a specific study plan.
   */
  public async getStudyPlan(planSlug: string): Promise<StudyPlanDetails> {
    const queryStr = `
      query studyPlanV2Detail($planSlug: String!) {
        studyPlanV2Detail(planSlug: $planSlug) {
          name
          description
          planSubGroups {
            name
            slug
            questions {
              title
              titleSlug
              difficulty
              questionFrontendId
              paidOnly: isPaidOnly
              status
            }
          }
        }
      }
    `;
    const variables = { planSlug };
    const data = await this.query<{ studyPlanV2Detail: StudyPlanDetails }>(queryStr, variables);
    return data.studyPlanV2Detail;
  }

  /**
   * Fetches the user's favorite lists.
   */
  public async getFavoriteLists(): Promise<{ name: string; slug: string }[]> {
    const queryStr = `
      query myFavoriteList {
        myCreatedFavoriteList {
          favorites {
            name
            slug
          }
        }
        myCollectedFavoriteList {
          favorites {
            name
            slug
          }
        }
      }
    `;
    const data = await this.query<any>(queryStr);
    const lists: { name: string; slug: string }[] = [];
    if (data?.myCreatedFavoriteList?.favorites) {
      lists.push(...data.myCreatedFavoriteList.favorites);
    }
    if (data?.myCollectedFavoriteList?.favorites) {
      lists.push(...data.myCollectedFavoriteList.favorites);
    }
    return lists;
  }

  /**
   * Fetches problems for a specific favorite list.
   */
  public async getFavoriteListProblems(favoriteSlug: string): Promise<StudyPlanQuestion[]> {
    const queryStr = `
      query favoriteQuestionList($favoriteSlug: String!) {
        favoriteQuestionList(favoriteSlug: $favoriteSlug) {
          questions {
            titleSlug
            title
            questionFrontendId
            difficulty
            paidOnly
            status
          }
        }
      }
    `;
    const variables = { favoriteSlug };
    const data = await this.query<any>(queryStr, variables);
    if (!data?.favoriteQuestionList?.questions) {
      return [];
    }
    return data.favoriteQuestionList.questions;
  }

  // ── REST API Methods (Test / Submit) ──────────────────────────────

  /**
   * Builds common HTTP headers for REST API requests.
   * Includes cookie auth, CSRF token, user-agent, and origin headers.
   */
  private buildRestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Referer: this.endpoint,
      Origin: this.endpoint,
    };

    if (this.cookies) {
      const { session, csrfToken } = this.cookies;
      headers['Cookie'] = `LEETCODE_SESSION=${session}; csrftoken=${csrfToken};`;
      headers['x-csrftoken'] = csrfToken;
    }

    return headers;
  }

  /**
   * Returns a promise that resolves after the specified delay.
   *
   * @param ms - Milliseconds to wait.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Runs the user's code against the provided test cases (interpret/test mode).
   * Does NOT count as a formal submission.
   *
   * @param titleSlug - The problem's URL slug (e.g., 'two-sum').
   * @param questionId - The numeric question ID from LeetCode.
   * @param lang - The LeetCode language slug (e.g., 'golang', 'python3').
   * @param typedCode - The user's solution code.
   * @param testCases - Newline-separated test case inputs.
   * @returns The interpret response containing the interpret_id for polling.
   */
  public async interpretSolution(
    titleSlug: string,
    questionId: string,
    lang: string,
    typedCode: string,
    testCases: string,
  ): Promise<InterpretResponse> {
    const url = `${this.endpoint}/problems/${titleSlug}/interpret_solution/`;
    const headers = this.buildRestHeaders();

    Logger.getInstance().debug('api', `Interpret request: ${titleSlug}`, { lang, questionId });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lang,
        question_id: questionId,
        typed_code: typedCode,
        data_input: testCases,
      }),
    });

    if (!response.ok) {
      Logger.getInstance().error('api', `Interpret request failed with status ${response.status}`, {
        titleSlug,
      });
      throw new Error(`Interpret request failed with status ${response.status}`);
    }

    const result = (await response.json()) as InterpretResponse;
    Logger.getInstance().info('api', `Interpret submitted: ${titleSlug}`, {
      interpretId: result.interpret_id,
      data: result,
    });
    return result;
  }

  /**
   * Submits the user's code as a formal solution attempt.
   *
   * @param titleSlug - The problem's URL slug.
   * @param questionId - The numeric question ID.
   * @param lang - The LeetCode language slug.
   * @param typedCode - The user's solution code.
   * @returns The submit response containing the submission_id for polling.
   */
  public async submit(
    titleSlug: string,
    questionId: string,
    lang: string,
    typedCode: string,
  ): Promise<SubmitResponse> {
    const url = `${this.endpoint}/problems/${titleSlug}/submit/`;
    const headers = this.buildRestHeaders();

    Logger.getInstance().debug('api', `Submit request: ${titleSlug}`, { lang, questionId });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lang,
        question_id: questionId,
        typed_code: typedCode,
      }),
    });

    if (!response.ok) {
      Logger.getInstance().error('api', `Submit request failed with status ${response.status}`, {
        titleSlug,
      });
      throw new Error(`Submit request failed with status ${response.status}`);
    }

    const result = (await response.json()) as SubmitResponse;
    Logger.getInstance().info('api', `Submit submitted: ${titleSlug}`, {
      submissionId: result.submission_id,
      data: result,
    });
    return result;
  }

  /**
   * Polls LeetCode's check endpoint until the submission is evaluated.
   * Retries every 1.5 seconds for up to 30 attempts (~45 seconds).
   *
   * @param submissionId - The interpret_id or submission_id to check.
   * @returns The complete submission result with status, runtime, memory, etc.
   * @throws Error if polling exceeds the maximum number of attempts.
   */
  public async checkSubmissionStatus(submissionId: string): Promise<SubmissionCheckResult> {
    const url = `${this.endpoint}/submissions/detail/${submissionId}/check/`;
    const headers = this.buildRestHeaders();
    const maxAttempts = 30;
    const pollIntervalMs = 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        Logger.getInstance().error(
          'api',
          `Submission check failed with status ${response.status}`,
          { submissionId },
        );
        throw new Error(`Submission check failed with status ${response.status}`);
      }

      const result = (await response.json()) as SubmissionCheckResult;

      if (result.state !== 'PENDING' && result.state !== 'STARTED') {
        Logger.getInstance().info('api', `Submission check completed: ${result.status_msg}`, {
          submissionId,
          statusCode: result.status_code,
          runtime: result.status_runtime,
          data: result,
        });
        return result;
      }

      Logger.getInstance().debug(
        'api',
        `Polling submission ${submissionId}: attempt ${attempt + 1}/${maxAttempts}`,
      );
      await this.delay(pollIntervalMs);
    }

    Logger.getInstance().error('api', `Submission check timed out after ${maxAttempts} attempts`, {
      submissionId,
    });
    throw new Error('Submission check timed out after 30 attempts. Please try again.');
  }
}
