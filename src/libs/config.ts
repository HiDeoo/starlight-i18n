import { dirname } from 'node:path'

import { FileType, Uri, workspace, type WorkspaceFolder } from 'vscode'

import { getStarlightLocalesConfigFromCode } from './ast'

// https://docs.astro.build/en/guides/configuring-astro/#supported-config-file-types
const configFileNames = new Set(['astro.config.mjs', 'astro.config.ts', 'astro.config.cjs', 'astro.config.js'])

export async function getStarlightUris(
  workspaceFolder: WorkspaceFolder,
  configDirectories: string[],
): Promise<StarlightUris | undefined> {
  const config = await getAstroConfigUri(workspaceFolder, configDirectories)

  if (!config) {
    return
  }

  return {
    config,
    content: Uri.joinPath(Uri.file(dirname(config.fsPath)), 'src', 'content', 'docs'),
    workspace: workspaceFolder.uri,
  }
}

async function getAstroConfigUri(workspaceFolder: WorkspaceFolder, configDirectories: string[]) {
  for (const configDirectory of configDirectories) {
    const uri = Uri.joinPath(workspaceFolder.uri, configDirectory)

    try {
      const entries = await workspace.fs.readDirectory(uri)

      for (const [name, type] of entries) {
        if (type === FileType.File && configFileNames.has(name)) {
          return Uri.joinPath(uri, name)
        }
      }
    } catch {
      // We can safely ignore errors related to missing directories.
    }
  }

  return undefined
}

export async function getStarlightLocalesConfig(configUri: Uri): Promise<LocalesConfig> {
  const configData = await workspace.fs.readFile(configUri)
  const configStr = Buffer.from(configData).toString('utf8')

  return getStarlightLocalesConfigFromCode(configStr, async (relativePath) => {
    try {
      const jsonData = await workspace.fs.readFile(Uri.joinPath(Uri.joinPath(configUri, '..'), relativePath))

      return Buffer.from(jsonData).toString('utf8')
    } catch {
      throw new Error('Failed to read imported JSON locales configuration.')
    }
  })
}

export interface Locale {
  label: string
  lang?: string
}

export interface LocalesConfig {
  defaultLocale: string
  locales: Record<string, Locale>
}

export interface StarlightUris {
  config: Uri
  content: Uri
  workspace: Uri
}
