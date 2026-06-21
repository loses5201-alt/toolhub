// JSON → Rust 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontorust-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToRust.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToRust, structNameFromKey, fieldNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToRust, structNameFromKey, fieldNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToRust(j, o).code

// ── structNameFromKey ──
ok(structNameFromKey('user') === 'User', 'user→User')
ok(structNameFromKey('user_profile') === 'UserProfile', 'snake→Pascal')
ok(structNameFromKey('userProfile') === 'UserProfile', 'camel→Pascal')
ok(structNameFromKey('123') === '_123', '數字開頭加底線')
ok(structNameFromKey('') === 'Root', '空字串→Root')

// ── fieldNameFromKey ──
ok(fieldNameFromKey('userName') === 'user_name', 'camel→snake')
ok(fieldNameFromKey('HTTPServer') === 'http_server', '連續大寫縮寫處理')
ok(fieldNameFromKey('user-name') === 'user_name', 'kebab→snake')
ok(fieldNameFromKey('first name') === 'first_name', '空白→snake')
ok(fieldNameFromKey('type') === 'type_', '關鍵字加底線')
ok(fieldNameFromKey('2fa') === 'n_2fa', '數字開頭加前綴')
ok(fieldNameFromKey('已存在') === 'field', '非識別字 fallback field')

// ── 基本物件 ──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('use serde::{Deserialize, Serialize};'), 'serde 匯入')
ok(c1.includes('#[derive(Debug, Clone, Serialize, Deserialize)]'), 'derive 屬性')
ok(c1.includes('pub struct Root {'), 'Root struct')
ok(c1.includes('pub id: i64,'), 'i64 欄位')
ok(c1.includes('pub name: String,'), 'String 欄位')
ok(c1.includes('pub active: bool,'), 'bool 欄位')
ok(c1.includes('pub score: f64,'), 'f64 欄位')

// ── serde rename ──
const c2 = gen('{"userName":"a","id":1}')
ok(c2.includes('#[serde(rename = "userName")]'), 'rename 屬性')
ok(c2.includes('pub user_name: String,'), 'snake 欄位名')

// ── null → Option / serde_json::Value ──
const c3 = gen('{"a":null,"b":"x"}')
ok(c3.includes('pub a: serde_json::Value,'), '全 null → Value')
const c3b = gen('[{"a":1},{"a":null}]')
ok(c3b.includes('pub a: Option<i64>,'), 'null 出現 → Option<i64>')

// ── 巢狀物件 → 另一個 struct ──
const c4 = gen('{"user":{"id":1,"name":"a"},"count":3}')
ok(c4.includes('pub struct User {'), '巢狀產生 User struct')
ok(c4.includes('pub user: User,'), '欄位引用 User')
ok(c4.indexOf('pub struct User {') < c4.indexOf('pub struct Root {'), '葉節點 struct 在前')

// ── 陣列合併欄位 + 缺鍵 Option ──
const c5 = gen('{"items":[{"x":1,"y":2},{"x":3}]}')
ok(c5.includes('pub struct Item {'), '陣列元素單數化 struct Item')
ok(c5.includes('pub items: Vec<Item>,'), 'Vec<Item>')
ok(c5.includes('pub y: Option<i64>,'), '缺鍵 → Option')

// ── 字串陣列 ──
const c6 = gen('{"tags":["a","b"]}')
ok(c6.includes('pub tags: Vec<String>,'), 'Vec<String>')

// ── 空物件 ──
const c7 = gen('{"meta":{}}')
ok(c7.includes('pub struct Meta {}'), '空物件 → 空 struct')

// ── int + float 混合 → f64 ──
const c8 = gen('[{"v":1},{"v":2.5}]')
ok(c8.includes('pub v: f64,'), 'int+float → f64')

// ── 型別衝突 → serde_json::Value ──
const c9 = gen('[{"v":1},{"v":"x"}]')
ok(c9.includes('pub v: serde_json::Value,'), '衝突 → Value')

// ── 根為陣列 ──
const c10 = gen('[{"id":1}]')
ok(c10.includes('pub type Root = Vec<RootItem>;'), '根陣列 → type 別名')
ok(c10.includes('pub struct RootItem {'), '元素 struct RootItem')

// ── 根為純量 ──
const c11 = gen('42')
ok(c11.includes('pub type Root = i64;'), '根純量 → type 別名')

// ── plain 樣式(無 serde)──
const c12 = gen('{"userName":"a"}', { style: 'plain' })
ok(!c12.includes('use serde'), 'plain 不匯入 serde')
ok(c12.includes('#[derive(Debug, Clone)]'), 'plain derive')
ok(c12.includes('// JSON 鍵: userName'), 'plain 用註解標原始鍵')
ok(!c12.includes('#[serde'), 'plain 無 serde 屬性')

// ── pubFields 關閉 ──
const c13 = gen('{"id":1}', { pubFields: false })
ok(c13.includes('    id: i64,') && !c13.includes('pub id'), 'pubFields=false 私有欄位')

// ── 自訂根名 ──
const c14 = gen('{"id":1}', { rootName: 'Person' })
ok(c14.includes('pub struct Person {'), '自訂根名')

// ── 物件欄位各依鍵名成 struct ──
const c15 = gen('{"a":{"x":1},"b":{"x":1}}')
ok(c15.includes('pub struct A {') && c15.includes('pub struct B {'), '各鍵名各一 struct')
ok(c15.includes('pub a: A,') && c15.includes('pub b: B,'), '欄位引用各自 struct')
// ── 同 baseName 不同結構 → 加序號(point / points 都映到 Point)──
const c16 = gen('{"point":{"x":1},"points":[{"x":1,"y":2}]}')
ok(c16.includes('pub struct Point {') && c16.includes('pub struct Point1 {'), '同名不同結構加序號')

// ── 解析錯誤 ──
const r = jsonToRust('{bad json}')
ok(!r.ok && r.error.includes('JSON 解析失敗'), '壞 JSON 回報錯誤')

console.log(`\njson-to-rust: ${pass} 通過, ${fail} 失敗`)
if (fail) process.exit(1)
