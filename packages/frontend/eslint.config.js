import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Accessibility. Reported as warnings rather than errors: there is a
      // known backlog (~2300 findings, mostly labels not tied to their input),
      // and failing the build on it would only get the plugin removed. New
      // code shows up here immediately, which is the point.
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/component-hook-factories': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'prefer-const': 'off',
      'no-useless-catch': 'off',
      'no-useless-escape': 'off',
      // Existing backlog is reported, not enforced; ratchet these to 'error'
      // area by area as each is cleared.
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/img-redundant-alt': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'no-case-declarations': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  // ---------------------------------------------------------------------
  // Cleared ground. These files and directories report zero accessibility
  // findings today, so here the same rules are errors: the work is done and
  // regressing it should stop a build, not add another line to a backlog of
  // two thousand warnings that nobody reads.
  //
  // Add to this list as an area is cleared. Removing something from it should
  // take an argument, not a commit.
  // ---------------------------------------------------------------------
  {
    files: [
      'src/routes/**/*.tsx',
      'src/components/ui/**/*.tsx',
      'src/components/procurement/**/*.tsx',
      'src/components/finance/**/*.tsx',
      'src/components/catalog/**/*.tsx',
      'src/components/Deployments/**/*.tsx',
      'src/components/ConfirmDialog.tsx',
      'src/components/ConfirmDialog.test.tsx',
      'src/pages/EmergencyPage.tsx',
      'src/pages/doctor/NewConsultationPage.tsx',
      'src/pages/approvals/**/*.tsx',
      'src/pages/dental/**/*.tsx',
      'src/pages/optical/**/*.tsx',
      'src/pages/Public/**/*.tsx',
    ],
    rules: {
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/media-has-caption': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
    },
  },
])
