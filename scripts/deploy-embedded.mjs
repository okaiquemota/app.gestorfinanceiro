// Deploy alternativo: embute os arquivos do front dentro do próprio Worker.
//
// O deploy normal (`npm run deploy`) envia o front como "static assets" do
// Cloudflare, e esse envio usa um token próprio da sessão de upload. Em
// ambientes onde um proxy reescreve o cabeçalho Authorization (ex.: sessões
// de agente na nuvem), esse token se perde e o upload falha com 401.
// Este script evita essa etapa: gera um Worker que carrega os arquivos em
// base64 e os serve ele mesmo, e publica só pela API comum de scripts.
//
// Uso: npm run deploy:embedded [-- <opções extras do wrangler deploy>]

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const clientDir = join(root, 'dist/client')
const builtConfig = JSON.parse(readFileSync(join(root, 'dist/poupin/wrangler.json'), 'utf8'))
const outDir = join(root, 'dist/embedded')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const files = {}
let bytes = 0
for (const full of walk(clientDir)) {
  const path = '/' + relative(clientDir, full).split('\\').join('/')
  const type = TYPES[extname(full)]
  // arquivos de controle (.assetsignore, _headers) não são servidos
  if (!type || path.startsWith('/.') || path.startsWith('/_')) continue
  const data = readFileSync(full)
  bytes += data.length
  files[path] = [type, data.toString('base64')]
}
if (!files['/index.html']) throw new Error('dist/client/index.html não existe. Rode `npm run build` antes.')

const worker = `import api from '../poupin/index.js'

// caminho -> [content-type, conteúdo em base64]
const FILES = ${JSON.stringify(files)}

const decoded = new Map()
const body = (path) => {
  let buf = decoded.get(path)
  if (!buf) {
    const bin = atob(FILES[path][1])
    buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    decoded.set(path, buf)
  }
  return buf
}

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/')) return api.fetch(request, env, ctx)
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response('Method Not Allowed', { status: 405 })

    let path = pathname
    if (!FILES[path]) {
      // arquivo inexistente é 404; qualquer outra rota é do app (SPA)
      if (/\\.[a-z0-9]+$/i.test(path)) return new Response('Not Found', { status: 404 })
      path = '/index.html'
    }
    const headers = {
      'Content-Type': FILES[path][0],
      'Cache-Control': path.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable' // nome com hash: nunca muda
        : path === '/index.html'
          ? 'no-cache'
          : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    }
    return new Response(request.method === 'HEAD' ? null : body(path), { headers })
  },
}
`

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'index.js'), worker)
writeFileSync(
  join(outDir, 'wrangler.json'),
  JSON.stringify(
    {
      name: builtConfig.name,
      main: 'index.js',
      compatibility_date: builtConfig.compatibility_date,
      compatibility_flags: builtConfig.compatibility_flags,
      workers_dev: builtConfig.workers_dev,
      preview_urls: builtConfig.preview_urls,
      d1_databases: builtConfig.d1_databases,
      observability: builtConfig.observability,
      vars: builtConfig.vars,
    },
    null,
    2,
  ),
)
console.log(`${Object.keys(files).length} arquivos embutidos (${(bytes / 1024).toFixed(0)} KB)`)

const run = spawnSync(
  'npx',
  ['wrangler', 'deploy', '--config', join(outDir, 'wrangler.json'), ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
)
process.exit(run.status ?? 1)
