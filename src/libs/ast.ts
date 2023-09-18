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
} from '@babel/types'

import type { Locale, LocalesConfig } from './config'

export function getStarlightLocalesConfigFromCode(code: string) {
  const ast = parseCode(code)
  const starlightConfig = getStarlightConfig(ast)

  const locales = getStarlightLocalesConfig(ast, starlightConfig)
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

function getStarlightLocalesConfig(ast: File, starlightConfig: ObjectExpression) {
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
    ? getObjectExpressionFromIdentifier(ast, localesProperty.value)
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

function getObjectExpressionFromIdentifier(ast: File, identifier: Identifier) {
  let objectExpression: ObjectExpression | undefined

  for (const bodyNode of ast.program.body) {
    const variableDeclaration = isVariableDeclaration(bodyNode)
      ? bodyNode
      : isExportNamedDeclaration(bodyNode) && isVariableDeclaration(bodyNode.declaration)
      ? bodyNode.declaration
      : undefined

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
