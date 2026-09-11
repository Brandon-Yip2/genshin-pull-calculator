import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
})
