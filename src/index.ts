#!/usr/bin/env node
import * as p from '@clack/prompts'
import chalk from 'chalk'
import minimist from 'minimist'
import path from 'node:path'
import fs from 'fs-extra'
import { createSingleApp } from './generators/single.js'
import { createMonorepo } from './generators/monorepo.js'

const argv = minimist(process.argv.slice(2), {
  string: ['_', 'type', 'packages'],
  boolean: ['ts', 'pinia', 'router', 'lint', 'vitest', 'yes'],
  default: { ts: true, pinia: true, router: true, lint: true, vitest: true },
  alias: { y: 'yes', t: 'type', p: 'packages' },
})

// Non-interactive mode: all answers supplied via flags
async function mainNonInteractive() {
  const name = argv._[0]
  if (!name) {
    console.error('Usage: create-vue-forge <project-name> --yes [--type single|monorepo] [--packages ui,utils,app]')
    process.exit(1)
  }

  const type = argv.type ?? 'single'
  const packages = argv.packages ? (argv.packages as string).split(',').map((s: string) => s.trim()) : ['app', 'ui', 'utils']
  const dir = path.resolve(process.cwd(), name)

  if (fs.existsSync(dir)) await fs.remove(dir)

  const config = {
    name,
    dir,
    useTs: argv.ts as boolean,
    usePinia: argv.pinia as boolean,
    useRouter: argv.router as boolean,
    useLint: argv.lint as boolean,
    useVitest: argv.vitest as boolean,
    packages: type === 'monorepo' ? packages : [],
  }

  console.log(chalk.cyan(`\nScaffolding ${type} project: ${name}...`))
  if (type === 'monorepo') {
    await createMonorepo(config)
  } else {
    await createSingleApp(config)
  }
  console.log(chalk.green(`\nDone! cd ${name} && pnpm install`))
}

// Interactive mode
async function main() {
  if (argv.yes) {
    await mainNonInteractive()
    return
  }

  console.log()
  p.intro(chalk.bgCyan(chalk.black(' create-vue-forge ')))

  const projectName = argv._[0]

  const options = await p.group(
    {
      name: () =>
        p.text({
          message: 'Project name',
          placeholder: 'my-vue-app',
          initialValue: projectName ?? '',
          validate: (v) => (!v ? 'Project name is required' : undefined),
        }),

      type: () =>
        p.select({
          message: 'Project type',
          options: [
            { value: 'single', label: 'Single App', hint: 'standalone Vue app' },
            { value: 'monorepo', label: 'Monorepo', hint: 'multi-package workspace with independent versioning' },
          ],
        }),

      useTs: () =>
        p.confirm({ message: 'Use TypeScript?', initialValue: true }),

      usePinia: () =>
        p.confirm({ message: 'Add Pinia (state management)?', initialValue: true }),

      useRouter: () =>
        p.confirm({ message: 'Add Vue Router?', initialValue: true }),

      useLint: () =>
        p.confirm({ message: 'Add ESLint + Prettier?', initialValue: true }),

      useVitest: () =>
        p.confirm({ message: 'Add Vitest (unit testing)?', initialValue: true }),

      monorepoPackages: ({ results }) => {
        if (results.type !== 'monorepo') return
        return p.text({
          message: 'Package names (comma-separated)',
          placeholder: 'ui,utils,app',
          initialValue: 'ui,utils,app',
          validate: (v) => (!v ? 'At least one package required' : undefined),
        })
      },
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.')
        process.exit(0)
      },
    },
  )

  const targetDir = path.resolve(process.cwd(), options.name as string)

  if (fs.existsSync(targetDir)) {
    const overwrite = await p.confirm({
      message: `Directory "${options.name}" already exists. Overwrite?`,
      initialValue: false,
    })
    if (!overwrite) {
      p.cancel('Aborted.')
      process.exit(0)
    }
    await fs.remove(targetDir)
  }

  const config = {
    name: options.name as string,
    dir: targetDir,
    useTs: options.useTs as boolean,
    usePinia: options.usePinia as boolean,
    useRouter: options.useRouter as boolean,
    useLint: options.useLint as boolean,
    useVitest: options.useVitest as boolean,
    packages: options.monorepoPackages
      ? (options.monorepoPackages as string).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  }

  const s = p.spinner()
  s.start('Scaffolding project...')

  try {
    if (options.type === 'monorepo') {
      await createMonorepo(config)
    } else {
      await createSingleApp(config)
    }
    s.stop('Project scaffolded successfully!')
  } catch (e) {
    s.stop('Failed to scaffold project')
    console.error(e)
    process.exit(1)
  }

  p.outro(
    chalk.green(`Done! Next steps:\n\n`) +
    chalk.cyan(`  cd ${options.name}\n`) +
    chalk.cyan(`  pnpm install\n`) +
    chalk.cyan(options.type === 'monorepo' ? `  pnpm build\n` : `  pnpm dev\n`),
  )
}

main().catch(console.error)
