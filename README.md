# create-vue-forge

hello

Vue 3 脚手架 CLI，支持 TypeScript、Pinia、Vue Router、ESLint、Prettier、Vitest，以及带独立发版管理的 Monorepo 模式。

## 安装

```bash
# 全局安装（推荐）
pnpm add -g create-vue-forge

# 或直接使用 pnpm create
pnpm create vue-forge my-app
```

## 快速上手

```bash
# 交互式创建（推荐）
create-vue-forge

# 指定项目名
create-vue-forge my-app

# 简写命令
cvf my-app
```

---

## 使用方式

### 交互式模式

直接运行命令，按提示选择配置：

```
┌  create-vue-forge
│
◆  Project name
│  my-app
◆  Project type
│  ● Single App  /  ○ Monorepo
◆  Use TypeScript?         › Yes
◆  Add Pinia?              › Yes
◆  Add Vue Router?         › Yes
◆  Add ESLint + Prettier?  › Yes
◆  Add Vitest?             › Yes
└
```

### 非交互模式（`--yes`）

通过 flags 跳过所有提示，适合 CI 或脚本调用：

```bash
# Single App，全部默认（TypeScript + Pinia + Router + ESLint + Vitest）
cvf my-app --yes

# 关闭某些功能
cvf my-app --yes --no-pinia --no-vitest

# Monorepo，指定包名
cvf my-workspace --yes --type monorepo --packages "app,ui,utils"
```

**可用 flags：**

| Flag | 默认值 | 说明 |
|------|--------|------|
| `--yes` / `-y` | `false` | 非交互模式，使用默认值或指定 flags |
| `--type` / `-t` | `single` | 项目类型：`single` 或 `monorepo` |
| `--packages` / `-p` | `app,ui,utils` | Monorepo 包名，逗号分隔 |
| `--ts` / `--no-ts` | `true` | 是否启用 TypeScript |
| `--pinia` / `--no-pinia` | `true` | 是否添加 Pinia |
| `--router` / `--no-router` | `true` | 是否添加 Vue Router |
| `--lint` / `--no-lint` | `true` | 是否添加 ESLint + Prettier |
| `--vitest` / `--no-vitest` | `true` | 是否添加 Vitest |

---

## 生成的项目结构

### Single App

```
my-app/
├── src/
│   ├── assets/
│   ├── views/           # HomeView.vue, AboutView.vue（开启 Router 时）
│   ├── router/          # index.ts（开启 Router 时）
│   ├── stores/          # counter.ts（开启 Pinia 时）
│   ├── __tests__/       # example.test.ts（开启 Vitest 时）
│   ├── App.vue
│   ├── main.ts
│   └── env.d.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vitest.config.ts     # 开启 Vitest 时
├── eslint.config.js     # 开启 ESLint 时
├── .prettierrc          # 开启 ESLint 时
└── package.json
```

生成后启动开发服务器：

```bash
cd my-app
pnpm install
pnpm dev
```

### Monorepo

```
my-workspace/
├── packages/
│   ├── app/             # Vue 应用包（包名含 app/web/site/demo 自动识别）
│   │   ├── src/
│   │   ├── index.html
│   │   └── package.json
│   ├── ui/              # 库包（自动配置 vite lib 模式 + dts 导出）
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── vite.config.ts
│   │   ├── tsconfig.build.json
│   │   └── package.json
│   └── utils/           # 库包（同上）
├── .changeset/
│   └── config.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── pnpm-workspace.yaml
├── eslint.config.js
├── tsconfig.json        # Project References 根配置
└── package.json
```

#### 包类型自动识别

包名前缀为 `app`、`apps`、`web`、`site`、`demo` 时生成完整 Vue 应用，其余生成库包（lib 模式 + 类型声明导出）。

#### 库包特性

- `vite build --lib`，输出 ES Module
- `vite-plugin-dts` 自动生成 `.d.ts`
- `package.json` 包含 `exports`、`types`、`files` 字段
- `peerDependencies` 声明 `vue: ^3.4.0`

---

## Monorepo 发版工作流

本项目使用 [Changesets](https://github.com/changesets/changesets) 管理独立版本号，每个包可以有不同的版本。

### 日常开发

```bash
# 安装依赖
pnpm install

# 并行启动所有包的开发模式
pnpm dev

# 构建所有包
pnpm build

# 运行所有包的测试
pnpm test
```

### 发版流程

```bash
# 第一步：修改代码后，描述本次变更
pnpm changeset
# 交互式选择：哪些包有变更？变更级别是 patch / minor / major？写一行描述。
# 执行后在 .changeset/ 目录生成一个 markdown 文件。

# 第二步：应用所有 changeset，批量更新版本号 + 生成 CHANGELOG
pnpm version-packages
# 这一步会修改各包的 package.json version 字段，并更新 CHANGELOG.md

# 第三步：构建并发布到 npm
pnpm release
```

### GitHub Actions 自动发版

`.github/workflows/release.yml` 使用 [changesets/action](https://github.com/changesets/action)：

- 当 `.changeset/` 目录有未应用的 changeset 时，自动创建一个「Version Packages」PR
- 合并该 PR 后，自动执行 `pnpm release` 发布到 npm

**需要在仓库 Secrets 中配置：**

| Secret | 说明 |
|--------|------|
| `NPM_TOKEN` | npm 发布 token（`npm token create`） |
| `GITHUB_TOKEN` | 自动提供，无需手动配置 |

### 版本号语义

| 变更类型 | 版本级别 | 示例 |
|---------|---------|------|
| Bug 修复 | `patch` | `1.0.0` → `1.0.1` |
| 新功能（向后兼容） | `minor` | `1.0.0` → `1.1.0` |
| 破坏性变更 | `major` | `1.0.0` → `2.0.0` |

---

## 技术栈说明

| 工具 | 版本 | 用途 |
|------|------|------|
| [Vue 3](https://vuejs.org/) | `^3.4` | 框架 |
| [Vite](https://vitejs.dev/) | `^5.2` | 构建工具 |
| [TypeScript](https://www.typescriptlang.org/) | `^5.4` | 类型系统 |
| [Pinia](https://pinia.vuejs.org/) | `^2.1` | 状态管理 |
| [Vue Router](https://router.vuejs.org/) | `^4.3` | 路由 |
| [ESLint](https://eslint.org/) | `^9` | 代码检查（Flat Config） |
| [@antfu/eslint-config](https://github.com/antfu/eslint-config) | `^2.9` | ESLint 规则集 |
| [Prettier](https://prettier.io/) | `^3.2` | 代码格式化 |
| [Vitest](https://vitest.dev/) | `^1.4` | 单元测试 |
| [Changesets](https://github.com/changesets/changesets) | `^2.27` | 版本管理（Monorepo） |
| [pnpm](https://pnpm.io/) | `>=8` | 包管理器 |

---

## 开发 CLI 本身

```bash
# 克隆后安装依赖
pnpm install

# 监听模式构建（开发时）
pnpm dev

# 生产构建
pnpm build

# 链接到全局（本地调试）
pnpm link --global

# 测试 CLI
cvf test-project --yes
cvf test-mono --yes --type monorepo --packages "app,ui,utils"
```

### 项目源码结构

```
src/
├── index.ts                # CLI 入口，交互式 & 非交互式逻辑
├── types.ts                # ScaffoldConfig 类型定义
├── generators/
│   ├── single.ts           # Single App 生成器
│   └── monorepo.ts         # Monorepo 生成器（含包类型识别）
└── utils/
    ├── fs.ts               # 文件写入工具函数
    └── templates.ts        # 所有模板内容（package.json / tsconfig / vite.config 等）
```
