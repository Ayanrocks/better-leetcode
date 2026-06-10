/**
 * Represents parsed cookies required for LeetCode API requests.
 */
export interface LeetCodeCookies {
  session: string;
  csrfToken: string;
}

/**
 * Represents the profile status and session details of the authenticated LeetCode user.
 */
export interface UserStatus {
  isSignedIn: boolean;
  isPremium: boolean;
  username: string;
  realName: string;
  avatar: string;
  userSlug: string;
  isAdmin: boolean;
}

/**
 * Represents the structure of a GraphQL error returned by LeetCode.
 */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
}

/**
 * Represents the standard response envelope for LeetCode's GraphQL API.
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * Represents the GraphQL query response for retrieving the user's status.
 */
export interface GlobalDataResponse {
  userStatus: UserStatus;
}

export interface Tag {
  name: string;
  slug: string;
}

export interface Problem {
  frontendQuestionId: string;
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acRate: number;
  paidOnly: boolean;
  status: string | null;
  topicTags: Tag[];
}

export interface CodeSnippet {
  lang: string;
  langSlug: string;
  code: string;
}

export interface ProblemDetails {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  content: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  codeSnippets: CodeSnippet[];
  sampleTestCase: string;
  exampleTestcases?: string;
  metaData?: string;
  paidOnly: boolean;
  topicTags?: Tag[];
  hints?: string[];
  topicId?: number;
}

export interface StudyPlanQuestion {
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionFrontendId: string;
  status?: string | null;
  paidOnly: boolean;
}

export interface StudyPlanSubGroup {
  name: string;
  slug: string;
  questions: StudyPlanQuestion[];
}

export interface StudyPlanDetails {
  name: string;
  description: string;
  planSubGroups: StudyPlanSubGroup[];
}

/**
 * Response from LeetCode's interpret_solution endpoint (test run).
 */
export interface InterpretResponse {
  interpret_id: string;
}

/**
 * Response from LeetCode's submit endpoint.
 */
export interface SubmitResponse {
  submission_id: number;
}

/**
 * Result of polling LeetCode's submission check endpoint.
 * Contains per-testcase results, runtime/memory stats, and error details.
 */
export interface SubmissionCheckResult {
  state: string;
  status_code: number;
  status_msg: string;
  run_success: boolean;
  total_correct: number | null;
  total_testcases: number | null;
  status_runtime: string;
  status_memory: string;
  memory_percentile: number | null;
  runtime_percentile: number | null;
  code_answer: string[];
  expected_answer: string[];
  expected_code_answer?: string[];
  code_output: string | string[];
  std_output_list: string[];
  compile_error: string;
  full_compile_error: string;
  runtime_error: string;
  full_runtime_error: string;
  input_formatted: string;
  expected_output: string;
  last_testcase: string;
}

/**
 * Parsed structure of LeetCode's `metaData` JSON string.
 * Contains the function signature metadata including parameter names/types.
 */
export interface ProblemMetaData {
  name: string;
  params: Array<{ name: string; type: string }>;
  return: { type: string };
}

export interface LeetCodeContest {
  titleSlug: string;
  title: string;
  titleCn?: string | null;
  startTime: number;
  duration: number;
  cardImg?: string | null;
  cardImgApp?: string | null;
  companyWatermark?: string | null;
  solved?: number | null;
  totalQuestions?: number | null;
}

export interface ContestQuestion {
  question_id: number;
  title: string;
  title_slug: string;
  difficulty: number;
  credit: number;
}

export interface ContestInfo {
  contest: {
    title: string;
    title_slug: string;
    description: string;
    start_time: number;
    duration: number;
  };
  questions: ContestQuestion[];
}

export interface DiscussAuthorProfile {
  userAvatar: string;
  reputation: number;
  realName: string;
  certificationLevel: number;
}

export interface DiscussAuthor {
  isDiscussAdmin: boolean;
  isDiscussStaff: boolean;
  username: string;
  nameColor: string | null;
  activeBadge: { displayName: string; icon: string } | null;
  profile: DiscussAuthorProfile;
  isActive: boolean;
}

export interface DiscussPost {
  id: number;
  voteCount: number;
  voteUpCount: number;
  voteStatus: number;
  content: string;
  updationDate: number;
  creationDate: number;
  status: string | null;
  isHidden: boolean;
  anonymous: boolean;
  author: DiscussAuthor;
  authorIsModerator: boolean;
  isOwnPost: boolean;
  isSerialized: boolean;
}

export interface CommentNode {
  id: number;
  ipRegion: string | null;
  pinned: boolean;
  pinnedBy: { username: string } | null;
  post: DiscussPost;
  intentionTag: { slug: string } | null;
  numChildren: number;
}

export interface TopicCommentsResponse {
  data: CommentNode[];
  totalNum: number;
}

export interface ReplyNode {
  id: number;
  pinned: boolean;
  pinnedBy: { username: string } | null;
  post: DiscussPost;
}

export interface CommentReplyConnection {
  totalNum: number;
  edges: { node: ReplyNode }[];
}
