import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Build identity
// ---------------------------------------------------------------------------
// The deployed app has to be able to say which revision it is. Without that,
// "did my push actually ship?" is unanswerable: a browser cache, a failed
// deploy and a stale preview all look exactly the same.
//
// The COMMIT HASH is the primary identity, and it is the better of the two
// options:
//   - Vercel builds one deployment per commit, so the hash both identifies the
//     code and proves the deploy is the one you pushed. A version number
//     cannot do that -- it can go stale, and two different builds can share
//     one.
//   - It is derived automatically, so it can never drift from the code.
// The package version plus a commit count are injected alongside it as a
// human-readable label; the hash stays the thing you trust.
//
// VERCEL_GIT_COMMIT_SHA is set by Vercel during the build, so on the deployed
// site the hash is exactly the deployed commit. Everywhere else we ask git.
function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // git missing, or not a checkout (e.g. a tarball build). Not fatal.
    return ''
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)
const onVercel = Boolean(process.env.VERCEL)
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || git(['rev-parse', 'HEAD'])).trim()

const BUILD_INFO = {
  version: packageJson.version,
  sha,
  shortSha: sha.slice(0, 7),
  branch:
    process.env.VERCEL_GIT_COMMIT_REF || git(['rev-parse', '--abbrev-ref', 'HEAD']),
  // Monotonic and automatic: increments on every commit, so it never needs a
  // manual bump the way the version does.
  build: git(['rev-list', '--count', 'HEAD']),
  builtAt: new Date().toISOString(),
  // Only meaningful locally -- a Vercel build always comes from a clean
  // checkout of one commit.
  dirty: !onVercel && git(['status', '--porcelain']) !== '',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs. The app is a single page with no nested routes, so
  // this costs nothing and makes the dev server work when it is reached
  // through a path-prefixed proxy (e.g. a preview panel), where absolute
  // "/src/..." URLs would resolve against the proxy instead of Vite and come
  // back as HTML -- which the browser rejects with a MIME type error.
  base: './',
  server: {
    // Listen on every interface so the server is reachable over IPv4 as well
    // as the IPv6-only default of "localhost" on Windows.
    host: true,
  },
  // Replaced with a literal object at build time; read by src/buildInfo.js.
  define: {
    __BUILD_INFO__: JSON.stringify(BUILD_INFO),
  },
})
