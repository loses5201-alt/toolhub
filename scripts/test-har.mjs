/*
  HAR 分析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-har.mjs
  oracle:依 HAR 1.2 spec 手構小型 HAR + 已知大小/時間,交叉驗證彙整數字。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `har-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/har.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseHar, summarize, classifyType, extractHost, wallClockTime, formatBytes, formatMs } =
  await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}
function ok(note, cond) {
  eq(note, !!cond, true)
}

// --- classifyType ---
eq('mime html→document', classifyType('text/html; charset=utf-8', 'http://a/'), 'document')
eq('mime css→stylesheet', classifyType('text/css', 'http://a/x'), 'stylesheet')
eq('mime js→script', classifyType('application/javascript', 'http://a/x'), 'script')
eq('mime image→image', classifyType('image/png', 'http://a/x'), 'image')
eq('mime font→font', classifyType('font/woff2', 'http://a/x'), 'font')
eq('mime json→xhr', classifyType('application/json', 'http://a/x'), 'xhr')
eq('mime media→media', classifyType('video/mp4', 'http://a/x'), 'media')
eq('ext fallback js', classifyType('', 'http://a/app.min.js?v=1'), 'script')
eq('ext fallback woff2', classifyType('', 'http://a/font.woff2'), 'font')
eq('ext fallback png', classifyType('', 'http://a/pic.PNG'), 'image')
eq('unknown→other', classifyType('application/octet-stream', 'http://a/blob'), 'other')

// --- extractHost ---
eq('host basic', extractHost('https://www.example.com/path?q=1'), 'www.example.com')
eq('host with port', extractHost('http://localhost:8080/x'), 'localhost')
eq('host with userinfo', extractHost('https://user:pw@api.example.com/x'), 'api.example.com')
eq('host non-url', extractHost('not a url'), 'not a url')

// --- parseHar errors ---
eq('bad json fails', parseHar('{not json').ok, false)
eq('no log fails', parseHar('{}').ok, false)
eq('no entries fails', parseHar('{"log":{}}').ok, false)

// --- a constructed HAR ---
const har = {
  log: {
    version: '1.2',
    creator: { name: 'WebInspector', version: '537.36' },
    pages: [{ title: 'Example Page' }],
    entries: [
      {
        startedDateTime: '2026-06-20T00:00:00.000Z',
        time: 100,
        request: { method: 'GET', url: 'https://example.com/' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { size: 5000, mimeType: 'text/html' },
          headersSize: 200,
          bodySize: 1800,
        },
        timings: { blocked: 1, dns: 2, connect: 3, send: 1, wait: 80, receive: 13 },
      },
      {
        startedDateTime: '2026-06-20T00:00:00.050Z',
        time: 300,
        request: { method: 'GET', url: 'https://cdn.example.com/app.js' },
        response: {
          status: 200,
          content: { size: 90000, mimeType: 'application/javascript' },
          _transferSize: 30000,
          headersSize: 100,
          bodySize: 29900,
        },
        timings: { wait: 250, receive: 50 },
      },
      {
        startedDateTime: '2026-06-20T00:00:00.100Z',
        time: 500,
        request: { method: 'POST', url: 'https://api.example.com/data' },
        response: {
          status: 500,
          content: { size: 100, mimeType: 'application/json' },
          headersSize: 50,
          bodySize: 100,
        },
        timings: { wait: 480, receive: 20 },
      },
      {
        startedDateTime: '2026-06-20T00:00:00.200Z',
        time: 40,
        request: { method: 'GET', url: 'https://example.com/missing.png' },
        response: {
          status: 404,
          content: { size: 0, mimeType: 'image/png' },
          headersSize: 30,
          bodySize: 0,
        },
        timings: { wait: 40 },
      },
    ],
  },
}

const parsed = parseHar(JSON.stringify(har))
ok('parse ok', parsed.ok)
eq('creator', parsed.creator, 'WebInspector 537.36')
eq('pageTitle', parsed.pageTitle, 'Example Page')
eq('entry count', parsed.entries.length, 4)

// entry 0: size = headersSize+bodySize = 2000(無 _transferSize)
eq('entry0 size', parsed.entries[0].size, 2000)
eq('entry0 type', parsed.entries[0].type, 'document')
// entry 1: 用 _transferSize = 30000
eq('entry1 size uses transferSize', parsed.entries[1].size, 30000)
eq('entry1 type', parsed.entries[1].type, 'script')
eq('entry1 host', parsed.entries[1].host, 'cdn.example.com')

const s = summarize(parsed.entries)
eq('summary count', s.count, 4)
// totalSize = 2000 + 30000 + 150 + 30 = 32180
eq('total size', s.totalSize, 32180)
// totalContentSize = 5000 + 90000 + 100 + 0 = 95100
eq('total content size', s.totalContentSize, 95100)
// wall clock: 最早 00:00.000,最晚結束 = 100ms 起點+500=600(entry2 start=100,+500=600)
// entry0 end=100, entry1 end=350, entry2 end=600, entry3 end=240 → max=600, min=0 → 600
eq('wall clock time', s.totalTime, 600)
eq('started at', s.startedAt, '2026-06-20T00:00:00.000Z')

// byStatus
const status2xx = s.byStatus.find((x) => x.group === '2xx 成功')
const status5xx = s.byStatus.find((x) => x.group === '5xx 伺服器錯誤')
const status4xx = s.byStatus.find((x) => x.group === '4xx 用戶端錯誤')
eq('2xx count', status2xx.count, 2)
eq('5xx count', status5xx.count, 1)
eq('4xx count', status4xx.count, 1)

// errors = 500 + 404
eq('errors count', s.errors.length, 2)
ok('error has 500', s.errors.some((e) => e.status === 500))

// slowest 第一名 = 500ms 的 POST
eq('slowest first time', s.slowest[0].time, 500)
eq('slowest first method', s.slowest[0].method, 'POST')
// largest 第一名 = 30000
eq('largest first size', s.largest[0].size, 30000)

// byType: script 最大(30000) 在 document(2000) 之前
eq('byType first is script', s.byType[0].type, 'script')

// byHost: example.com 有 2 筆(entry0, entry3)
const exHost = s.byHost.find((h) => h.host === 'example.com')
eq('example.com host count', exHost.count, 2)

// --- wallClockTime 單獨:空陣列 → 0 ---
eq('wallclock empty', wallClockTime([]), 0)

// --- formatters ---
eq('formatBytes B', formatBytes(512), '512 B')
eq('formatBytes KB', formatBytes(2048), '2.0 KB')
eq('formatBytes MB', formatBytes(1572864), '1.50 MB')
eq('formatMs ms', formatMs(250), '250 ms')
eq('formatMs s', formatMs(2500), '2.50 s')

// --- topN 限制 ---
const many = Array.from({ length: 30 }, (_, i) => ({
  startedDateTime: '2026-06-20T00:00:00.000Z',
  time: i,
  request: { method: 'GET', url: `https://h${i}.test/a` },
  response: { status: 200, content: { size: i, mimeType: 'text/html' }, headersSize: 0, bodySize: i },
  timings: {},
}))
const manyParsed = parseHar(JSON.stringify({ log: { entries: many } }))
const manyS = summarize(manyParsed.entries, 5)
eq('topN slowest length', manyS.slowest.length, 5)
eq('topN largest length', manyS.largest.length, 5)

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
