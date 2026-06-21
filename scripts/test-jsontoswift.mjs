// JSON → Swift 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontoswift-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToSwift.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToSwift, structNameFromKey, propNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToSwift, structNameFromKey, propNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToSwift(j, o).code

// ── 命名 ──
ok(structNameFromKey('user') === 'User', 'struct user→User')
ok(structNameFromKey('user_profile') === 'UserProfile', 'struct snake→Pascal')
ok(propNameFromKey('user_name') === 'userName', 'prop snake→camel')
ok(propNameFromKey('UserName') === 'userName', 'prop Pascal→camel')
ok(propNameFromKey('user-name') === 'userName', 'prop kebab→camel')
ok(propNameFromKey('') === 'field', '空→field')

// ── 基本物件 ──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('import Foundation'), 'import Foundation')
ok(c1.includes('struct Root: Codable {'), 'Root struct Codable')
ok(c1.includes('let id: Int'), 'Int 屬性')
ok(c1.includes('let name: String'), 'String 屬性')
ok(c1.includes('let active: Bool'), 'Bool 屬性')
ok(c1.includes('let score: Double'), 'Double 屬性')
ok(!c1.includes('CodingKeys'), '全同鍵 → 不產生 CodingKeys')

// ── CodingKeys(有 rename 時列出全部)──
const c2 = gen('{"id":1,"user_name":"a"}')
ok(c2.includes('let userName: String'), 'camel 屬性名')
ok(c2.includes('enum CodingKeys: String, CodingKey {'), '有 rename → CodingKeys')
ok(c2.includes('case id\n'), '未改名鍵仍列出(case id)')
ok(c2.includes('case userName = "user_name"'), '改名鍵用 = 對映')

// ── null / 缺鍵 → optional ──
const c5 = gen('{"a":null,"b":"x"}')
ok(c5.includes('let a: AnyCodable?'), '全 null → AnyCodable?')
ok(c5.includes('AnyCodable'), '使用 AnyCodable 時加註解')
ok(c5.includes('// 注意:含型別不一致'), 'AnyCodable 說明註解')
const c5b = gen('[{"a":1},{"a":null}]')
ok(c5b.includes('let a: Int?'), 'null 出現 → Int?')
const c5c = gen('{"items":[{"x":1,"y":2},{"x":3}]}')
ok(c5c.includes('let y: Int?'), '缺鍵 → optional')

// ── 巢狀物件 ──
const c6 = gen('{"user":{"id":1,"name":"a"},"count":3}')
ok(c6.includes('struct User: Codable {'), '巢狀 User struct')
ok(c6.includes('let user: User'), '屬性引用 User')
ok(c6.indexOf('struct User') < c6.indexOf('struct Root'), '葉節點在前')

// ── 陣列 ──
const c7 = gen('{"items":[{"x":1}],"tags":["a","b"]}')
ok(c7.includes('struct Item: Codable {'), '陣列元素 Item')
ok(c7.includes('let items: [Item]'), '[Item]')
ok(c7.includes('let tags: [String]'), '[String]')

// ── int+float → Double ──
const c9 = gen('[{"v":1},{"v":2.5}]')
ok(c9.includes('let v: Double'), 'int+float → Double')

// ── 型別衝突 → AnyCodable ──
const c10 = gen('[{"v":1},{"v":"x"}]')
ok(c10.includes('let v: AnyCodable'), '衝突 → AnyCodable')

// ── Swift 關鍵字 → 反引號(名稱與原鍵相同時不需 CodingKeys,靠自動合成對映)──
const c11 = gen('{"default":1,"class":true}')
ok(c11.includes('let `default`: Int'), '關鍵字 default 反引號')
ok(c11.includes('let `class`: Bool'), '關鍵字 class 反引號')
ok(!c11.includes('CodingKeys'), '關鍵字但同鍵 → 不需 CodingKeys')
// 關鍵字屬性名又需改名時,CodingKeys 內也要反引號(原鍵 "In" → 屬性 in)
const c11b = gen('{"In":1,"x":2}')
ok(c11b.includes('let `in`: Int'), '改名後關鍵字 in 反引號')
ok(c11b.includes('case `in` = "In"'), 'CodingKeys 內關鍵字也反引號')

// ── 空物件 → 空 struct ──
const c12 = gen('{"meta":{}}')
ok(/struct Meta: Codable \{\n\}/.test(c12), '空物件 → 空 struct')

// ── 根為陣列 / 純量 ──
const c13 = gen('[{"id":1}]')
ok(c13.includes('struct RootItem: Codable {'), '根陣列元素 RootItem')
ok(c13.includes('// 根為陣列,請直接用 [RootItem]'), '根陣列提示')
const c14 = gen('42')
ok(c14.includes('// 根為純量,型別為 Int'), '根純量提示')

// ── 自訂根名 ──
const c15 = gen('{"id":1}', { rootName: 'Person' })
ok(c15.includes('struct Person: Codable {'), '自訂根名')

// ── 同名同結構重用 / 不同結構加序號 ──
const c16 = gen('{"point":{"x":1},"points":[{"x":1,"y":2}]}')
ok(c16.includes('struct Point: Codable {') && c16.includes('struct Point1: Codable {'), '同名不同結構加序號')

// ── 純文字 JSON 不誤觸 AnyCodable 註解 ──
ok(!c1.includes('AnyCodable') && !c1.includes('// 注意'), '無 Any 時不加註解')

// ── 解析錯誤 ──
const r = jsonToSwift('{bad}')
ok(!r.ok && r.error.includes('JSON 解析失敗'), '壞 JSON 回報錯誤')

console.log(`\njson-to-swift: ${pass} 通過, ${fail} 失敗`)
if (fail) process.exit(1)
