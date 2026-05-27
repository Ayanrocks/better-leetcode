/**
 * Configuration for language-specific boilerplate code that wraps
 * LeetCode snippets to provide a valid compilation context.
 */
export interface BoilerplateConfig {
  /** Code prepended before the LeetCode snippet. */
  prefix: string;
  /** Code appended after the LeetCode snippet. */
  suffix: string;
}

/**
 * Boilerplate configurations for all LeetCode-supported languages.
 * Provides the minimal imports/declarations needed to prevent
 * IDE linter errors without cluttering the solution file.
 */
const BOILERPLATE_CONFIGS: Record<string, BoilerplateConfig> = {
  golang: {
    prefix: 'package main\n\n',
    suffix: '',
  },
  java: {
    prefix: [
      'import java.util.*;',
      'import java.util.stream.*;',
      'import java.math.*;',
      '',
      '',
    ].join('\n'),
    suffix: '',
  },
  python3: {
    prefix: [
      'from typing import List, Optional, Tuple, Dict, Set',
      'from collections import defaultdict, deque, Counter',
      'import heapq',
      'import math',
      '',
      '',
    ].join('\n'),
    suffix: '',
  },
  python: {
    prefix: [
      'from typing import List, Optional, Tuple, Dict, Set',
      'from collections import defaultdict, deque, Counter',
      'import heapq',
      'import math',
      '',
      '',
    ].join('\n'),
    suffix: '',
  },
  c: {
    prefix: [
      '#include <stdlib.h>',
      '#include <string.h>',
      '#include <stdbool.h>',
      '#include <limits.h>',
      '#include <math.h>',
      '#include <stdio.h>',
      '',
      '',
    ].join('\n'),
    suffix: '',
  },
  cpp: {
    prefix: ['#include <bits/stdc++.h>', 'using namespace std;', '', ''].join('\n'),
    suffix: '',
  },
  csharp: {
    prefix: [
      'using System;',
      'using System.Collections.Generic;',
      'using System.Linq;',
      '',
      '',
    ].join('\n'),
    suffix: '',
  },
  rust: {
    prefix: [
      'use std::collections::HashMap;',
      'use std::collections::HashSet;',
      'use std::collections::VecDeque;',
      'use std::cmp;',
      '',
      'struct Solution;',
      '',
      '',
    ].join('\n'),
    suffix: '',
  },
  php: {
    prefix: '<?php\n\n',
    suffix: '',
  },
  kotlin: {
    prefix: '',
    suffix: '',
  },
  swift: {
    prefix: '',
    suffix: '',
  },
  ruby: {
    prefix: '',
    suffix: '',
  },
  scala: {
    prefix: '',
    suffix: '',
  },
  javascript: {
    prefix: '',
    suffix: '',
  },
  typescript: {
    prefix: '',
    suffix: '',
  },
};

/**
 * Manages language-specific boilerplate wrapping for LeetCode code snippets.
 *
 * When a problem is opened, the raw LeetCode snippet (e.g., a bare function signature)
 * is wrapped with the necessary language boilerplate (imports, package declarations)
 * so the IDE can provide autocomplete, linting, and error-free editing.
 *
 * When submitting or testing, the boilerplate is stripped and only the solution
 * code that LeetCode expects is sent to the API.
 */
export class BoilerplateManager {
  /**
   * Wraps a LeetCode code snippet with language-specific boilerplate.
   *
   * @param lang - The LeetCode language slug (e.g., 'golang', 'python3').
   * @param snippet - The raw code snippet from LeetCode's API.
   * @returns The wrapped code ready for the editor.
   */
  static wrapWithBoilerplate(lang: string, snippet: string): string {
    const config = BoilerplateManager.getConfig(lang);
    return `${config.prefix}${snippet}${config.suffix}`;
  }

  /**
   * Extracts the solution code from a file that may have boilerplate wrapping.
   * Returns only the code that LeetCode expects for submission.
   *
   * Strategy:
   * 1. If originalSnippet is provided, locate its first meaningful line
   *    in the file content and return everything from that point onward
   *    (minus any suffix boilerplate).
   * 2. If not provided, strip the known prefix for the language.
   * 3. Fallback: return the full file content (LeetCode typically ignores
   *    extra imports/declarations for most languages).
   *
   * @param lang - The LeetCode language slug.
   * @param fileContent - The full contents of the solution file.
   * @param originalSnippet - The original code snippet from LeetCode, used for
   *   reliable boundary detection.
   * @returns The extracted solution code suitable for LeetCode submission.
   */
  static extractSolutionCode(lang: string, fileContent: string, originalSnippet?: string): string {
    const config = BoilerplateManager.getConfig(lang);

    // Strategy 1: Use the original snippet's first line to find the solution start
    if (originalSnippet !== undefined && originalSnippet !== '') {
      const firstLine = BoilerplateManager.getFirstMeaningfulLine(originalSnippet);
      if (firstLine !== null) {
        const startIndex = fileContent.indexOf(firstLine);
        if (startIndex !== -1) {
          let extracted = fileContent.substring(startIndex);

          // Remove suffix boilerplate if present
          if (config.suffix !== '') {
            const suffixIndex = extracted.lastIndexOf(config.suffix.trim());
            if (suffixIndex !== -1) {
              extracted = extracted.substring(0, suffixIndex).trimEnd();
            }
          }

          return extracted;
        }
      }
    }

    // Strategy 2: Strip the known prefix
    if (config.prefix !== '') {
      const prefixTrimmed = config.prefix.trimEnd();
      const prefixIndex = fileContent.indexOf(prefixTrimmed);
      if (prefixIndex !== -1) {
        const afterPrefix = fileContent.substring(prefixIndex + prefixTrimmed.length);
        let extracted = afterPrefix.replace(/^\n+/, '');

        // Remove suffix boilerplate if present
        if (config.suffix !== '') {
          const suffixIndex = extracted.lastIndexOf(config.suffix.trim());
          if (suffixIndex !== -1) {
            extracted = extracted.substring(0, suffixIndex).trimEnd();
          }
        }

        return extracted;
      }
    }

    // Strategy 3: Fallback — return full content
    return fileContent;
  }

  /**
   * Returns the boilerplate config for a language.
   * Returns empty prefix/suffix for unknown languages.
   *
   * @param lang - The LeetCode language slug.
   * @returns The boilerplate configuration.
   */
  static getConfig(lang: string): BoilerplateConfig {
    const config = BOILERPLATE_CONFIGS[lang];
    if (config !== undefined) {
      return config;
    }
    return { prefix: '', suffix: '' };
  }

  /**
   * Checks if a language has boilerplate that needs to be managed.
   *
   * @param lang - The LeetCode language slug.
   * @returns True if the language has a non-empty prefix or suffix.
   */
  static hasBoilerplate(lang: string): boolean {
    const config = BoilerplateManager.getConfig(lang);
    return config.prefix !== '' || config.suffix !== '';
  }

  /**
   * Finds the first non-empty, non-whitespace line in a code snippet.
   *
   * @param snippet - The code snippet to search.
   * @returns The first meaningful line, or null if the snippet is empty.
   */
  private static getFirstMeaningfulLine(snippet: string): string | null {
    const lines = snippet.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed !== '') {
        return trimmed;
      }
    }
    return null;
  }
}
