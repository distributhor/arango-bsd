module.exports = {
  root: true,

  env: {
    node: true,
    jest: true,
    es2021: true,
    'jest/globals': true
  },

  extends: ['plugin:jest/recommended', 'plugin:jsonc/recommended-with-json', 'standard'],

  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },

  rules: {
    'space-before-function-paren': [
      'error',
      {
        named: 'never',
        anonymous: 'always',
        asyncArrow: 'always'
      }
    ],

    'max-len': [
      'error',
      {
        code: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreComments: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreTrailingComments: true
      }
    ]
  },

  overrides: [
    {
      files: ['*.json'],
      parser: 'jsonc-eslint-parser'
    },
    {
      files: ['src/**/*.ts', 'test/**/*.ts'],
      // the combination of 'files' and 'parserOptions.project'
      // are used to determine which files to lint

      extends: ['plugin:jest/recommended', 'standard-with-typescript'],

      parserOptions: {
        project: ['./tsconfig.eslint.json']
      },

      rules: {
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-dynamic-delete': 0,
        '@typescript-eslint/strict-boolean-expressions': 0,
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 0,
        '@typescript-eslint/restrict-template-expressions': 0,

        '@typescript-eslint/space-before-function-paren': [
          'error',
          {
            named: 'never',
            anonymous: 'always',
            asyncArrow: 'always'
          }
        ],

        '@typescript-eslint/explicit-module-boundary-types': [
          'error',
          {
            allowArgumentsExplicitlyTypedAsAny: true
          }
        ]
      }
    }
  ]
}
