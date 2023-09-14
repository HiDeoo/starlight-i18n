import { commands, type ExtensionContext, window, workspace, ViewColumn, Uri } from 'vscode'

import { getStarlightLocalesConfig, getStarlightUris, type Locale, type StarlightUris } from './libs/config'
import { getContentPagesStatuses, type PageStatus, type PageStatusesByLocale } from './libs/content'
import { getCommitBeforeDate, getGitUri } from './libs/git'
import { createStatusesQuickPickItem, isStatusQuickPickItem, isWorkspaceWithSingleFolder } from './libs/vsc'

// TODO(HiDeoo) extension dependencies: vscode.git and vscode.diff

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand('starlight-i18n.start', async () => {
      // TODO(HiDeoo) activity indicator

      try {
        if (!isWorkspaceWithSingleFolder(workspace.workspaceFolders)) {
          throw new Error('Starlight i18n only supports single folder workspaces.')
        }

        const starlightUris = await getStarlightUris(
          workspace.workspaceFolders[0],
          workspace.getConfiguration('starlight-i18n').get<string[]>('configDirectories') ?? ['.'],
        )

        if (!starlightUris) {
          throw new Error('Failed to find a Starlight instance in the current workspace.')
        }

        const localesConfig = await getStarlightLocalesConfig(starlightUris.config)

        const statuses = await getContentPagesStatuses(starlightUris, localesConfig)
        const translation = await pickTranslation(statuses)

        if (!translation) {
          return
        }

        await prepareTranslation(translation, starlightUris)
      } catch (error) {
        await window.showErrorMessage(error instanceof Error ? error.message : 'Something went wrong!')
      }
    }),
  )
}

async function pickTranslation(statuses: PageStatusesByLocale): Promise<Translation | undefined> {
  const locale = await window.showQuickPick(
    Object.entries(statuses).map(([localeDirectory, { locale, statuses }]) => ({
      description: locale.lang ?? localeDirectory,
      label: locale.label,
      locale,
      localeDirectory,
      statuses,
    })),
    { ignoreFocusOut: true, placeHolder: 'Select a locale to translate' },
  )

  if (!locale) {
    return
  }

  const missing: PageStatus[] = []
  const outdated: PageStatus[] = []

  for (const status of locale.statuses) {
    if (status.missing) {
      missing.push(status)
    } else if (status.outdated) {
      outdated.push(status)
    }
  }

  const done = missing.length === 0 && outdated.length === 0

  if (done) {
    await window.showInformationMessage(`Nothing left to translate in ${locale.label}  🎉`, { modal: true })
    return
  }

  const page = await window.showQuickPick(
    [
      ...createStatusesQuickPickItem(outdated, 'Outdated', 'extensions-sync-enabled'),
      ...createStatusesQuickPickItem(missing, 'Missing', 'diff-insert'),
    ],
    { ignoreFocusOut: true, placeHolder: 'Select a page to translate' },
  )

  if (!page || !isStatusQuickPickItem(page)) {
    return
  }

  return { locale: locale.locale, localeDirectory: locale.localeDirectory, status: page.status }
}

function prepareTranslation(translation: Translation, uris: StarlightUris) {
  return translation.status.missing
    ? prepareMissingTranslation(translation, uris)
    : prepareOutdatedTranslation(translation)
}

async function prepareMissingTranslation({ localeDirectory, status }: Translation, uris: StarlightUris) {
  await window.showTextDocument(status.source.file, { viewColumn: ViewColumn.One })

  const translationUri = Uri.joinPath(uris.content, localeDirectory, status.source.id)

  await workspace.fs.writeFile(translationUri, new Uint8Array(0))
  await window.showTextDocument(translationUri, { preview: false, viewColumn: ViewColumn.Two })

  // TODO(HiDeoo) add frontmatter to the translation file
}

async function prepareOutdatedTranslation({ status }: Translation) {
  if (!status.page) {
    throw new Error('Missing page reference to prepare outdated translation.')
  }

  const referenceCommit = await getCommitBeforeDate(status.source.file, status.page.changes.last.date)

  if (!referenceCommit) {
    throw new Error(`Failed to find the reference commit to translate '${status.source.id}'.`)
  }

  const lastGitUri = await getGitUri(status.source.file, status.source.changes.last.ref)
  const referenceGitUri = await getGitUri(status.source.file, referenceCommit.hash)

  await commands.executeCommand('vscode.diff', referenceGitUri, lastGitUri, undefined, { viewColumn: ViewColumn.One })
  await window.showTextDocument(status.page.file, { preview: false, viewColumn: ViewColumn.Two })
}

interface Translation {
  locale: Locale
  localeDirectory: string
  status: PageStatus
}
