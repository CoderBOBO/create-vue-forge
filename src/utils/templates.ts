import type { ScaffoldConfig } from '../types.js'

// ---- package.json deps ----

export function getVueDeps(cfg: ScaffoldConfig) {
  const deps: Record<string, string> = {
    vue: '^3.4.0',
  }
  if (cfg.usePinia) deps['pinia'] = '^2.1.7'
  if (cfg.useRouter) deps['vue-router'] = '^4.3.0'
  return deps
}

export function getVueDevDeps(cfg: ScaffoldConfig) {
  const devDeps: Record<string, string> = {
    '@vitejs/plugin-vue': '^5.0.3',
    vite: '^5.2.0',
    'vite-plugin-vue-devtools': '^7.0.15',
  }
  if (cfg.useTs) {
    devDeps['typescript'] = '^5.4.0'
    devDeps['vue-tsc'] = '^2.0.6'
    devDeps['@vue/tsconfig'] = '^0.5.1'
    devDeps['@tsconfig/node20'] = '^20.1.2'
  }
  if (cfg.usePinia) {
    devDeps['@pinia/testing'] = '^0.1.3'
  }
  if (cfg.useLint) {
    Object.assign(devDeps, getLintDevDeps())
  }
  if (cfg.useVitest) {
    devDeps['@vue/test-utils'] = '^2.4.5'
    devDeps['vitest'] = '^1.4.0'
    devDeps['jsdom'] = '^24.0.0'
    devDeps['@vitest/coverage-v8'] = '^1.4.0'
  }
  return devDeps
}

export function getLintDevDeps() {
  return {
    '@antfu/eslint-config': '^2.9.0',
    eslint: '^9.0.0',
    prettier: '^3.2.5',
    'eslint-config-prettier': '^9.1.0',
    'eslint-plugin-prettier': '^5.1.3',
  }
}

// ---- vite.config ----

export function viteConfig(cfg: ScaffoldConfig, extraPlugins = ''): string {
  const ext = cfg.useTs ? 'ts' : 'js'
  const plugins = ['vue()', 'vueDevTools()', extraPlugins].filter(Boolean).join(',\n    ')
  return `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    ${plugins}
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
`
}

// ---- tsconfig ----

export function tsConfig(): string {
  return `{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" }
  ]
}
`
}

export function tsConfigApp(): string {
  return `{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": ["env.d.ts", "src/**/*", "src/**/*.vue"],
  "exclude": ["src/**/__tests__/*"],
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`
}

export function tsConfigNode(): string {
  return `{
  "extends": "@tsconfig/node20/tsconfig.json",
  "include": [
    "vite.config.*",
    "vitest.config.*",
    "cypress.config.*",
    "nightwatch.conf.*",
    "playwright.config.*"
  ],
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true
  }
}
`
}

// ---- ESLint ----

export function eslintConfig(): string {
  return `import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'

export default antfu(
  {
    vue: true,
    typescript: true,
  },
  prettier,
)
`
}

// ---- Prettier ----

export function prettierConfig(): string {
  return `{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "endOfLine": "lf"
}
`
}

// ---- .gitignore ----

export function gitignore(): string {
  return `# Logs
logs
*.log
npm-debug.log*
pnpm-debug.log*

node_modules
.DS_Store
dist
dist-ssr
coverage
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`
}

// ---- env.d.ts ----

export function envDts(): string {
  return `/// <reference types="vite/client" />
`
}

// ---- App.vue ----

export function appVue(cfg: ScaffoldConfig): string {
  const routerImport = cfg.useRouter ? `import { RouterView } from 'vue-router'` : ''
  const storeImport = cfg.usePinia ? `import { useCounterStore } from '@/stores/counter'` : ''
  const setupBody = cfg.usePinia
    ? `\nconst counter = useCounterStore()`
    : ''
  const template = cfg.useRouter
    ? `<RouterView />`
    : cfg.usePinia
      ? `<div>Count: {{ counter.count }}</div>\n  <button @click="counter.increment">+1</button>`
      : `<h1>Hello Vue 3!</h1>`

  return `<script setup${cfg.useTs ? ' lang="ts"' : ''}>
${[routerImport, storeImport].filter(Boolean).join('\n')}
${setupBody}
</script>

<template>
  ${template}
</template>
`
}

// ---- main.ts ----

export function mainTs(cfg: ScaffoldConfig): string {
  const ext = cfg.useTs ? 'ts' : 'js'
  const lines: string[] = [`import { createApp } from 'vue'`, `import App from './App.vue'`]
  if (cfg.usePinia) lines.push(`import { createPinia } from 'pinia'`)
  if (cfg.useRouter) lines.push(`import router from './router'`)

  lines.push(``, `const app = createApp(App)`)
  if (cfg.usePinia) lines.push(`app.use(createPinia())`)
  if (cfg.useRouter) lines.push(`app.use(router)`)
  lines.push(`app.mount('#app')`)

  return lines.join('\n') + '\n'
}

// ---- router/index.ts ----

export function routerIndex(cfg: ScaffoldConfig): string {
  return `import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
`
}

// ---- Pinia store ----

export function piniaStore(cfg: ScaffoldConfig): string {
  return `import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)

  function increment() {
    count.value++
  }

  return { count, increment }
})
`
}

// ---- Views ----

export function homeView(): string {
  return `<script setup lang="ts">
</script>

<template>
  <main>
    <h1>Home</h1>
  </main>
</template>
`
}

export function aboutView(): string {
  return `<script setup lang="ts">
</script>

<template>
  <main>
    <h1>About</h1>
  </main>
</template>
`
}

// ---- index.html ----

export function indexHtml(name: string, useTs: boolean): string {
  const ext = useTs ? 'ts' : 'js'
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.${ext}"></script>
  </body>
</html>
`
}

// ---- vitest.config ----

export function vitestConfig(cfg: ScaffoldConfig): string {
  return `import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
`
}
