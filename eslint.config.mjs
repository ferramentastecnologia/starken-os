import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node/Vercel serverless globals
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortController: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-constant-condition': 'warn',
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'eqeqeq': ['warn', 'smart'],
      'preserve-caught-error': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      '*.html',
      'stitch-designs/',
      'supabase/',
      'docker/',
      'Exportacao Trello/',
      '*.py',
      '*.ps1',
      '*.sh',
    ],
  },
];
