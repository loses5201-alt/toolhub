/*
  mbox 信箱分割引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-mbox.mjs
  oracle:Unix mbox / mboxrd 分割規則,以手構樣本逐項比對。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `mbox-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/mbox.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { splitMbox, unescapeMboxrd } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

const mbox = [
  'From a@x Wed Jun 16 10:00:00 2026',
  'Subject: One',
  'From: a@x',
  '',
  'Hello',
  '>From the start',
  '',
  'From b@y Wed Jun 16 11:00:00 2026',
  'Subject: Two',
  '',
  'World',
  '',
].join('\n')

const msgs = splitMbox(mbox)
check('分割出兩封', msgs.length === 2)
check('第一封 From_ 行', msgs[0].fromLine === 'From a@x Wed Jun 16 10:00:00 2026')
check('From_ 行不含於 raw', !msgs[0].raw.startsWith('From a@x Wed'))
check('第一封含標頭與內文', msgs[0].raw === 'Subject: One\nFrom: a@x\n\nHello\nFrom the start')
check('mboxrd 還原 >From → From', msgs[0].raw.includes('Hello\nFrom the start') && !msgs[0].raw.includes('>From'))
check('第二封內容', msgs[1].raw === 'Subject: Two\n\nWorld')

// 第一個 From_ 之前的內容略過
const withPreamble = splitMbox('garbage line\nFrom a@x Wed Jun 16\nSubject: Hi\n\nBody\n')
check('preamble 略過、仍 1 封', withPreamble.length === 1)
check('preamble 不入 raw', !withPreamble[0].raw.includes('garbage'))
check('preamble 後 raw 正確', withPreamble[0].raw === 'Subject: Hi\n\nBody')

// 非 mbox(無 From_ 行)
check('無 From_ 回空', splitMbox('just some text\nno from line').length === 0)
check('空字串回空', splitMbox('').length === 0)

// CRLF 正規化
const crlf = ['From a@x Mon', 'Subject: CR', '', 'body'].join('\r\n')
const crlfMsgs = splitMbox(crlf)
check('CRLF 仍分割', crlfMsgs.length === 1 && crlfMsgs[0].raw === 'Subject: CR\n\nbody')

// unescapeMboxrd 多層
check('unescapeMboxrd 去一個 >', unescapeMboxrd('>From x') === 'From x')
check('unescapeMboxrd >>From → >From', unescapeMboxrd('>>From x') === '>From x')
check('unescapeMboxrd 一般行不動', unescapeMboxrd('hello world') === 'hello world')
check('unescapeMboxrd 非行首 From 不動', unescapeMboxrd('see >From here').includes('see >From here'))

// 多封計數
const many = splitMbox(['From 1', 'a', '', 'From 2', 'b', '', 'From 3', 'c', ''].join('\n'))
check('三封 From_ → 三封', many.length === 3)

if (fail) { console.error(`\n${fail} 項測試失敗`); process.exit(1) }
else console.log('\n所有 mbox 分割測試通過')
