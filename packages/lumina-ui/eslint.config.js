import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx,vue}'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        FocusEvent: 'readonly',
        KeyboardEvent: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/no-v-html': 'off',
      'vue/attributes-order': 'off',
    },
  },
  {
    ignores: ['dist', 'node_modules'],
  },
);
