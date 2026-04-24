import pluginJest from "eslint-plugin-jest";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...[
    js.configs.recommended,
    tseslint.configs.recommended,
    {
      files: ["**/*.test.js", "**/*.test.ts", "**/tests/**"],
      plugins: { jest: pluginJest },
      languageOptions: {
        globals: pluginJest.environments.globals.globals,
      },
      rules: {
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/prefer-to-have-length": "warn",
        "jest/valid-expect": "error",
      },
    },
    {
      files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: {
          ...globals.node,
        },
      },
      rules: {
        "no-var": "error",
        "prefer-const": "error",
        "no-unneeded-ternary": "error",
        "prefer-arrow-callback": "error",
        "no-lonely-if": "error",
        "consistent-return": ["error", { treatUndefinedAsUnspecified: false }],
        curly: "error",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: ["**/*.js", "**/*.jsx"],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: {
          ...globals.node,
        },
      },
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    { ignores: ["jest.config.js", "build/*", "dist/*", "build.js"] },
  ],
);
