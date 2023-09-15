import {
  commands,
  type Disposable,
  type QuickPick,
  type QuickPickItem,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
  ViewColumn,
  window,
  workspace,
} from 'vscode'

import type { Locale, StarlightUris } from './config'
import { getPageRawFrontmatter, type PageStatus, type PageStatusesByLocale } from './content'
import { getCommitBeforeDate, getGitUri } from './git'

export async function pickTranslation(
  getStatuses: () => Promise<PageStatusesByLocale>,
): Promise<Translation | undefined> {
  const disposables: Disposable[] = []

  const picker: TranslationPicker = window.createQuickPick()
  picker.title = 'Starlight i18n'
  picker.enabled = false
  picker.busy = true
  picker.ignoreFocusOut = true
  picker.placeholder = 'Collecting page translations status…'
  picker.step = 1
  picker.totalSteps = 2

  try {
    // eslint-disable-next-line no-async-promise-executor
    return await new Promise(async (resolve, reject) => {
      function closePicker() {
        resolve(undefined)
      }

      disposables.push(
        picker.onDidAccept(() => {
          const item = picker.selectedItems[0]

          if (isLocaleQuickPickItem(item)) {
            onPickLocale(picker, item, async () => {
              closePicker()
              await window.showInformationMessage(`Nothing left to translate in ${item.label}  🎉`, {
                modal: true,
              })
            })
          } else if (isStatusQuickPickItem(item)) {
            resolve({ locale: item.locale, localeDirectory: item.localeDirectory, status: item.status })
          } else {
            closePicker()
          }
        }),
      )

      picker.show()

      try {
        const statuses = await getStatuses()

        picker.items = Object.entries(statuses).map(([localeDirectory, { locale, statuses }]) => ({
          description: locale.lang ?? localeDirectory,
          label: locale.label,
          locale,
          localeDirectory,
          statuses,
        }))
      } catch (error) {
        reject(error)
        return
      }

      picker.busy = false
      picker.enabled = true
      picker.placeholder = 'Select a locale to translate'
    })
  } finally {
    picker.dispose()

    for (const disposable of disposables) {
      disposable.dispose()
    }
  }
}

export function prepareTranslation(uris: StarlightUris, translation: Translation) {
  return translation.status.missing
    ? prepareMissingTranslation(translation, uris)
    : prepareOutdatedTranslation(translation)
}

function onPickLocale(picker: TranslationPicker, localeItem: LocaleQuickPickItem, closePicker: () => void) {
  const missing: PageStatus[] = []
  const outdated: PageStatus[] = []

  for (const status of localeItem.statuses) {
    if (status.missing) {
      missing.push(status)
    } else if (status.outdated) {
      outdated.push(status)
    }
  }

  const done = missing.length === 0 && outdated.length === 0

  if (done) {
    closePicker()
    return
  }

  picker.items = [
    ...createStatusesQuickPickItem(outdated, localeItem, 'Outdated', 'extensions-sync-enabled'),
    ...createStatusesQuickPickItem(missing, localeItem, 'Missing', 'diff-insert'),
  ]

  picker.placeholder = 'Select a page to translate'
  picker.step = 2
}

function createStatusesQuickPickItem(
  statuses: PageStatus[],
  locale: LocaleQuickPickItem,
  label: string,
  icon: string,
): (StatusQuickPickItem | SeparatorQuickPickItem)[] {
  return [
    ...(statuses.length > 0 ? [{ kind: QuickPickItemKind.Separator, label } as SeparatorQuickPickItem] : []),
    ...statuses.map((status) => ({
      ...locale,
      iconPath: new ThemeIcon(icon),
      label: status.source.id,
      status,
    })),
  ]
}

async function prepareMissingTranslation({ localeDirectory, status }: Translation, uris: StarlightUris) {
  const sourceFrontmatter = await getPageRawFrontmatter(status.source.file)
  const translationUri = Uri.joinPath(uris.content, localeDirectory, status.source.id)

  await workspace.fs.writeFile(translationUri, new TextEncoder().encode(`${sourceFrontmatter}\n\n`))

  await window.showTextDocument(status.source.file, { viewColumn: ViewColumn.One })
  await window.showTextDocument(translationUri, { preview: false, viewColumn: ViewColumn.Two })
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

function isLocaleQuickPickItem(item: unknown): item is LocaleQuickPickItem {
  return typeof item === 'object' && item !== null && 'locale' in item && !('status' in item)
}

function isStatusQuickPickItem(item: unknown): item is StatusQuickPickItem {
  return typeof item === 'object' && item !== null && 'status' in item
}

interface Translation {
  locale: Locale
  localeDirectory: string
  status: PageStatus
}

interface LocaleQuickPickItem extends QuickPickItem {
  locale: Locale
  localeDirectory: string
  statuses: PageStatus[]
}

interface StatusQuickPickItem extends LocaleQuickPickItem {
  status: PageStatus
}

interface SeparatorQuickPickItem extends QuickPickItem {
  kind: QuickPickItemKind.Separator
}

type TranslationPickerItem = LocaleQuickPickItem | StatusQuickPickItem | SeparatorQuickPickItem
type TranslationPicker = QuickPick<TranslationPickerItem>
