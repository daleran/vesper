export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        URLSearchParams: 'readonly',
        CustomEvent: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]
