import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import nextPlugin from '@next/eslint-plugin-next'
import perfectionist from 'eslint-plugin-perfectionist'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      '.turbo/**',
      '**/*.config.js',
      '**/*.config.mjs',
      'next-env.d.ts'
    ]
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true
      }
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [`${__dirname}/tsconfig.json`]
        }
      },
      react: {
        version: 'detect'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@next/next': nextPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      perfectionist,
      react,
      'react-hooks': reactHooks
    },
    rules: {
      // Import rules
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',
      'import/no-default-export': 'error',

      // Sorting (perfectionist)
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'alphabetical',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type'
          ],
          internalPattern: ['^@/', '^~/']
        }
      ],
      'perfectionist/sort-interfaces': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-object-types': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-jsx-props': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-named-exports': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-union-types': ['error', { type: 'alphabetical' }],

      // TypeScript strict rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false
        }
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Modern JavaScript rules
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-alert': 'off',

      // Code quality
      'no-console': 'warn',
      'no-debugger': 'error',

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // React rules
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/display-name': 'off',
      'react/react-in-jsx-scope': 'off',
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',

      // Extra strictness
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'error'
    }
  },
  {
    files: [
      '**/page.tsx',
      '**/layout.tsx',
      '**/loading.tsx',
      '**/error.tsx',
      '**/not-found.tsx',
      '**/template.tsx',
      '**/default.tsx',
      '**/providers.tsx',
      'next.config.ts'
    ],
    rules: {
      'import/no-default-export': 'off'
    }
  }
]

export default eslintConfig
