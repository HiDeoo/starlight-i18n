import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import {
  isCallExpression,
  type File,
  isObjectExpression,
  isObjectProperty,
  isIdentifier,
  isStringLiteral,
  isArrayExpression,
  type ObjectExpression,
  type ObjectProperty,
  isVariableDeclaration,
  isExportNamedDeclaration,
  type Identifier,
  isImportDeclaration,
  isImportDefaultSpecifier,
  isExportDefaultDeclaration,
  type ImportDeclaration,
} from '@babel/types'

import type { Locale, LocalesConfig } from './config'

export async function getStarlightLocalesConfigFromCode(code: string, readJSON: JSONReader) {
  const ast = parseCode(code)
  const starlightConfig = getStarlightConfig(ast)

  const locales = await getStarlightLocalesConfig(ast, starlightConfig, readJSON)
  const defaultLocale =
    getStarlightDefaultLocaleConfig(starlightConfig) ??
    Object.entries(locales).find(([name]) => name === 'root')?.[1].lang

  if (!defaultLocale) {
    throw new Error('Failed to find Starlight default locale.')
  }

  const localesConfig: LocalesConfig = {
    defaultLocale,
    locales: {},
  }

  for (const [name, locale] of Object.entries(locales)) {
    if (name !== localesConfig.defaultLocale && name !== 'root') {
      localesConfig.locales[name] = locale
    }
  }

  if (Object.keys(localesConfig.locales).length === 0) {
    throw new Error('Failed to find any Starlight locale to translate.')
  }

  return localesConfig
}

function parseCode(code: string) {
  const result = parse(code, { sourceType: 'unambiguous', plugins: ['typescript'] })

  if (result.errors.length > 0) {
    throw new Error(`Failed to parse Astro configuration file: ${JSON.stringify(result.errors)}`)
  }

  return result
}

function getStarlightConfig(ast: File) {
  let starlightConfig: ObjectExpression | undefined

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      if (!isCallExpression(path.node.declaration)) {
        throw new Error(
          'The default export of the Astro configuration file must be a call to the `defineConfig` function.',
        )
      }

      const astroConfig = path.node.declaration.arguments[0]

      if (!isObjectExpression(astroConfig)) {
        throw new Error(
          'The first argument of the `defineConfig` function must be an object containing the Astro configuration.',
        )
      }

      const astroIntegrations = astroConfig.properties.find(
        (property) =>
          isObjectProperty(property) &&
          ((isIdentifier(property.key) && property.key.name === 'integrations') ||
            (isStringLiteral(property.key) && property.key.value === 'integrations')),
      )

      if (!astroIntegrations || !isObjectProperty(astroIntegrations) || !isArrayExpression(astroIntegrations.value)) {
        throw new Error('The Astro configuration must contain an `integrations` property that must be an array.')
      }

      const starlightIntegration = astroIntegrations.value.elements.find(
        (element) => isCallExpression(element) && isIdentifier(element.callee) && element.callee.name === 'starlight',
      )

      if (!starlightIntegration || !isCallExpression(starlightIntegration)) {
        throw new Error('Failed to find the `starlight` integration in the Astro configuration.')
      }

      const config = starlightIntegration.arguments[0]

      if (!isObjectExpression(config)) {
        throw new Error(
          'The first argument of the `starlight` integration must be an object containing the Starlight configuration.',
        )
      }

      starlightConfig = config
    },
  })

  if (!starlightConfig) {
    throw new Error('Failed to find Starlight configuration in the Astro configuration file.')
  }

  return starlightConfig
}

