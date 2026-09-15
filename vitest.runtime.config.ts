import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: [
      // These frozen research tests recalculate the pre-G3B live src tree.
      // Their historical identity is checked by test:historical instead.
      'test/praetor-verify-001-g2.test.ts',
      'test/praetor-g3a-pilot.test.ts'
    ]
  }
});
