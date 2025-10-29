const fs = require('fs');
const path = require('path');

module.exports = {
  input: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!**/node_modules/**',
  ],
  output: './',
  options: {
    debug: false,
    removeUnusedKeys: false,
    sort: false,
    func: {
      list: ['t'],
      extensions: ['.ts', '.tsx'],
    },
    lngs: ['en-US', 'zh-CN'],
    ns: ['translation'],
    defaultLng: 'en-US',
    defaultNs: 'translation',
    defaultValue: (lng, ns, key) => {
      return lng === 'en-US' ? key : '';
    },
    resource: {
      loadPath: 'src/locales/{{lng}}/{{ns}}.json',
      savePath: 'src/locales/{{lng}}/{{ns}}.new.json',
      jsonIndent: 2,
      lineEnding: '\n',
    },
    interpolation: {
      prefix: '{{',
      suffix: '}}',
    },
    // Custom parser to handle TypeScript
    keySeparator: false,
    nsSeparator: false,
  },
};
