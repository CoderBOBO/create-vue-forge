import fs from 'fs-extra'
import path from 'node:path'
import { write } from '../utils/fs.js'
import type { ScaffoldConfig } from '../types.js'
import {
  eslintConfig, prettierConfig, gitignore,
  getLintDevDeps, getVueDeps, getVueDevDeps,
  viteConfig, tsConfig, tsConfigApp, tsConfigNode,
  envDts, mainTs, appVue, routerIndex, piniaStore,
  homeView, aboutView, indexHtml, vitestConfig,
} from '../utils/templates.js'

export async function createMonorepo(cfg: ScaffoldConfig) {
  const { dir, name, packages, useTs, usePinia, useRouter, useLint, useVitest } = cfg

  fs.ensureDirSync(dir)

  // ── Root package.json ────────────────────────────────────────────────
  const rootScripts: Record<string, string> = {
    build: 'pnpm -r build',
    dev: 'pnpm -r --parallel dev',
    'changeset': 'changeset',
    'version-packages': 'changeset version',
    'release': 'pnpm build && changeset publish',
    'clean': 'pnpm -r exec rm -rf dist node_modules/.cache',
  }
  if (useLint) {
    rootScripts['lint'] = 'eslint . --fix'
    rootScripts['format'] = 'prettier --write packages/'
  }
  if (useVitest) {
    rootScripts['test'] = 'pnpm -r test'
    rootScripts['test:coverage'] = 'pnpm -r test:coverage'
  }

  const rootPkg = {
    name,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: rootScripts,
    devDependencies: {
      '@changesets/cli': '^2.27.1',
      ...(useLint ? getLintDevDeps() : {}),
      ...(useTs ? { typescript: '^5.4.0' } : {}),
    },
    engines: { node: '>=18', pnpm: '>=8' },
  }

  write(path.join(dir, 'package.json'), JSON.stringify(rootPkg, null, 2) + '\n')

  // ── pnpm-workspace.yaml ──────────────────────────────────────────────
  write(path.join(dir, 'pnpm-workspace.yaml'), pnpmWorkspace(packages))

  // ── .npmrc ───────────────────────────────────────────────────────────
  write(path.join(dir, '.npmrc'), npmrc())

  // ── .gitignore ───────────────────────────────────────────────────────
  write(path.join(dir, '.gitignore'), gitignore())

  // ── ESLint + Prettier (root) ─────────────────────────────────────────
  if (useLint) {
    write(path.join(dir, 'eslint.config.js'), eslintConfig())
    write(path.join(dir, '.prettierrc'), prettierConfig())
    write(path.join(dir, '.prettierignore'), 'dist\nnode_modules\n*.d.ts\n')
  }

  // ── Root tsconfig ────────────────────────────────────────────────────
  if (useTs) {
    write(path.join(dir, 'tsconfig.json'), rootTsConfig(packages))
  }

  // ── Changesets config ────────────────────────────────────────────────
  write(path.join(dir, '.changeset', 'config.json'), changesetsConfig(name))
  write(path.join(dir, '.changeset', 'README.md'), changesetsReadme())

  // ── GitHub Actions CI ────────────────────────────────────────────────
  write(path.join(dir, '.github', 'workflows', 'ci.yml'), ciWorkflow())
  write(path.join(dir, '.github', 'workflows', 'release.yml'), releaseWorkflow())

  // ── VS Code settings ─────────────────────────────────────────────────
  write(
    path.join(dir, '.vscode', 'extensions.json'),
    JSON.stringify({ recommendations: ['Vue.volar', 'dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'] }, null, 2),
  )
  write(path.join(dir, '.vscode', 'settings.json'), vscodeSettings())

  // ── Per-package scaffolding ──────────────────────────────────────────
  for (const pkg of packages) {
    await scaffoldPackage(cfg, dir, name, pkg)
  }

  // ── Root README ──────────────────────────────────────────────────────
  write(path.join(dir, 'README.md'), rootReadme(name, packages))
}

// ────────────────────────────────────────────────────────────────────────────
// Package scaffolder — detects type from name (app/apps → Vue app, else lib)
// ────────────────────────────────────────────────────────────────────────────

