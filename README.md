<div align="center">
  <img alt="Starlight i18n extension icon" src="https://i.imgur.com/0PE6Nbo.png" width="128" />
  <h1>Starlight i18n</h1>
</div>

<div align="center">
  <p><strong>Easily translate Starlight documentation pages.</strong></p>
  <p>
    <a href="https://github.com/HiDeoo/starlight-i18n/actions/workflows/integration.yml">
      <img alt="Integration Status" src="https://github.com/HiDeoo/starlight-i18n/actions/workflows/integration.yml/badge.svg" />
    </a>
    <a href="https://github.com/HiDeoo/starlight-i18n/blob/main/LICENSE">
      <img alt="License" src="https://badgen.net/github/license/HiDeoo/starlight-i18n" />
    </a>
  </p>
  <p>
    // TODO(HiDeoo)
    <a href="https://i.imgur.com/9IvyqoS.gif" title="Demo of the Create extension using fuzzy matching">
      <img alt="Demo of the Create extension using fuzzy matching" src="https://i.imgur.com/9IvyqoS.gif" width="675" />
    </a>
  </p>
  <p>
    // TODO(HiDeoo)
    <a href="https://i.imgur.com/7OnFzbj.gif" title="Demo of the Create extension using terminal-style autocomplete">
      <img alt="Demo of the Create extension using terminal-style autocomplete" src="https://i.imgur.com/7OnFzbj.gif" width="675" />
    </a>
  </p>
</div>

## Features

Visual Studio Code extension to easily translate Starlight documentation pages using the built-in [support for multilingual sites](https://starlight.astro.build/guides/i18n/) and [git](https://git-scm.com/).

- Collect supported languages from a Starlight configuration in a workspace repo or monorepo.
- Pick a language and a page to translate.
- Open side-by-side editors with the missing changes and the translated page for out-of-date pages.
- Open side-by-side editors with the source page and a newly created page for missing translated pages.
- Configurable Starlight configuration directories.

## Usage

1. Open the Visual Studio Code [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette) (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
2. Run the `Starlight i18n` command

## Configuration

By default, the Starlight i18n extension will look for a Starlight configuration in an [Astro configuration file](https://docs.astro.build/en/guides/configuring-astro/#supported-config-file-types) located either at the root of the workspace or in a `docs` subdirectory.

You can customize the directories where the extension will look for a Starlight configuration in your Visual Studio Code [User](https://code.visualstudio.com/docs/getstarted/settings#_settings-editor) or [Workspace](https://code.visualstudio.com/docs/getstarted/settings#_workspace-settings) settings.

```json
{
  "starlight-i18n.configDirectories": [".", "./docs", "./app", "./packages/docs"]
}
```

## More extensions

- [Toggler](https://marketplace.visualstudio.com/items?itemName=hideoo.toggler) - Toggle words and symbols.
- [Create](https://marketplace.visualstudio.com/items?itemName=hideoo.create) - Quickly create new File(s) & Folder(s).
- [Trailing](https://marketplace.visualstudio.com/items?itemName=hideoo.trailing) - Toggle trailing symbols: commas, semicolons and colons.

## License

Licensed under the MIT License, Copyright © HiDeoo.

See [LICENSE](https://github.com/HiDeoo/starlight-i18n/blob/main/LICENSE) for more information.
