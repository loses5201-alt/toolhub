// NDJSON / JSON Lines 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'ndjson-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/ndjson.ts').replace(/\\/g, '\\\\')
writeFileSync(
  entry,
  `export { parseNdjson, validateLines, ndjsonToArray, arrayToNdjson, tidyNdjson } from '${src}'`,
)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const m = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── parseNdjson 基本 ──
const r1 = m.parseNdjson('{"a":1}\n{"b":2}\n{"c":3}')
ok(r1.ok && r1.lineCount === 3, '三行皆有效')
ok(eq(r1.values, [{ a: 1 }, { b: 2 }, { c: 3 }]), '解析出三物件')
ok(r1.errors.length === 0, '無錯誤')

// ── 空白行略過 ──
const r2 = m.parseNdjson('{"a":1}\n\n  \n{"b":2}\n')
ok(r2.ok && r2.lineCount === 2 && r2.values.length === 2, '空白行不計入')

// ── 壞行回報正確行號 ──
const r3 = m.parseNdjson('{"a":1}\n{bad}\n{"c":3}')
ok(!r3.ok && r3.errors.length === 1, '一行壞掉')
ok(r3.errors[0].line === 2, '壞行行號=2')
ok(r3.values.length === 2, '其餘兩行仍解析')

// 壞行在空白行之後,行號仍對應原始行
const r3b = m.parseNdjson('{"a":1}\n\n{oops}')
ok(r3b.errors[0].line === 3, '空白行後行號正確')

// ── CRLF ──
const r4 = m.parseNdjson('{"a":1}\r\n{"b":2}')
ok(r4.ok && r4.values.length === 2, 'CRLF 換行')

// ── 各種型別 ──
const r5 = m.parseNdjson('1\n"hi"\ntrue\nnull\n[1,2]')
ok(eq(r5.values, [1, 'hi', true, null, [1, 2]]), '純量/陣列各型別')

// ── validateLines ──
const v = m.validateLines('{"a":1}\n\n{bad}')
ok(v.length === 3, '三行狀態')
ok(v[0].ok && !v[0].blank, '第一行有效')
ok(v[1].blank && v[1].ok, '第二行空白')
ok(!v[2].ok && v[2].message, '第三行錯誤含訊息')
ok(v[2].line === 3, 'validateLines 行號')

// ── ndjsonToArray ──
const a1 = m.ndjsonToArray('{"a":1}\n{"b":2}')
ok(a1.ok && a1.count === 2, 'toArray 成功計數')
ok(eq(JSON.parse(a1.json), [{ a: 1 }, { b: 2 }]), 'toArray JSON 正確')
ok(a1.json.includes('\n') && a1.json.includes('  '), 'toArray 美化縮排')
const a2 = m.ndjsonToArray('{"a":1}\n{nope}')
ok(!a2.ok && a2.errors.length === 1 && a2.errors[0].line === 2, 'toArray 壞行回報')

// ── arrayToNdjson ──
const b1 = m.arrayToNdjson('[{"a":1},{"b":2},{"c":3}]')
ok(b1.ok && b1.count === 3, 'fromArray 計數')
ok(b1.ndjson === '{"a":1}\n{"b":2}\n{"c":3}', 'fromArray 每行單行')
ok(!b1.ndjson.includes('\n  '), 'fromArray 無縮排(單行)')
const b2 = m.arrayToNdjson('{"a":1}')
ok(!b2.ok && b2.error.includes('陣列'), '非陣列報錯')
const b3 = m.arrayToNdjson('[bad]')
ok(!b3.ok && b3.error.includes('解析失敗'), '無效 JSON 報錯')
const b4 = m.arrayToNdjson('[]')
ok(b4.ok && b4.count === 0 && b4.ndjson === '', '空陣列')

// ── 巢狀物件保留 ──
const nested = m.arrayToNdjson('[{"x":{"y":[1,2]},"z":null}]')
ok(nested.ndjson === '{"x":{"y":[1,2]},"z":null}', '巢狀結構保留單行')

// ── tidyNdjson:去空白行、規整 ──
const t = m.tidyNdjson('{"a":1}\n\n{ "b" : 2 }\n')
ok(t.ok && t.json === '{"a":1}\n{"b":2}', 'tidy 去空白並壓行')

// ── 往返一致 ──
const orig = '{"id":1,"name":"a"}\n{"id":2,"name":"b"}'
const round = m.arrayToNdjson(m.ndjsonToArray(orig).json)
ok(round.ndjson === orig, 'ndjson→array→ndjson 往返一致')

const origArr = '[{"id":1},{"id":2}]'
const round2 = m.ndjsonToArray(m.arrayToNdjson(origArr).ndjson)
ok(eq(JSON.parse(round2.json), JSON.parse(origArr)), 'array→ndjson→array 往返一致')

// ── 空輸入 ──
ok(m.parseNdjson('').lineCount === 0, '空輸入 0 行')
ok(m.ndjsonToArray('').ok && JSON.parse(m.ndjsonToArray('').json).length === 0, '空輸入 → 空陣列')

console.log(`ndjson: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
