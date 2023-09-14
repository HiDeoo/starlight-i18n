import { extensions, type WorkspaceFolder } from 'vscode'

import type { API as GitAPI, GitExtension } from '../vscode.git'

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
