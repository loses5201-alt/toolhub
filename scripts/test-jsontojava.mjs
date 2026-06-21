// JSON → Java 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontojava-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToJava.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToJava, classNameFromKey, propNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToJava, classNameFromKey, propNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToJava(j, o).code

// ── 命名 ──
ok(classNameFromKey('user') === 'User', 'class user→User')
ok(classNameFromKey('user_profile') === 'UserProfile', 'class snake→Pascal')
ok(propNameFromKey('user_name') === 'userName', 'prop snake→camel')
ok(propNameFromKey('UserName') === 'userName', 'prop Pascal→camel')
ok(propNameFromKey('user-name') === 'userName', 'prop kebab→camel')
ok(propNameFromKey('first name') === 'firstName', 'prop 空白→camel')
ok(propNameFromKey('') === 'field', '空→field')
ok(propNameFromKey('class') === 'class_', '關鍵字 class→class_')
ok(propNameFromKey('2nd') === '_2nd', '數字開頭加底線')

// ── 基本物件(jackson, class)──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('import com.fasterxml.jackson.annotation.JsonProperty;'), 'jackson import')
ok(c1.includes('public class Root {'), '根為 public class')
ok(c1.includes('public Long id;'), 'Long 欄位')
ok(c1.includes('public String name;'), 'String 欄位')
ok(c1.includes('public Boolean active;'), 'Boolean 欄位')
ok(c1.includes('public Double score;'), 'Double 欄位')
ok(!c1.includes('@JsonProperty'), 'id/name 同鍵不標 JsonProperty')

// ── JsonProperty(camel != key 時標)──
const c2 = gen('{"user_name":"a"}')
ok(c2.includes('@JsonProperty("user_name")'), '不同鍵加 JsonProperty')
ok(c2.includes('public String userName;'), 'camel 欄位名')

// ── Gson 標註 ──
const c3 = gen('{"user_name":"a"}', { lib: 'gson' })
ok(c3.includes('import com.google.gson.annotations.SerializedName;'), 'gson import')
ok(c3.includes('@SerializedName("user_name")'), 'gson 標註')
ok(!c3.includes('JsonProperty'), 'gson 無 JsonProperty')

// ── none ──
const c4 = gen('{"user_name":"a"}', { lib: 'none' })
ok(!c4.includes('import com'), 'none 無第三方 import')
ok(c4.includes('// JSON 鍵: user_name'), 'none 用註解標原鍵')
ok(!c4.includes('@'), 'none 無標註')

// ── null / 缺值 → 裝箱型別(Object 或對應)──
const c5 = gen('{"a":null,"b":"x"}')
ok(c5.includes('public Object a;'), '全 null → Object')
const c5b = gen('[{"a":1},{"a":null}]')
ok(c5b.includes('public Long a;'), 'null 出現仍為 Long(裝箱可放 null)')

// ── 巢狀物件 ──
const c6 = gen('{"user":{"id":1,"name":"a"},"count":3}')
ok(c6.includes('class User {'), '巢狀 User class')
ok(c6.includes('public User user;'), '欄位引用 User')
ok(/^public class Root|\npublic class Root/.test(c6), '根 class 為 public')
ok((c6.match(/public class/g) || []).length === 1, '只有一個 public class')
ok(c6.includes('\nclass User {') || c6.startsWith('class User {'), 'User 為 package-private')

// ── 陣列合併 + 缺鍵 ──
const c7 = gen('{"items":[{"x":1,"y":2},{"x":3}]}')
ok(c7.includes('class Item {'), '陣列元素 Item')
ok(c7.includes('public List<Item> items;'), 'List<Item>')
ok(c7.includes('import java.util.List;'), 'List import')
ok(c7.includes('public Long y;'), '缺鍵欄位仍輸出')

// ── 字串陣列 ──
const c8 = gen('{"tags":["a","b"]}')
ok(c8.includes('public List<String> tags;'), 'List<String>')

// ── int+float → Double ──
const c9 = gen('[{"v":1},{"v":2.5}]')
ok(c9.includes('public Double v;'), 'int+float → Double')

// ── 型別衝突 → Object ──
const c10 = gen('[{"v":1},{"v":"x"}]')
ok(c10.includes('public Object v;'), '衝突 → Object')

// ── Java 關鍵字 → 底線 + 標註對映原鍵 ──
const c11 = gen('{"class":1,"public":true}')
ok(c11.includes('public Long class_;'), '關鍵字 class→class_')
ok(c11.includes('@JsonProperty("class")'), '關鍵字欄位用標註對映原鍵')

// ── 空物件 → 空 class ──
const c12 = gen('{"meta":{}}')
ok(/class Meta \{\n\}/.test(c12), '空物件 → 空 class')

// ── 根為陣列 / 純量 ──
const c13 = gen('[{"id":1}]')
ok(c13.includes('class RootItem {'), '根陣列元素 RootItem(無公開根,故 package-private)')
ok(!c13.includes('public class'), '根為陣列時無 public class')
ok(c13.includes('// 根為陣列,請直接用 List<RootItem>'), '根陣列提示')
const c14 = gen('42')
ok(c14.includes('// 根為純量,型別為 Long'), '根純量提示')

// ── 自訂根名 ──
const c15 = gen('{"id":1}', { rootName: 'Person' })
ok(c15.includes('public class Person {'), '自訂根名')

// ── 同名同結構重用 / 不同結構加序號 ──
const c16 = gen('{"point":{"x":1},"points":[{"x":1,"y":2}]}')
ok(c16.includes('class Point {') && c16.includes('class Point1 {'), '同名不同結構加序號')
// 不同鍵名即使結構相同,仍各自成類別(類別名取自鍵,與 kotlin 引擎一致)
const c16b = gen('{"a":{"x":1},"b":{"x":1}}')
ok(c16b.includes('class A {') && c16b.includes('class B {'), '不同鍵 → A 與 B 各自成類別')

// ── record 樣式 ──
const r1 = gen('{"id":1,"user_name":"a"}', { style: 'record' })
ok(r1.includes('public record Root('), 'record 根')
ok(r1.includes('Long id'), 'record 含 Long id')
ok(r1.includes('@JsonProperty("user_name") String userName'), 'record 內聯標註')
ok(r1.trim().endsWith(') {}'), 'record 以 ) {} 收尾')
const r2 = gen('{"meta":{}}', { style: 'record' })
ok(r2.includes('record Meta() {}'), '空物件 record')
const r3 = gen('{"items":[{"x":1}]}', { style: 'record', lib: 'none' })
ok(r3.includes('public record Root('), 'record + none 根')
ok(r3.includes('List<Item> items'), 'record List 元件')

// ── 解析錯誤 ──
const r = jsonToJava('{bad}')
ok(!r.ok && r.error.includes('JSON 解析失敗'), '壞 JSON 回報錯誤')

console.log(`\njson-to-java: ${pass} 通過, ${fail} 失敗`)
if (fail) process.exit(1)