async function scaffoldPackage(
  cfg: ScaffoldConfig,
  root: string,
  rootName: string,
  pkg: string,
) {
  const isApp = /^(app|apps|web|site|demo)/.test(pkg)
  const pkgDir = path.join(root, 'packages', pkg)
  const ext = cfg.useTs ? 'ts' : 'js'
  const fullName = `@${rootName}/${pkg}`

  const scripts: Record<string, string> = isApp
    ? {
        dev: 'vite',
        build: cfg.useTs ? 'vue-tsc --noEmit && vite build' : 'vite build',
        preview: 'vite preview',
      }
    : {
        build: cfg.useTs ? 'vue-tsc -p tsconfig.build.json --noEmit && vite build' : 'vite build',
        dev: 'vite build --watch',
        'type-check': 'vue-tsc --noEmit',
      }

  if (cfg.useVitest) {
    scripts['test'] = 'vitest run'
    scripts['test:coverage'] = 'vitest run --coverage'
  }

  const pkgJson: Record<string, unknown> = {
    name: fullName,
    version: '0.1.0',
    private: isApp,
    type: 'module',
    scripts,
    ...(isApp
      ? {}
      : {
          main: './dist/index.js',
          module: './dist/index.js',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              import: './dist/index.js',
              types: './dist/index.d.ts',
            },
          },
          files: ['dist'],
        }),
    dependencies: {
      ...(isApp ? getVueDeps(cfg) : { vue: '^3.4.0' }),
    },
    devDependencies: {
      ...(isApp ? getVueDevDeps(cfg) : libDevDeps(cfg)),
    },
    peerDependencies: isApp
      ? {}
      : { vue: '^3.4.0' },
  }

  // clean up empty peerDependencies
  if (isApp) delete (pkgJson as Record<string, unknown>).peerDependencies

  write(path.join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n')

  if (cfg.useTs) {
    write(path.join(pkgDir, 'tsconfig.json'), isApp ? tsConfig() : libTsConfig())
    write(path.join(pkgDir, 'tsconfig.app.json'), tsConfigApp())
    write(path.join(pkgDir, 'tsconfig.node.json'), tsConfigNode())
    if (!isApp) {
      write(path.join(pkgDir, 'tsconfig.build.json'), libTsConfigBuild())
    }
    write(path.join(pkgDir, 'src', 'env.d.ts'), envDts())
  }

  if (isApp) {
    // Full Vue app
    write(path.join(pkgDir, 'index.html'), indexHtml(pkg, cfg.useTs))
    write(path.join(pkgDir, `vite.config.${ext}`), viteConfig(cfg))
    write(path.join(pkgDir, 'src', `main.${ext}`), mainTs(cfg))
    write(path.join(pkgDir, 'src', 'App.vue'), appVue(cfg))
    if (cfg.useRouter) {
      write(path.join(pkgDir, 'src', 'router', `index.${ext}`), routerIndex(cfg))
      write(path.join(pkgDir, 'src', 'views', 'HomeView.vue'), homeView())
      write(path.join(pkgDir, 'src', 'views', 'AboutView.vue'), aboutView())
    }
    if (cfg.usePinia) {
      write(path.join(pkgDir, 'src', 'stores', `counter.${ext}`), piniaStore(cfg))
    }
  } else {
    // Library package
    write(path.join(pkgDir, `vite.config.${ext}`), libViteConfig(cfg, pkg))
    write(path.join(pkgDir, 'src', `index.${ext}`), libIndex(pkg, cfg.useTs))
    if (cfg.useVitest) {
      write(path.join(pkgDir, `vitest.config.${ext}`), vitestConfig(cfg))
      write(path.join(pkgDir, 'src', '__tests__', `${pkg}.test.${ext}`), libTest(pkg))
    }
  }

  write(path.join(pkgDir, 'README.md'), pkgReadme(pkg, fullName, isApp))
}

// ────────────────────────────────────────────────────────────────────────────
// Template helpers
// ────────────────────────────────────────────────────────────────────────────

function libDevDeps(cfg: ScaffoldConfig): Record<string, string> {
  const d: Record<string, string> = {
    '@vitejs/plugin-vue': '^5.0.3',
    vite: '^5.2.0',
    'vite-plugin-dts': '^3.9.1',
    vue: '^3.4.0',
  }
  if (cfg.useTs) {
    d['typescript'] = '^5.4.0'
    d['vue-tsc'] = '^2.0.6'
    d['@vue/tsconfig'] = '^0.5.1'
    d['@tsconfig/node20'] = '^20.1.2'
  }
  if (cfg.useVitest) {
    d['@vue/test-utils'] = '^2.4.5'
    d['vitest'] = '^1.4.0'
    d['jsdom'] = '^24.0.0'
    d['@vitest/coverage-v8'] = '^1.4.0'
  }
  return d
}

function libViteConfig(cfg: ScaffoldConfig, pkg: string): string {
  return `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    ${cfg.useTs ? `dts({ include: ['src'], rollupTypes: true }),` : ''}
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.${cfg.useTs ? 'ts' : 'js'}', import.meta.url)),
      name: '${toPascalCase(pkg)}',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue', 'pinia', 'vue-router'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
})
`
}

