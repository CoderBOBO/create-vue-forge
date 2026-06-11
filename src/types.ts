export interface ScaffoldConfig {
  name: string
  dir: string
  useTs: boolean
  usePinia: boolean
  useRouter: boolean
  useLint: boolean
  useVitest: boolean
  packages: string[]
}
