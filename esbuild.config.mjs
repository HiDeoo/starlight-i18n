import esbuild from 'esbuild'

const args = process.argv.slice(2)
const dev = args.includes('--dev')

esbuild.buildSync({
  bundle: true,
  entryPoints: ['./src/extension.ts'],
  external: ['vscode'],
  format: 'cjs',
  minify: !dev,
  outfile: 'dist/extension.js',
  platform: 'node',
  sourcemap: dev,
})
