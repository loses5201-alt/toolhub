// JSON → Protobuf 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontoproto-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToProto.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToProto, messageNameFromKey, fieldNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToProto, messageNameFromKey, fieldNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToProto(j, o).code

// ── 命名 ──
ok(messageNameFromKey('user') === 'User', 'message user→User')
ok(messageNameFromKey('user_profile') === 'UserProfile', 'message snake→Pascal')
ok(messageNameFromKey('2nd') === 'N2nd', 'message 數字開頭')
ok(fieldNameFromKey('userName') === 'user_name', 'field camel→snake')
ok(fieldNameFromKey('UserName') === 'user_name', 'field Pascal→snake')
ok(fieldNameFromKey('user-name') === 'user_name', 'field kebab→snake')
ok(fieldNameFromKey('') === 'field', '空→field')

// ── 基本物件 ──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.startsWith('syntax = "proto3";'), 'proto3 syntax 開頭')
ok(c1.includes('message Root {'), 'Root message')
ok(c1.includes('int64 id = 1;'), 'int64 欄位 + 編號 1')
ok(c1.includes('string name = 2;'), 'string 欄位 + 編號 2')
ok(c1.includes('bool active = 3;'), 'bool 欄位 + 編號 3')
ok(c1.includes('double score = 4;'), 'double 欄位 + 編號 4')
ok(!c1.includes('import'), '基本型別不需 import')

// ── 整數+小數混合 → double ──
const c2 = gen('[{"v":1},{"v":2.5}]', { rootName: 'Nums' })
ok(c2.includes('double v = 1;'), '混合 int+double → double')

// ── 缺鍵 / null 不影響型別(proto3 皆 optional)──
const c3 = gen('[{"a":1,"b":2},{"a":3}]', { rootName: 'Row' })
ok(c3.includes('int64 b = 2;'), '缺鍵欄位仍正常輸出')

// ── 全 null / 型別衝突 → google.protobuf.Value ──
const c4 = gen('{"x":null}')
ok(c4.includes('import "google/protobuf/struct.proto";'), '需 Value 時加 import')
ok(c4.includes('google.protobuf.Value x = 1;'), '全 null → Value')
const c4b = gen('[{"v":1},{"v":"s"}]', { rootName: 'Row' })
ok(c4b.includes('google.protobuf.Value v = 1;'), '型別衝突 → Value')

// ── 巢狀物件 ──
const c5 = gen('{"id":1,"address":{"city":"台北","zip":"100"}}')
ok(c5.includes('message Address {'), '巢狀 → Address message')
ok(c5.includes('Address address = 2;'), '欄位型別為 Address')
ok(c5.indexOf('message Address {') < c5.indexOf('message Root {'), '葉節點 message 在前')

// ── 純量陣列 → repeated ──
const c6 = gen('{"tags":["a","b"],"nums":[1,2]}')
ok(c6.includes('repeated string tags = 1;'), 'repeated string')
ok(c6.includes('repeated int64 nums = 2;'), 'repeated int64')

// ── 物件陣列 → repeated message(單數名)──
const c7 = gen('{"orders":[{"no":"A","amount":1},{"no":"B","amount":2,"note":"x"}]}')
ok(c7.includes('message Order {'), '物件陣列 → 單數 message Order')
ok(c7.includes('repeated Order orders = 1;'), 'repeated Order')
ok(c7.includes('string note = 3;'), '合併欄位')

// ── 巢狀陣列 → wrapper message(proto3 不允許 repeated repeated)──
const c8 = gen('{"grid":[[1,2],[3,4]]}')
ok(/message Grid \{/.test(c8), '巢狀陣列產生 wrapper message')
ok(c8.includes('repeated int64 values = 1;'), 'wrapper 內 repeated int64 values')
ok(/repeated Grid grid = 1;/.test(c8), '外層 repeated Grid')
ok(!/repeated repeated/.test(c8), '不出現 repeated repeated')

// ── json_name 標註(snake_case 與原鍵不同)──
const c9 = gen('{"userName":"x"}')
ok(c9.includes('string user_name = 1 [json_name = "userName"];'), 'camel 鍵補 json_name')
const c9b = gen('{"user_name":"x"}')
ok(c9b.includes('string user_name = 1;') && !c9b.includes('json_name'), '同名鍵不補 json_name')

// ── package ──
const c10 = gen('{"id":1}', { packageName: 'my.api.v1' })
ok(c10.includes('package my.api.v1;'), 'package 宣告')

// ── 根為陣列 / 純量 ──
const r1 = gen('[1,2,3]', { rootName: 'Nums' })
ok(r1.includes('// 根為陣列,請用欄位 repeated int64'), '根陣列註解')
const r2 = gen('"hello"')
ok(r2.includes('// 根為純量,型別為 string'), '根純量註解')

// ── 同名不同結構 → 加序號 ──
const c11 = gen('{"a":{"x":1},"b":{"y":2}}')
ok(/message A \{/.test(c11) && /message B \{/.test(c11), '不同結構各自 message')

// ── 空物件 ──
const c12 = gen('{}')
ok(c12.includes('message Root {') && c12.includes('}'), '空物件仍輸出 message')

// ── 解析錯誤 ──
const err = jsonToProto('{bad')
ok(err.ok === false && /JSON 解析失敗/.test(err.error), '壞 JSON 報錯')

console.log(`jsontoproto: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
