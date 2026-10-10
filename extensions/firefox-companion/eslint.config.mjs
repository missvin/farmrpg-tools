import js from '@eslint/js';
import globals from 'globals';
export default [
  {files:['**/*.js'], ...js.configs.recommended, languageOptions:{ecmaVersion:2022, sourceType:'script', globals:{...globals.browser, browser:'readonly'}}, rules:{...js.configs.recommended.rules,'no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none'}]}},
  {files:['**/*.mjs'], ...js.configs.recommended, languageOptions:{ecmaVersion:2022,sourceType:'module',globals:{...globals.node,...globals.browser}}},
];
