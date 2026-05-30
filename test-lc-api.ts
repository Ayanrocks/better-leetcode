import { execSync } from 'child_process';

const reqProblems = `curl 'https://leetcode.com/graphql/' \
  --compressed \
  -X POST \
  -H 'content-type: application/json' \
  --data-raw '{"query":"\\n    query problemsetQuestionListV2($filters: QuestionFilterInput, $limit: Int, $searchKeyword: String, $skip: Int, $sortBy: QuestionSortByInput, $categorySlug: String) {\\n  problemsetQuestionListV2(\\n    filters: $filters\\n    limit: $limit\\n    searchKeyword: $searchKeyword\\n    skip: $skip\\n    sortBy: $sortBy\\n    categorySlug: $categorySlug\\n  ) {\\n    questions {\\n      titleSlug\\n      title\\n      status\\n    }\\n    totalLength\\n  }\\n}\\n    ","variables":{"skip":0,"limit":5,"categorySlug":"top-interview-150","filters":{}},"operationName":"problemsetQuestionListV2"}'`;

try {
  const result = execSync(reqProblems).toString();
  console.log("Problems API Response:");
  console.log(result.slice(0, 1000));
} catch (e) {
  console.log("Error Problems API:");
  console.log(e.toString());
}
