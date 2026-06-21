/*
  .eml(RFC 5322 / MIME)解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-eml.mjs
  oracle:RFC 5322 標頭折行、MIME 結構(multipart boundary)、RFC 2045 transfer-encoding
  (quoted-printable / base64)、RFC 2047 encoded-word、RFC 2231 參數延續,以手構樣本逐項比對。
  base64 / 編碼字以 Node 內建 Buffer 即時產生為 oracle,不硬編。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `eml-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/eml.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseHeaders, getHeader, parseParamHeader, resolveParam,
  parsePart, flattenLeaves, parseAddresses, parseEml, formatBytes,
} = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const ew = (s) => `=?UTF-8?B?${b64(s)}?=`

// --- parseHeaders:折行還原 ---
const h1 = parseHeaders('Subject: Hello\n World\nFrom: a@b.com')
check('parseHeaders 續行接回', getHeader(h1, 'subject') === 'Hello World')
check('parseHeaders 第二欄', getHeader(h1, 'from') === 'a@b.com')
check('getHeader 大小寫不敏感', getHeader(h1, 'SUBJECT') === 'Hello World')
check('parseHeaders Tab 續行', getHeader(parseHeaders('A: 1\n\t2'), 'a') === '1 2')

// --- parseParamHeader ---
const pp = parseParamHeader('multipart/mixed; boundary="a=b;c"; charset=utf-8')
check('parseParamHeader value', pp.value === 'multipart/mixed')
check('parseParamHeader 引號內分號不切', pp.params.boundary === 'a=b;c')
check('parseParamHeader 無引號參數', pp.params.charset === 'utf-8')
check('parseParamHeader 跳脫反斜線', parseParamHeader('text/plain; name="a\\"b"').params.name === 'a"b')

// --- resolveParam ---
check('resolveParam 純值', resolveParam({ filename: 'a.txt' }, 'filename') === 'a.txt')
check('resolveParam encoded-word', resolveParam({ name: ew('測試') }, 'name') === '測試')
check('resolveParam RFC2231 單一', resolveParam({ "filename*": "UTF-8''%E6%B8%AC%E8%A9%A6" }, 'filename') === '測試')
check('resolveParam RFC2231 延續', resolveParam({ 'filename*0*': "UTF-8''%E6%B8%AC", 'filename*1*': '%E8%A9%A6' }, 'filename') === '測試')
check('resolveParam 延續混合純值', resolveParam({ 'filename*0': 'long', 'filename*1': 'name.txt' }, 'filename') === 'longname.txt')
check('resolveParam 不存在回空', resolveParam({}, 'filename') === '')

// --- parsePart:quoted-printable 內文 ---
const qp = parsePart('Content-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: quoted-printable\n\nCaf=C3=A9 and=\nmore')
check('QP 解碼 =C3=A9 → é', qp.text === 'Café andmore')
check('QP 底線為字面(非空格)', parsePart('Content-Type: text/plain\nContent-Transfer-Encoding: quoted-printable\n\na_b').text === 'a_b')

// --- parsePart:base64 內文 ---
const bp = parsePart(`Content-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: base64\n\n${b64('Hello, 世界')}`)
check('base64 解碼內文', bp.text === 'Hello, 世界')
check('base64 size = utf8 位元組數', bp.size === Buffer.byteLength('Hello, 世界', 'utf8'))

// --- charset:iso-8859-1(8bit 位元組字串)---
const latin = parsePart('Content-Type: text/plain; charset=iso-8859-1\n\nCaf' + String.fromCharCode(0xe9))
check('iso-8859-1 0xE9 → é', latin.text === 'Café')

// --- parseAddresses ---
const addrs = parseAddresses('Alice <a@x.com>, "Bob, Jr" <b@y.com>, c@z.com')
check('parseAddresses 數量(引號內逗號不切)', addrs.length === 3)
check('parseAddresses 顯示名與信箱', addrs[0].name === 'Alice' && addrs[0].email === 'a@x.com')
check('parseAddresses 引號名保留逗號', addrs[1].name === 'Bob, Jr')
check('parseAddresses 純信箱無名稱', addrs[2].name === '' && addrs[2].email === 'c@z.com')
check('parseAddresses encoded-word 名稱', parseAddresses(`${ew('王小明')} <w@x.com>`)[0].name === '王小明')
check('parseAddresses 空值', parseAddresses('').length === 0)

// --- parseEml:簡單純文字信 ---
const simple = ['From: Alice <alice@example.com>', 'To: bob@example.com', 'Subject: Hello', 'Content-Type: text/plain; charset=utf-8', '', 'Hi there'].join('\n')
const s = parseEml(simple)
check('簡單信 subject', s.subject === 'Hello')
check('簡單信 from', s.from[0].name === 'Alice' && s.from[0].email === 'alice@example.com')
check('簡單信 to', s.to[0].email === 'bob@example.com')
check('簡單信 text', s.text === 'Hi there')
check('簡單信 無附件', s.attachments.length === 0)
check('簡單信 root 非 multipart', s.root.isMultipart === false)

// --- parseEml:multipart/alternative + 主旨亂碼(含 CRLF 正規化、preamble/epilogue)---
const altRaw = ['Subject: ' + ew('測試'), 'Content-Type: multipart/alternative; boundary="BND"', '', 'preamble', '--BND', 'Content-Type: text/plain; charset=utf-8', '', 'plain body', '--BND', 'Content-Type: text/html; charset=utf-8', '', '<p>html body</p>', '--BND--', 'epilogue'].join('\r\n')
const alt = parseEml(altRaw)
check('alt 主旨還原(encoded-word)', alt.subject === '測試')
check('alt root 為 multipart', alt.root.isMultipart === true && alt.root.children.length === 2)
check('alt 取 text/plain 內文', alt.text === 'plain body')
check('alt 取 text/html 內文', alt.html === '<p>html body</p>')
check('alt 兩段皆內文、無附件', alt.attachments.length === 0)

// --- parseEml:multipart/mixed + 附件 ---
const mixRaw = ['Subject: with attach', 'Content-Type: multipart/mixed; boundary="MIX"', '', '--MIX', 'Content-Type: text/plain; charset=utf-8', '', 'see attached', '--MIX', 'Content-Type: application/octet-stream; name="data.bin"', 'Content-Transfer-Encoding: base64', 'Content-Disposition: attachment; filename="data.bin"', '', b64('binarydata'), '--MIX--'].join('\n')
const mix = parseEml(mixRaw)
check('mixed 內文', mix.text === 'see attached')
check('mixed 附件數', mix.attachments.length === 1)
check('mixed 附件檔名', mix.attachments[0].filename === 'data.bin')
check('mixed 附件型別', mix.attachments[0].contentType === 'application/octet-stream')
check('mixed 附件大小', mix.attachments[0].size === Buffer.byteLength('binarydata'))
check('flattenLeaves 攤平葉節點數', flattenLeaves(mix.root).length === 2)

// --- formatBytes ---
check('formatBytes B', formatBytes(512) === '512 B')
check('formatBytes KB', formatBytes(1536) === '1.5 KB')
check('formatBytes MB', formatBytes(1572864) === '1.5 MB')

if (fail) { console.error(`\n${fail} 項測試失敗`); process.exit(1) }
else console.log('\n所有 .eml 解析測試通過')
