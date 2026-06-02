# Overview

Better Leetcode is a vscode extension which is better than the current leetcode extension. It features felxibility over the current one.
Here are some additional features it supports

- Submit Leetcode solution for both default testcases and hidden test cases
- change language on the fly
- no specific boilerplate code comments
- Ability to use auto-complete and syntax highlighting of vscode
- Use of Debugger
- Ability to complete study lists.
- Get the daily problem fast

## Rules for Agents

- Extension built in typescript entirely
- Use of `any` type is not allowed. Each type has to have a TS type
- Tests should be written for all scenarios
- Extension shouldn't panic or crash vscode ever
- Leetcode api integrations should be in separate module
- Follow SOLID principles while developing
- Thoroughly perform null and undefined checks
- Plan the feature thoroughly before writing code
- if the user hasn't specified any particular tool or logic, that means user wants you to browse and select couple of options for the user to select.
- Always save your last work summary for a new model to get context and continue. Keep this very brief and short to reduce token usage but useful enough for models. Name the file AGENTS_HISTORY.md. If file exists, append your changes.
- IF AGENTS_HISTORY.md becomes more than 200 lines, delete the older changes.
- When Working with Markdown, always add a new-line between the Header tags and the content.
- Follow Markdown Formatting rules

## Setup

- README.md
- .gitignore
- .eslintrc
- .prettierrc
- tsconfig.json
- src/

- Use bun
- preferred rust based tolling or tools
