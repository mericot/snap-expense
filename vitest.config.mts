import { defineConfig } from 'vitest/config'

/**
 * Next's own Vitest guide reaches for jsdom, @vitejs/plugin-react and Testing
 * Library, because it is written for testing components. Nothing here is a
 * component: these tests exercise route handlers, which are plain async
 * functions over Request and Response. So the environment is `node` — where
 * `Response.json()` is the real one rather than a jsdom approximation — and the
 * React and DOM packages are simply not installed. Add them the day a component
 * test needs them, not before.
 *
 * That same guide also tells you to install `vite-tsconfig-paths` for the `@/…`
 * aliases. This version of Vite resolves them natively and warns that the
 * plugin is redundant, so the option below replaces it. Something has to do the
 * job: it is what makes `@/…` imports resolve in the code under test, and what
 * lets `vi.mock('@/lib/stripe')` line up with the specifier the route imports.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
