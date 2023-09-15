import { dirname } from 'node:path'

import type { ObjectProperty, Program } from '@babel/types'
import {
  parseModule,
  type ProxifiedFunctionCall,
  type ProxifiedObject,
  type ProxifiedIdentifier,
  type ProxifiedModule,
} from 'magicast'
import { FileType, Uri, workspace, type WorkspaceFolder } from 'vscode'

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
  const configMod = parseModule<AstroConfigExports>(configStr)
  const astroConfig = getAstroConfig(configMod.exports['default'])
  const starlightIntegration = getStarlightIntegration(astroConfig.integrations)

  if (!starlightIntegration) {
    throw new Error('Failed to find Starlight integration in Astro configuration file.')
  }

  const starlightConfig = starlightIntegration.$args[0]
  const starlightLocales = getStarlightLocales(configMod, starlightConfig)

  return starlightLocales
}

function getAstroConfig(node: AstroConfigExports['default']): AstroConfig {
  return (node.$type === 'function-call' ? node.$args[0] : node) as AstroConfig
}

function getStarlightIntegration(integrations: ProxifiedFunctionCall[]): StarlightIntegration | undefined {
  return integrations.find((integration: ProxifiedFunctionCall) => integration.$callee === 'starlight') as
    | StarlightIntegration
    | undefined
}

function getStarlightLocales(configMod: ProxifiedModule, starlightConfig: StarlightConfig): LocalesConfig {
  if (!starlightConfig.locales) {
    throw new Error('Failed to find locales in Starlight configuration.')
  }

  const { defaultLocale, locales } = starlightConfig
  // We need to use the AST to get the locales configuration as the proxified object returned by magicast does not
  // contains locales with a dash in their name.
  let node = locales.$ast

  if (locales.$type === 'identifier') {
    // If the locales configuration is an identifier, we need to find the corresponding variable declaration (exported
    // or not) to get the AST.
    for (const bodyNode of (configMod.$ast as Program).body) {
      const variableDeclaration =
        bodyNode.type === 'VariableDeclaration'
          ? bodyNode
          : bodyNode.type === 'ExportNamedDeclaration' && bodyNode.declaration?.type === 'VariableDeclaration'
          ? bodyNode.declaration
          : undefined

      if (!variableDeclaration) {
        continue
      }

      for (const declaration of variableDeclaration.declarations) {
        if (declaration.id.type === 'Identifier' && declaration.id.name === locales.$name && declaration.init) {
          node = declaration.init
        }
      }
    }
  }

  if (node.type !== 'ObjectExpression') {
    throw new TypeError('Invalid Starlight locales configuration.')
  }

  const allLocales: LocalesConfig['locales'] = {}

  for (const locale of node.properties) {
    if (locale.type !== 'ObjectProperty') {
      continue
    }

    const name = getObjectPropertyName(locale)

    if (!name) {
      continue
    }

    const value = locale.value

    if (value.type !== 'ObjectExpression') {
      continue
    }

    const config: Record<string, string> = {}

    for (const property of value.properties) {
      if (property.type !== 'ObjectProperty') {
        continue
      }

      const propertyName = getObjectPropertyName(property)
      const propertyValue = getObjectPropertyStringValue(property)

      if (!propertyName || !propertyValue) {
        continue
      }

      config[propertyName] = propertyValue
    }

    if (isLocale(config)) {
      allLocales[name] = config as Locale
    }
  }

  const configDefaultLocale = defaultLocale ?? Object.entries(allLocales).find(([name]) => name === 'root')?.[1].lang

  if (!configDefaultLocale) {
    throw new Error('Failed to find Starlight default locale.')
  }

  const localesConfig: LocalesConfig = {
    defaultLocale: configDefaultLocale,
    locales: {},
  }

  for (const [name, locale] of Object.entries(allLocales)) {
    if (name !== localesConfig.defaultLocale) {
      localesConfig.locales[name] = locale
    }
  }

  if (Object.keys(localesConfig.locales).length === 0) {
    throw new Error('Failed to find any Starlight locale to translate.')
  }

  return localesConfig
}

function getObjectPropertyName(node: ObjectProperty): string | undefined {
  return node.key.type === 'StringLiteral' ? node.key.value : node.key.type === 'Identifier' ? node.key.name : undefined
}

function getObjectPropertyStringValue(node: ObjectProperty): string | undefined {
  return node.value.type === 'StringLiteral' ? node.value.value : undefined
}

function isLocale(obj: unknown): obj is Locale {
  return typeof obj === 'object' && obj !== null && typeof (obj as Locale).label === 'string'
}

export interface Locale {
  label: string
  lang?: string
}

export interface LocalesConfig {
  defaultLocale: string
  locales: Record<string, Locale>
}

interface AstroConfigExports {
  default: ProxifiedFunctionCall | ProxifiedObject
}

type AstroConfig = ProxifiedObject<{ integrations: ProxifiedFunctionCall[] }>
type StarlightIntegration = ProxifiedFunctionCall<[ProxifiedObject<StarlightConfig>]>

interface StarlightConfig {
  defaultLocale?: string
  locales?: ProxifiedObject<LocalesConfig['locales']> | ProxifiedIdentifier
}

export interface StarlightUris {
  config: Uri
  content: Uri
  workspace: Uri
}
