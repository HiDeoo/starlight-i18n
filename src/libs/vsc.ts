import { extensions, QuickPickItemKind, ThemeIcon, type WorkspaceFolder } from 'vscode'

import type { API as GitAPI, GitExtension } from '../vscode.git'

import type { PageStatus } from './content'

let gitAPI: GitAPI | undefined

export function isWorkspaceWithSingleFolder(
  workspaceFolders: readonly WorkspaceFolder[] | undefined,
): workspaceFolders is readonly [WorkspaceFolder] {
  return workspaceFolders !== undefined && workspaceFolders.length === 1
}

export async function getGitExtension(): Promise<GitAPI> {
  if (gitAPI) {
    return gitAPI
  }

  const extension = extensions.getExtension<GitExtension>('vscode.git')

  if (!extension) {
    throw new Error('Unable to load Git extension.')
  }

  const gitExtension = extension.isActive ? extension.exports : await extension.activate()
  gitAPI = gitExtension.getAPI(1)

  return gitAPI
}

export function createStatusesQuickPickItem(statuses: PageStatus[], label: string, icon: string) {
  return [
    ...(statuses.length > 0 ? [{ kind: QuickPickItemKind.Separator, label }] : []),
    ...statuses.map((status) => ({
      iconPath: new ThemeIcon(icon),
      label: status.source.id,
      status,
    })),
  ]
}

export function isStatusQuickPickItem(item: unknown): item is { status: PageStatus } {
  return typeof item === 'object' && item !== null && 'status' in item
}
