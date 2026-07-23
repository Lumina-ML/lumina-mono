import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx,vue}"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        FocusEvent: "readonly",
        KeyboardEvent: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Pre-existing in the codebase; flip back on as files are touched.
      "@typescript-eslint/no-var-requires": "off",
      "no-case-declarations": "off",
      "vue/no-ref-as-operand": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/no-v-html": "off",
      "vue/attributes-order": "off",
      // ── Frontend component baseline (CLAUDE.md) ───────────────────
      // Raw HTML controls must go through `@lumina/ui` primitives.
      // Disable per-line with the standard `<!-- eslint-disable-next-line
      // vue/no-restricted-html-elements -->` HTML comment.
      "vue/no-restricted-html-elements": [
        "error",
        {
          element: "button",
          message:
            "Raw <button> is not allowed in dashboard templates — use LButton / LIconButton from @lumina/ui. Add `<!-- eslint-disable-next-line vue/no-restricted-html-elements -->` above if this is a documented exception.",
        },
        {
          element: "input",
          message:
            "Raw <input> is not allowed in dashboard templates — use LInput from @lumina/ui.",
        },
        {
          element: "select",
          message:
            "Raw <select> is not allowed in dashboard templates — use LSelect from @lumina/ui.",
        },
        {
          element: "textarea",
          message:
            "Raw <textarea> is not allowed in dashboard templates — use LTextarea from @lumina/ui.",
        },
        {
          element: "img",
          message:
            "Raw <img> is not allowed in dashboard templates — use LAvatar for user photos. For brand logos or user-uploaded content, add `<!-- eslint-disable-next-line vue/no-restricted-html-elements -->` above the element.",
        },
      ],
      // vue-eslint-parser occasionally reports column offsets that don't
      // correspond to the offending element (a known issue when the
      // template's whitespace differs from the parser's column model).
      // The rule itself is correct — when it fires the offending file
      // genuinely has a raw element. If you see a violation in this file
      // and the line shows clean code, file an issue rather than
      // disabling the rule above.
      "vue/no-restricted-html-elements/no-unknown-element": "off",
    },
  },
  {
    ignores: ["dist", "node_modules", "coverage", "**/*.test.ts"],
  },
);