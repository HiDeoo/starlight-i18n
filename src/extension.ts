import { commands, type ExtensionContext, Uri, window, workspace } from 'vscode'

import { getStarlightLocalesConfig, getStarlightUris } from './libs/config'
import { getContentPagesStatuses } from './libs/content'
import { StarlightI18nParseError } from './libs/error'
import { pickTranslation, prepareTranslation } from './libs/translation'
import { isWorkspaceWithSingleFolder } from './libs/vsc'

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
        const isParseError = error instanceof StarlightI18nParseError
        const message = isParseError || isError ? error.message : 'Something went wrong!'

        const logger = window.createOutputChannel('Starlight i18n')
        logger.appendLine(message)

        if (isError && error.stack) {
          logger.appendLine(error.stack)
        }

        if ((isError || isParseError) && error.cause) {
          const cause = error.cause
          const isCauseError = cause instanceof Error
          logger.appendLine(isCauseError ? cause.message : String(cause))
          if (isCauseError && cause.stack) logger.appendLine(cause.stack)
        }

        if (isParseError) {
          const reportLabel = 'Report on GitHub'

          const selection = await window.showErrorMessage(
            message,
            {
              detail:
                'This error is likely due to an unexpected Starlight configuration format. Please consider reporting it so we can improve compatibility.',
              modal: true,
            },
            reportLabel,
          )
          if (selection !== reportLabel) return

          await commands.executeCommand(
            'vscode.open',
            Uri.parse('https://github.com/HiDeoo/starlight-i18n/issues/new?template=0_bug_report.yml'),
          )
          return
        }

        await window.showErrorMessage(message)
      }
    }),
  )
}
