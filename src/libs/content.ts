import { relative } from 'node:path'

import { type Uri, workspace } from 'vscode'

import type { Locale, LocalesConfig, StarlightUris } from './config'
import { getFileChanges, type GitFileChanges } from './git'

// https://github.com/withastro/astro/blob/c23ddb9ab31c34633b3a0f163fd4c24c852073de/packages/astro/src/core/constants.ts#L5
// https://github.com/withastro/astro/blob/c23ddb9ab31c34633b3a0f163fd4c24c852073de/packages/astro/src/core/errors/dev/vite.ts#L126
const contentExtensions = ['md', 'mdx', 'mdoc', 'markdown', 'mdown', 'mkdn', 'mkd', 'mdwn']

export async function getContentPagesStatuses(uris: StarlightUris, localesConfig: LocalesConfig) {
  const pages = await getContentPagesByLocale(uris, localesConfig)
  const defaultLocalePages = pages[localesConfig.defaultLocale]

  if (!defaultLocalePages) {
    throw new Error('Failed to find content pages matching the default locale.')
  }

  const statuses: PageStatusesByLocale = {}

  for (const [localeDirectory, locale] of Object.entries(localesConfig.locales)) {
    if (localeDirectory === 'root' || localeDirectory === localesConfig.defaultLocale) {
      continue
    }

    statuses[localeDirectory] = { locale, statuses: [] }

    for (const [id, page] of Object.entries(defaultLocalePages)) {
      const translatedPage = pages[localeDirectory]?.[id]
      statuses[localeDirectory]?.statuses.push({
        missing: !translatedPage,
        outdated: translatedPage !== undefined && page.changes.previous.date > translatedPage.changes.previous.date,
        page: translatedPage,
        source: page,
      })
    }
  }

  return statuses
}

async function getContentPagesByLocale(uris: StarlightUris, localesConfig: LocalesConfig) {
  const pages = await getContentPages(uris, localesConfig)
  const pagesByLocale: Record<string, Record<Page['id'], Page>> = {}

  for (const page of pages) {
    const localeDirectory = page.localeDirectory ?? localesConfig.defaultLocale
    const localePages = pagesByLocale[localeDirectory] ?? {}

    localePages[page.id] = page
    pagesByLocale[localeDirectory] = localePages
  }

  return pagesByLocale
}

async function getContentPages(uris: StarlightUris, localesConfig: LocalesConfig): Promise<Page[]> {
  const files = await workspace.findFiles(
    `${relative(uris.workspace.fsPath, uris.content.fsPath)}/**/*.{${contentExtensions.join(',')}}`,
    null,
  )

  const allLocales = Object.entries(localesConfig.locales)

  return Promise.all(
    files.map(async (file) => {
      const relativePath = relative(uris.content.fsPath, file.fsPath)
      const [localeDirectory, ...localeId] = relativePath.split('/')
      const localeEntry = allLocales.find(([directory]) => directory === localeDirectory)
      const changes = await getFileChanges(file)

      return {
        changes,
        file,
        id: localeEntry ? localeId.join('/') : relativePath,
        locale: localeEntry ? localeEntry[1] : undefined,
        localeDirectory: localeEntry ? localeDirectory : undefined,
      }
    }),
  )
}

interface Page {
  changes: GitFileChanges
  file: Uri
  id: string
  locale: Locale | undefined
  localeDirectory: string | undefined
}

export interface PageStatus {
  missing: boolean
  outdated: boolean
  page: Page | undefined
  source: Page
}

export type PageStatusesByLocale = Record<
  string,
  {
    locale: Locale
    statuses: PageStatus[]
  }
>
