import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'test-results/**',
      'public/wasm/**',
      'components/planning/feichuan-gantt/**',
    ],
  },
];

export default config;