async function getStarlightLocalesConfig(ast: File, starlightConfig: ObjectExpression, readJSON: JSONReader) {
  const localesProperty = starlightConfig.properties.find(
    (property) =>
      isObjectProperty(property) &&
      ((isIdentifier(property.key) && property.key.name === 'locales') ||
        (isStringLiteral(property.key) && property.key.value === 'locales')),
  )

  if (
    !localesProperty ||
    !isObjectProperty(localesProperty) ||
    (!isObjectExpression(localesProperty.value) && !isIdentifier(localesProperty.value))
  ) {
    throw new Error('Failed to find locales in Starlight configuration.')
  }

  const localesObjectExpression = isIdentifier(localesProperty.value)
    ? await getObjectExpressionFromIdentifier(ast, localesProperty.value, readJSON)
    : localesProperty.value

  if (!localesObjectExpression) {
    throw new Error('Failed to find valid locales configuration in Starlight configuration.')
  }

  const localesConfig: LocalesConfig['locales'] = {}

  for (const property of localesObjectExpression.properties) {
    if (!isObjectProperty(property)) {
      continue
    }

    const name = getObjectPropertyName(property)

    if (!name || !isObjectExpression(property.value)) {
      continue
    }

    const localeConfig: Record<string, string> = {}

    for (const localeProperty of property.value.properties) {
      if (!isObjectProperty(localeProperty)) {
        continue
      }

      const localePropertyName = getObjectPropertyName(localeProperty)

      if (!localePropertyName || !isStringLiteral(localeProperty.value)) {
        continue
      }

      localeConfig[localePropertyName] = localeProperty.value.value
    }

    if (isLocaleObject(localeConfig)) {
      localesConfig[name] = localeConfig
    }
  }

  return localesConfig
}

function getStarlightDefaultLocaleConfig(starlightConfig: ObjectExpression) {
  const defaultLocale = starlightConfig.properties.find(
    (property) =>
      isObjectProperty(property) &&
      ((isIdentifier(property.key) && property.key.name === 'defaultLocale') ||
        (isStringLiteral(property.key) && property.key.value === 'defaultLocale')),
  )

  return defaultLocale && isObjectProperty(defaultLocale) && isStringLiteral(defaultLocale.value)
    ? defaultLocale.value.value
    : undefined
}

async function getObjectExpressionFromIdentifier(ast: File, identifier: Identifier, readJSON: JSONReader) {
  let objectExpression: ObjectExpression | undefined

  for (const bodyNode of ast.program.body) {
    const variableDeclaration = isVariableDeclaration(bodyNode)
      ? bodyNode
      : isExportNamedDeclaration(bodyNode) && isVariableDeclaration(bodyNode.declaration)
      ? bodyNode.declaration
      : undefined

    if (isImportDeclaration(bodyNode)) {
      const jsonObjectExpression = await tryGetObjectExpressionFromJSONImport(readJSON, identifier, bodyNode)

      if (jsonObjectExpression) {
        return jsonObjectExpression
      }
    }

    if (!variableDeclaration) {
      continue
    }

    for (const declaration of variableDeclaration.declarations) {
      if (
        isIdentifier(declaration.id) &&
        declaration.id.name === identifier.name &&
        isObjectExpression(declaration.init)
      ) {
        objectExpression = declaration.init
      }
    }
  }

  return objectExpression
}

function isLocaleObject(obj: unknown): obj is Locale {
  return typeof obj === 'object' && obj !== null && typeof (obj as Locale).label === 'string'
}

function getObjectPropertyName(property: ObjectProperty) {
  return isIdentifier(property.key) ? property.key.name : isStringLiteral(property.key) ? property.key.value : undefined
}

async function tryGetObjectExpressionFromJSONImport(
  readJSON: JSONReader,
  identifier: Identifier,
  importDeclaration: ImportDeclaration,
) {
  const identifierDefaultSPecifier = importDeclaration.specifiers.find(
    (specifier) => isImportDefaultSpecifier(specifier) && specifier.local.name === identifier.name,
  )

  if (!identifierDefaultSPecifier) {
    return
  }

  const source = importDeclaration.source.value

  if (!source.endsWith('.json') || !source.startsWith('.')) {
    return
  }

  const jsonStr = await readJSON(source)

  if (jsonStr.trim().length === 0) {
    throw new Error('The imported JSON locales configuration is empty.')
  }

  try {
    const jsonAST = parse(`export default ${jsonStr}`, { sourceType: 'unambiguous', plugins: ['typescript'] })

    if (jsonAST.errors.length > 0) {
      throw new Error(`The imported JSON locales configuration contains errors.`)
    }

    if (
      jsonAST.program.body.length !== 1 ||
      !isExportDefaultDeclaration(jsonAST.program.body[0]) ||
      !isObjectExpression(jsonAST.program.body[0].declaration)
    ) {
      return
    }

    return jsonAST.program.body[0].declaration
  } catch (error) {
    throw new Error('Failed to parse imported JSON locales configuration.', { cause: error })
  }
}

type JSONReader = (relativePath: string) => Promise<string>
