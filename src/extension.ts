import { commands, type ExtensionContext, window, workspace } from 'vscode'

import { getStarlightLocalesConfig, getStarlightUris } from './libs/config'
import { getContentPagesStatuses } from './libs/content'
import { pickTranslation, prepareTranslation } from './libs/translation'
import { isWorkspaceWithSingleFolder } from './libs/vsc'

// TODO(HiDeoo) extension dependencies: vscode.git and vscode.diff

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand('starlight-i18n.start', async () => {
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

        const translation = await pickTranslation(async () => {
          const localesConfig = await getStarlightLocalesConfig(starlightUris.config)

          return getContentPagesStatuses(starlightUris, localesConfig)
        })

        if (!translation) {
          return
        }

        await prepareTranslation(starlightUris, translation)
      } catch (error) {
        const isError = error instanceof Error
        const message = isError ? error.message : 'Something went wrong!'

        const logger = window.createOutputChannel('Starlight i18n')
        logger.appendLine(message)

        if (isError && error.stack) {
          logger.appendLine(error.stack)
        }

        await window.showErrorMessage(message)
      }
    }),
  )
}
