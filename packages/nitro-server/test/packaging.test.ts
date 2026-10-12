import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import process from 'node:process'
import { join } from 'pathe'
import { describe, expect, it, onTestFinished } from 'vitest'
import { build } from 'tsdown'
import config from '../tsdown.config.ts'

const exec = promisify(execFile)
const packageDir = fileURLToPath(new URL('..', import.meta.url))

describe('server builder packaging', () => {
  it.each([true, false])('keeps virtual runtime imports out of the builder (codeSplitting: %s)', async (codeSplitting) => {
    const outDir = mkdtempSync(join(packageDir, '.packaging-test-'))
    onTestFinished(() => rmSync(outDir, { recursive: true, force: true }))
    await build({
      ...config[0],
      config: false,
      entry: codeSplitting ? config[0]!.entry : ['src/index.ts'],
      cwd: packageDir,
      outDir,
      dts: false,
      exports: false,
      logLevel: 'silent',
      outputOptions: { codeSplitting },
    })

    const chunks = readdirSync(outDir).filter(file => file.endsWith('.mjs'))
    for (const file of chunks) {
      const code = readFileSync(join(outDir, file), 'utf8')
      expect(code).not.toMatch(/(?:from\s*|import\s*)["']nitro\/(?:app|context)["']/)
    }
    await build({
      ...config[1],
      config: false,
      cwd: packageDir,
      outDir: join(outDir, 'runtime'),
      dts: false,
      exports: false,
      logLevel: 'silent',
    })

    // A fresh process exercises native ESM evaluation rather than Vitest's mocked imports.
    const entry = join(outDir, 'index.mjs')
    const rootDir = join(outDir, 'fixture')
    mkdirSync(join(rootDir, 'app'), { recursive: true })
    writeFileSync(join(rootDir, 'app/app.vue'), '<template><div>packaging regression</div></template>')
    const script = `
      const { loadNuxt } = await import('nuxt');
      const nuxt = await loadNuxt({ rootDir: ${JSON.stringify(rootDir)}, ready: false,
        overrides: { dev: true, server: { builder: ${JSON.stringify(entry)} },
          devtools: { enabled: false }, telemetry: false, compatibilityDate: '2026-09-03',
          routeRules: { '/_legacy/deep': { headers: { 'x-legacy': 'yes' } } },
          devServerHandlers: [{ route: '/_legacy', handler: event => event.context._nitro.routeRules }] } });
      try {
        if (nuxt.options.server.builder !== ${JSON.stringify(entry)}) throw new Error('Wrong server builder');
        await nuxt.ready();
        const { mockEvent } = await import('nitro/h3');
        const rules = await nuxt.options.devServerHandlers[0].handler(mockEvent('http://nuxt/_legacy/deep'));
        if (rules.headers?.['x-legacy'] !== 'yes') throw new Error('Legacy route rules were lost');
      } finally { await nuxt.close(); }
    `
    const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', script], { cwd: packageDir, timeout: 30_000 })
    expect(stdout + stderr).not.toContain('Nitro runtime imports detected')
  }, 60_000)
})