function libIndex(pkg: string, useTs: boolean): string {
  return `// ${pkg} package entry point
export const VERSION = '0.1.0'

export function hello(name${useTs ? ': string' : ''}): string {
  return \`Hello from @${pkg}/\${name}\`
}
`
}

function libTest(pkg: string): string {
  return `import { describe, it, expect } from 'vitest'
import { hello } from '../index.js'

describe('${pkg}', () => {
  it('hello returns greeting', () => {
    expect(hello('world')).toBe('Hello from @${pkg}/world')
  })
})
`
}

function pnpmWorkspace(packages: string[]): string {
  const lines = packages.map((p) => `  - 'packages/${p}'`)
  return `packages:\n${lines.join('\n')}\n`
}

function npmrc(): string {
  return `shamefully-hoist=false
strict-peer-dependencies=false
enable-pre-post-scripts=true
auto-install-peers=true
`
}

function rootTsConfig(packages: string[]): string {
  const refs = packages.map((p) => `    { "path": "packages/${p}/tsconfig.json" }`)
  return `{
  "files": [],
  "references": [
${refs.join(',\n')}
  ]
}
`
}

function libTsConfig(): string {
  return `{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
`
}

function libTsConfigBuild(): string {
  return `{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationDir": "./dist",
    "outDir": "./dist"
  }
}
`
}

function changesetsConfig(name: string): string {
  return JSON.stringify(
    {
      $schema: 'https://unpkg.com/@changesets/config@3.0.0/schema.json',
      changelog: '@changesets/cli/changelog',
      commit: false,
      fixed: [],
      linked: [],
      access: 'restricted',
      baseBranch: 'main',
      updateInternalDependencies: 'patch',
      ignore: [],
    },
    null,
    2,
  ) + '\n'
}

function changesetsReadme(): string {
  return `# Changesets

This directory is used by Changesets to manage versioning and changelogs.

## Workflow

1. Make changes in packages
2. Run \`pnpm changeset\` to describe changes
3. Run \`pnpm version-packages\` to bump versions
4. Run \`pnpm release\` to publish

## Independent versioning

Each package is versioned independently. This means different packages
can be at different version numbers.
`
}

function ciWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm -r type-check || true

      - name: Lint
        run: pnpm lint || true

      - name: Test
        run: pnpm test || true

      - name: Build
        run: pnpm build
`
}

function releaseWorkflow(): string {
  return `name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm version-packages
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`
}

function vscodeSettings(): string {
  return JSON.stringify(
    {
      'editor.formatOnSave': true,
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
      'eslint.validate': ['javascript', 'typescript', 'vue'],
      '[vue]': { 'editor.defaultFormatter': 'esbenp.prettier-vscode' },
    },
    null,
    2,
  )
}

function rootReadme(name: string, packages: string[]): string {
  return `# ${name}

A monorepo powered by [pnpm workspaces](https://pnpm.io/workspaces) with independent versioning via [Changesets](https://github.com/changesets/changesets).

## Packages

| Package | Description |
|---------|-------------|
${packages.map((p) => `| \`@${name}/${p}\` | ${p} package |`).join('\n')}

## Getting Started

\`\`\`bash
pnpm install
pnpm build
pnpm dev
\`\`\`

## Versioning & Release

This monorepo uses [Changesets](https://github.com/changesets/changesets) for independent versioning.

\`\`\`bash
# 1. Add a changeset after making changes
pnpm changeset

# 2. Version packages (bumps versions + generates changelogs)
pnpm version-packages

# 3. Publish to npm
pnpm release
\`\`\`

## Scripts

| Script | Description |
|--------|-------------|
| \`pnpm dev\` | Start all packages in dev mode |
| \`pnpm build\` | Build all packages |
| \`pnpm test\` | Run all tests |
| \`pnpm lint\` | Lint all packages |
| \`pnpm changeset\` | Create a new changeset |
| \`pnpm version-packages\` | Apply changesets to bump versions |
| \`pnpm release\` | Build + publish changed packages |
`
}

function pkgReadme(pkg: string, fullName: string, isApp: boolean): string {
  return `# ${fullName}

${isApp ? 'A Vue 3 application.' : 'A Vue 3 library package.'}

## Usage

${isApp
    ? `\`\`\`bash\npnpm dev\n\`\`\``
    : `\`\`\`ts\nimport { hello } from '${fullName}'\n\nconsole.log(hello('world'))\n\`\`\``}
`
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}
