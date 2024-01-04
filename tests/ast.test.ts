import { expect, test, vi } from 'vitest'

import { getStarlightLocalesConfigFromCode } from '../src/libs/ast'

const commonLocales = `{
  root: { label: 'English', lang: 'en' },
  ja: { label: '日本語', lang: 'ja' },
  fr: { label: 'Français', lang: 'fr' },
  'pt-br': { label: 'Português do Brasil', lang: 'pt-BR' },
}`

const expectedCommonLocales = {
  fr: {
    label: 'Français',
    lang: 'fr',
  },
  ja: {
    label: '日本語',
    lang: 'ja',
  },
  'pt-br': {
    label: 'Português do Brasil',
    lang: 'pt-BR',
  },
}

test('finds locales inlined in the configuration', async () => {
  const config = await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales: ${commonLocales},
    }),
  ],
});`)

  expect(config.defaultLocale).toBe('en')
  expect(config.locales).toEqual(expectedCommonLocales)
})

test('finds locales referenced in the configuration', async () => {
  const config = await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const locales = ${commonLocales}

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`)

  expect(config.defaultLocale).toBe('en')
  expect(config.locales).toEqual(expectedCommonLocales)
})

test('finds locales referenced and exported in the configuration', async () => {
  const config = await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export const locales = ${commonLocales}

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`)

  expect(config.defaultLocale).toBe('en')
  expect(config.locales).toEqual(expectedCommonLocales)
})

test('throws with no locales configuration', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
    }),
  ],
});`),
  ).rejects.toThrowError('Failed to find locales in Starlight configuration.')
})

test('throws with no locales to translate', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
    }),
  ],
});`),
  ).rejects.toThrowError('Failed to find any Starlight locale to translate.')
})

test('throws with no locales to translate when using the `defaultLocale` property', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
      },
    }),
  ],
});`),
  ).rejects.toThrowError('Failed to find any Starlight locale to translate.')
})

test('throws with no default locale', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales: {
        en: { label: 'English', lang: 'en' },
        ja: { label: '日本語', lang: 'ja' },
      },
    }),
  ],
});`),
  ).rejects.toThrowError('Failed to find Starlight default locale.')
})

test('throws with no starlight integration', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [],
});`),
  ).rejects.toThrowError('Failed to find the `starlight` integration in the Astro configuration.')
})

test('finds locales imported from a relative JSON file', async () => {
  expect.assertions(3)

  const config = await getStarlightLocalesTestConfigFromCode(
    `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import locales from './locales.json';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`,
    (relativePath) => {
      expect(relativePath).toBe('./locales.json')

      return Promise.resolve(commonLocales)
    },
  )

  expect(config.defaultLocale).toBe('en')
  expect(config.locales).toEqual(expectedCommonLocales)
})

test('throws with empty imported JSON locales configuration', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(
        `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import locales from './locales.json';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`,
        () => Promise.resolve(''),
      ),
  ).rejects.toThrowError('The imported JSON locales configuration is empty.')
})

test('throws with invalid imported JSON locales configuration', async () => {
  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(
        `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import locales from './locales.json';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`,
        () => Promise.resolve('-'),
      ),
  ).rejects.toThrowError('Failed to parse imported JSON locales configuration.')
})

test('does not read non JSON locales configuration', async () => {
  const readJSONSpy = vi.fn()

  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(
        `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import locales from './locales.js';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`,
        readJSONSpy,
      ),
  ).rejects.toThrowError('Failed to find valid locales configuration in Starlight configuration.')

  expect(readJSONSpy).not.toHaveBeenCalled()
})

test('does not read non relative JSON locales configuration', async () => {
  const readJSONSpy = vi.fn()

  await expect(
    async () =>
      await getStarlightLocalesTestConfigFromCode(
        `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import locales from 'pkg/locales.json';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
      locales,
    }),
  ],
});`,
        readJSONSpy,
      ),
  ).rejects.toThrowError('Failed to find valid locales configuration in Starlight configuration.')

  expect(readJSONSpy).not.toHaveBeenCalled()
})

function getStarlightLocalesTestConfigFromCode(
  code: string,
  readJSON?: Parameters<typeof getStarlightLocalesConfigFromCode>[1],
) {
  return getStarlightLocalesConfigFromCode(code, readJSON ?? (() => Promise.resolve('test')))
}
