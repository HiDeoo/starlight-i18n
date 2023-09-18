import { expect, test } from 'vitest'

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

test('finds locales inlined in the configuration', () => {
  const config = getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
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

test('finds locales referenced in the configuration', () => {
  const config = getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
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

test('finds locales referenced and exported in the configuration', () => {
  const config = getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
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

test('throws with no locales configuration', () => {
  expect(() =>
    getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Starlight',
    }),
  ],
});`),
  ).toThrowError('Failed to find locales in Starlight configuration.')
})

test('throws with no locales to translate', () => {
  expect(() =>
    getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
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
  ).toThrowError('Failed to find any Starlight locale to translate.')
})

test('throws with no locales to translate when using the `defaultLocale` property', () => {
  expect(() =>
    getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
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
  ).toThrowError('Failed to find any Starlight locale to translate.')
})

test('throws with no default locale', () => {
  expect(() =>
    getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
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
  ).toThrowError('Failed to find Starlight default locale.')
})

test('throws with no starlight integration', () => {
  expect(() =>
    getStarlightLocalesConfigFromCode(`import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [],
});`),
  ).toThrowError('Failed to find the `starlight` integration in the Astro configuration.')
})
