import type { Uri } from 'vscode'

import type { Commit, Repository } from '../vscode.git'

import { getGitExtension } from './vsc'

// https://github.com/withastro/starlight/blob/def71050fbdb9ae514b0a7c24ed2455f055fe6bd/docs-i18n-tracker/lib/translation-status/builder.ts#L13
const ignoredCommitPattern = /(en-only|typo|broken link|i18nready|i18nignore)/i

export async function getFileChanges(file: Uri): Promise<GitFileChanges> {
  const repo = await getRepository()
  const commits = await repo.log({ path: file.fsPath })
  const lastCommit = commits[0]

  if (!lastCommit) {
    throw new Error(`Failed to find the last commit for the file at '${file.fsPath}'.`)
  }

  const previousCommit = commits.find((commit) => !ignoredCommitPattern.test(commit.message)) ?? lastCommit

  if (!lastCommit.commitDate || !previousCommit.commitDate) {
    throw new Error(`Failed to find commit dates for the file at '${file.fsPath}'.`)
  }

  return {
    last: {
      date: lastCommit.commitDate,
      ref: lastCommit.hash,
    },
    previous: {
      date: previousCommit.commitDate,
      ref: previousCommit.hash,
    },
  }
}

export async function getGitUri(file: Uri, ref: string) {
  const git = await getGitExtension()

  return git.toGitUri(file, ref)
}

export async function getCommitBeforeDate(file: Uri, date: Date) {
  const repo = await getRepository()
  const commits = await repo.log({ path: file.fsPath })

  let currentCommit: Commit | undefined

  for (const commit of commits) {
    if (!commit.commitDate) {
      continue
    }

    currentCommit = commit

    if (commit.commitDate < date) {
      break
    }
  }

  return currentCommit
}

async function getRepository(): Promise<Repository> {
  const git = await getGitExtension()
  const repo = git.repositories[0]

  if (git.repositories.length === 1 && repo) {
    return repo
  }

  throw new Error('Failed to find a unique git repository.')
}

export interface GitFileChanges {
  last: GitFileChange
  previous: GitFileChange
}

interface GitFileChange {
  date: Date
  ref: string
}
