import fs from 'fs-extra'
import path from 'node:path'
import { write } from '../utils/fs.js'
import type { ScaffoldConfig } from '../types.js'
import {
  viteConfig, tsConfig, tsConfigApp, tsConfigNode,
  eslintConfig, prettierConfig, gitignore, envDts,
  appVue, mainTs, routerIndex, piniaStore, homeView, aboutView,
  indexHtml, vitestConfig, getVueDeps, getVueDevDeps,
} from '../utils/templates.js'

export async function createSingleApp(cfg: ScaffoldConfig) {
  const { dir, name, useTs, usePinia, useRouter, useLint, useVitest } = cfg
  const ext = useTs ? 'ts' : 'js'

  fs.ensureDirSync(dir)

  // package.json
  const scripts: Record<string, string> = {
    dev: 'vite',
    build: useTs ? 'vue-tsc --noEmit && vite build' : 'vite build',
    preview: 'vite preview',
  }
  if (useLint) {
    scripts['lint'] = 'eslint . --fix'
    scripts['format'] = 'prettier --write src/'
  }
  if (useVitest) {
    scripts['test'] = 'vitest'
    scripts['test:coverage'] = 'vitest --coverage'
  }

  const pkg = {
    name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts,
    dependencies: getVueDeps(cfg),
    devDependencies: getVueDevDeps(cfg),
  }

  write(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

  // index.html
  write(path.join(dir, 'index.html'), indexHtml(name, useTs))

  // vite.config
  write(path.join(dir, `vite.config.${ext}`), viteConfig(cfg))

  // tsconfig files
  if (useTs) {
    write(path.join(dir, 'tsconfig.json'), tsConfig())
    write(path.join(dir, 'tsconfig.app.json'), tsConfigApp())
    write(path.join(dir, 'tsconfig.node.json'), tsConfigNode())
    write(path.join(dir, 'src', 'env.d.ts'), envDts())
  }

  // ESLint + Prettier
  if (useLint) {
    write(path.join(dir, 'eslint.config.js'), eslintConfig())
    write(path.join(dir, '.prettierrc'), prettierConfig())
    write(path.join(dir, '.prettierignore'), 'dist\nnode_modules\n')
  }

  // .gitignore
  write(path.join(dir, '.gitignore'), gitignore())

  // vitest.config
  if (useVitest) {
    write(path.join(dir, `vitest.config.${ext}`), vitestConfig(cfg))
    write(path.join(dir, 'src', '__tests__', 'example.test.ts'), exampleTest())
  }

  // pnpm-workspace (single app still uses pnpm)
  write(path.join(dir, '.npmrc'), 'shamefully-hoist=false\nstrict-peer-dependencies=false\n')

  // src files
  write(path.join(dir, 'src', `main.${ext}`), mainTs(cfg))
  write(path.join(dir, 'src', 'App.vue'), appVue(cfg))
  write(path.join(dir, 'src', 'assets', 'main.css'), baseCss())

  if (useRouter) {
    write(path.join(dir, 'src', 'router', `index.${ext}`), routerIndex(cfg))
    write(path.join(dir, 'src', 'views', 'HomeView.vue'), homeView())
    write(path.join(dir, 'src', 'views', 'AboutView.vue'), aboutView())
  }

  if (usePinia) {
    write(path.join(dir, 'src', 'stores', `counter.${ext}`), piniaStore(cfg))
  }

  // .vscode
  write(
    path.join(dir, '.vscode', 'extensions.json'),
    JSON.stringify({ recommendations: ['Vue.volar', 'dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'] }, null, 2),
  )
}

function exampleTest(): string {
  return `import { describe, it, expect } from 'vitest'

describe('example', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2)
  })
})
`
}

function baseCss(): string {
  return `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
`
}
