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
