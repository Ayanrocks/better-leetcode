<div align="center">
  <img src="resources/better-leetcode-logo.svg" alt="Better LeetCode Logo" width="128" height="128">
  <h1>Better LeetCode</h1>
  <p>A robust, flexible, and modern VS Code extension designed to streamline solving LeetCode problems directly from your editor.</p>
  
  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=better-leetcode-team.better-leetcode"><img src="https://img.shields.io/visual-studio-marketplace/v/better-leetcode-team.better-leetcode?style=for-the-badge&color=007acc&logo=visualstudiocode" alt="VS Marketplace Version"></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=better-leetcode-team.better-leetcode"><img src="https://img.shields.io/visual-studio-marketplace/i/better-leetcode-team.better-leetcode?style=for-the-badge&color=FFA116&logo=visualstudiocode" alt="Installs"></a>
    <img src="https://img.shields.io/badge/License-MIT-282828?style=for-the-badge" alt="License">
    <a href="https://buymeacoffee.com/banerjeeayan"><img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me A Coffee"></a>
  </p>
</div>

---

## 🚀 Features

Better LeetCode brings the full LeetCode experience directly into your IDE with native support and no annoying boilerplate code.

- **Flexible Submission**: Submit solutions against default test cases or hidden test cases effortlessly.
- **Language Switch on the Fly**: Change your target programming language seamlessly from the editor.
- **No Boilerplate Comments**: Write clean, standard code; the extension natively manages the underlying boilerplate.
- **Native VS Code Tooling**: Leverage VS Code's rich syntax highlighting, IntelliSense, auto-complete, and extensions.
- **Integrated Debugger**: Step through your code using VS Code's native debugger.
- **Study Lists**: Easily track and complete curated LeetCode study lists.
- **Daily Problems**: Quickly fetch and solve the daily LeetCode challenge with a single click.

### Screenshot
![Demo Video](resources/Better-Leetcode-demo.gif)

---

## 🔑 Authentication / Login

To interact with LeetCode (fetch premium problems, submit solutions, track progress), you need to log in by providing your LeetCode Session Token and CSRF Token.

1. Go to [LeetCode.com](https://leetcode.com) and log in.
2. Open your browser's Developer Tools (usually `F12` or `Cmd+Option+I`).
3. Navigate to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox).
4. Under **Cookies**, select `https://leetcode.com`.
5. Find the cookie named `LEETCODE_SESSION` and copy its value.
6. Find the cookie named `csrftoken` and copy its value.
7. In VS Code, run the command **`Better LeetCode: Sign In`** from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
8. Paste the tokens when prompted to authenticate your extension.

---

## 🛠️ Getting Started for Development

### 1. Prerequisites

- **VS Code** (version `^1.90.0` or higher)
- **Node.js** (version `^20.0.0` or higher)
- **Bun** (preferred package manager)

### 2. Install Dependencies
Initialize and install the required dependencies using Bun:
```bash
bun install
```

### 3. Compile and Run the Extension

To run and debug the extension locally:
1. Open the project directory in VS Code.
2. Press **`F5`** (or go to the **Run and Debug** view and select **"Run Extension"**).
3. A new window named **[Extension Development Host]** will launch.
4. Open the Command Palette and type **`Better LeetCode: Show Problem Statement`** or any other extension command to test it.

---

## 📦 Publishing the Extension

We use GitHub Actions to automate publishing the extension to the Visual Studio Marketplace.

### Automated Publishing via GitHub Actions

1. Ensure your extension version is updated in `package.json`.
2. Push your changes to the `main` branch.
3. Create a **Release** on GitHub with the new version tag (e.g., `v1.0.0`).
4. The GitHub Actions workflow will automatically bundle and publish the extension.

*Note: You must have the `VSCE_PAT` secret configured in your repository settings (Settings > Secrets and variables > Actions). This Personal Access Token should be generated from your Azure DevOps organization with "Marketplace" > "Manage" scopes.*

### Manual Publishing

If you need to publish manually from your local machine:
1. Install `vsce` globally:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension:
   ```bash
   bun run package
   vsce package
   ```
3. Publish the extension:
   ```bash
   bun run publish
   ```

---

## 📄 Coding Guidelines

To maintain code quality and stability, please adhere to the rules defined in [AGENTS.md](AGENTS.md):
- **TypeScript Only**: Write clean, type-safe TypeScript. Do not use the `any` type under any circumstances.
- **SOLID Principles**: Keep components focused, modular, and decoupled.
- **Comprehensive Testing**: Write unit and integration tests for all core features and edge cases.

---

## ☕ Support

If you find this extension helpful and it saves you time, consider buying me a coffee to support its ongoing development!

<a href="https://buymeacoffee.com/banerjeeayan"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>
