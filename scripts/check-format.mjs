import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as prettier from 'prettier'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scopeArgument = process.argv[2]
const scope = scopeArgument ? resolve(repositoryRoot, scopeArgument) : repositoryRoot
const relativeScope = relative(repositoryRoot, scope)

if (
  relativeScope === '..' ||
  relativeScope.startsWith(`..${sep}`) ||
  (!existsSync(scope) && scope !== repositoryRoot)
) {
  throw new Error(`Format scope must stay inside the repository: ${scopeArgument}`)
}

const baselinePath = join(repositoryRoot, 'config', 'prettier-legacy-baseline.json')
const baselineDocument = JSON.parse(readFileSync(baselinePath, 'utf8'))
const legacyHashes = Object.fromEntries(
  (baselineDocument.files ?? []).map(({ path, sha256 }) => [path, sha256]),
)
const ignorePath = join(repositoryRoot, '.prettierignore')

const gitOutput = execFileSync(
  'git',
  [
    '-c',
    `safe.directory=${repositoryRoot.replaceAll('\\', '/')}`,
    '-c',
    'core.excludesFile=',
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
)

const repositoryFiles = gitOutput
  .split('\0')
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => {
    const absolutePath = resolve(repositoryRoot, file)
    const fileScope = relative(scope, absolutePath)
    return (
      fileScope !== '..' &&
      !fileScope.startsWith(`..${sep}`) &&
      existsSync(absolutePath) &&
      statSync(absolutePath).isFile()
    )
  })
  .sort()

const failures = []
let checkedCount = 0
let unchangedLegacyCount = 0

for (const file of repositoryFiles) {
  const absolutePath = resolve(repositoryRoot, file)
  const fileInfo = await prettier.getFileInfo(absolutePath, {
    ignorePath,
    withNodeModules: false,
  })

  if (fileInfo.ignored || !fileInfo.inferredParser) {
    continue
  }

  const source = readFileSync(absolutePath, 'utf8')
  const hash = createHash('sha256').update(source).digest('hex')

  if (legacyHashes[file] === hash) {
    unchangedLegacyCount += 1
    continue
  }

  const configuration = (await prettier.resolveConfig(absolutePath)) ?? {}
  const formatted = await prettier.format(source, {
    ...configuration,
    filepath: absolutePath,
  })
  checkedCount += 1

  if (formatted !== source) {
    failures.push(file)
  }
}

if (failures.length > 0) {
  console.error('Prettier formatting is required in:')
  for (const file of failures) {
    console.error(`  ${file}`)
  }
  console.error(
    `Checked ${checkedCount} files; preserved ${unchangedLegacyCount} unchanged legacy-baseline files.`,
  )
  process.exitCode = 1
} else {
  console.log(
    `Prettier check passed for ${checkedCount} files; ${unchangedLegacyCount} unchanged legacy-baseline files were preserved.`,
  )
}
