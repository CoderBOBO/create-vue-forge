import fs from 'fs-extra'
import path from 'node:path'

export function write(filePath: string, content: string) {
  fs.ensureDirSync(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf-8')
}

export function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}
