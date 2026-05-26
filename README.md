# Better Leetcode VS Code Extension

A robust, flexible, and modern VS Code extension designed to streamline solving LeetCode problems directly from your editor. It provides native language selection, full autocomplete, debugger support, and study list integration without cluttering your code with boilerplate comments.

---

## Features

- **Flexible Submission**: Submit solutions for both default test cases and hidden test cases.
- **Language Switch on the Fly**: Change your target programming language seamlessly.
- **No Boilerplate Comments**: Write clean, standard code; the extension handles the rest.
- **Native VS Code Tooling**: Leverage VS Code's rich syntax highlighting, IntelliSense, and auto-complete.
- **Integrated Debugger**: Step through your code using VS Code's native debugger.
- **Study Lists**: Easily track and complete curated LeetCode study lists.
- **Daily Problems**: Quickly fetch and solve the daily LeetCode challenge.

---

## Prerequisites

- **VS Code** (version `^1.90.0` or higher)
- **Node.js** (version `^20.0.0` or higher)
- **Bun** (preferred package manager)

---

## Getting Started

### 1. Install Dependencies
Initialize and install the required dependencies using Bun:
```bash
bun install
```
*(Alternatively, you can run `npm install`)*

### 2. Compile and Run the Extension
To run and debug the extension locally:
1. Open the project directory in VS Code.
2. Press **`F5`** (or go to the **Run and Debug** view and select **"Run Extension"**).
3. A new window named **[Extension Development Host]** will launch with the Better Leetcode extension activated.
4. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux).
5. Type and select `Better Leetcode: Hello World`.
6. You will see a greeting notification verifying the setup.

### 3. Build & Compile Configurations
The project uses **esbuild** for fast compilation:
- **`bun run compile`**: Runs a one-time build outputting to `./dist/extension.js`.
- **`bun run watch`**: Starts esbuild in watch mode, recompiling on save.
- **`bun run package`**: Compiles and minifies the extension for publishing.

---

## Running Tests

Integration tests run in a clean, isolated VS Code instance:
```bash
bun run test
```
This command compiles the source code and runs Mocha tests located in `src/test/suite/`.

---

## Coding Guidelines

To maintain code quality and stability, please adhere to the following rules defined in [AGENTS.md](file:///Users/ayanrocks/Developer/better-leetcode/AGENTS.md):
- **TypeScript Only**: Write clean, type-safe TypeScript. Do not use the `any` type under any circumstances.
- **SOLID Principles**: Keep components focused, modular, and decoupled.
- **API Isolation**: All LeetCode API integrations must live in a separate module under `src/api/` or similar.
- **Null Safety**: Always thoroughly check for `null` and `undefined` to prevent runtime crashes.
- **Comprehensive Testing**: Write unit and integration tests for all core features and edge cases.
