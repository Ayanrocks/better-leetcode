async function main() {
  const query = `
    query questionTopicsList($questionId: String!) {
      questionTopicsList(questionId: $questionId) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;
  const res = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { questionId: "1" } })
  });
  console.log(await res.text());
}
main();
