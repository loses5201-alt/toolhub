// JSON → Kotlin 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontokt-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToKotlin.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToKotlin, classNameFromKey, propNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToKotlin, classNameFromKey, propNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToKotlin(j, o).code

// ── 命名 ──
ok(classNameFromKey('user') === 'User', 'class user→User')
ok(classNameFromKey('user_profile') === 'UserProfile', 'class snake→Pascal')
ok(propNameFromKey('user_name') === 'userName', 'prop snake→camel')
ok(propNameFromKey('UserName') === 'userName', 'prop Pascal→camel')
ok(propNameFromKey('user-name') === 'userName', 'prop kebab→camel')
ok(propNameFromKey('first name') === 'firstName', 'prop 空白→camel')
ok(propNameFromKey('') === 'field', '空→field')

// ── 基本物件(kotlinx)──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('import kotlinx.serialization.Serializable'), 'import Serializable')
ok(c1.includes('@Serializable'), '@Serializable 標註')
ok(c1.includes('data class Root('), 'Root data class')
ok(c1.includes('val id: Long'), 'Long 屬性')
ok(c1.includes('val name: String'), 'String 屬性')
ok(c1.includes('val active: Boolean'), 'Boolean 屬性')
ok(c1.includes('val score: Double'), 'Double 屬性')
// 最後一個屬性無逗號
ok(/val score: Double\n\)/.test(c1), '最後屬性無逗號')

// ── SerialName(camel == key 時不標)──
ok(!c1.includes('@SerialName'), 'id/name 同鍵不標 SerialName')
const c2 = gen('{"user_name":"a"}')
ok(c2.includes('@SerialName("user_name")'), '不同鍵加 SerialName')
ok(c2.includes('val userName: String'), 'camel 屬性名')

// ── Gson / Moshi 標註 ──
const c3 = gen('{"user_name":"a"}', { lib: 'gson' })
ok(c3.includes('import com.google.gson.annotations.SerializedName'), 'gson import')
ok(c3.includes('@SerializedName("user_name")'), 'gson 標註')
ok(!c3.includes('@Serializable'), 'gson 無 @Serializable')
const c3b = gen('{"user_name":"a"}', { lib: 'moshi' })
ok(c3b.includes('@JsonClass(generateAdapter = true)'), 'moshi class 標註')
ok(c3b.includes('@Json(name = "user_name")'), 'moshi 欄位標註')

// ── none ──
const c4 = gen('{"user_name":"a"}', { lib: 'none' })
ok(!c4.includes('import'), 'none 無 import')
ok(c4.includes('// JSON 鍵: user_name'), 'none 用註解標原鍵')
ok(!c4.includes('@'), 'none 無標註')

// ── null → nullable + 預設 null ──
const c5 = gen('{"a":null,"b":"x"}')
ok(c5.includes('val a: Any? = null'), '全 null → Any?')
const c5b = gen('[{"a":1},{"a":null}]')
ok(c5b.includes('val a: Long? = null'), 'null 出現 → Long? = null')

// ── 巢狀物件 ──
const c6 = gen('{"user":{"id":1,"name":"a"},"count":3}')
ok(c6.includes('data class User('), '巢狀 User data class')
ok(c6.includes('val user: User'), '屬性引用 User')
ok(c6.indexOf('data class User(') < c6.indexOf('data class Root('), '葉節點在前')

// ── 陣列合併 + 缺鍵 nullable ──
const c7 = gen('{"items":[{"x":1,"y":2},{"x":3}]}')
ok(c7.includes('data class Item('), '陣列元素 Item')
ok(c7.includes('val items: List<Item>'), 'List<Item>')
ok(c7.includes('val y: Long? = null'), '缺鍵 → Long? = null')

// ── 字串陣列 ──
const c8 = gen('{"tags":["a","b"]}')
ok(c8.includes('val tags: List<String>'), 'List<String>')

// ── int+float → Double ──
const c9 = gen('[{"v":1},{"v":2.5}]')
ok(c9.includes('val v: Double'), 'int+float → Double')

// ── 型別衝突 → Any ──
const c10 = gen('[{"v":1},{"v":"x"}]')
ok(c10.includes('val v: Any'), '衝突 → Any')

// ── Kotlin 關鍵字 → 反引號 ──
const c11 = gen('{"fun":1,"is":true}')
ok(c11.includes('val `fun`: Long'), '關鍵字 fun 反引號')
ok(c11.includes('val `is`: Boolean'), '關鍵字 is 反引號')

// ── 空物件 → class ──
const c12 = gen('{"meta":{}}')
ok(c12.includes('class Meta') && !c12.includes('data class Meta'), '空物件 → 非 data class')

// ── 根為陣列 / 純量 ──
const c13 = gen('[{"id":1}]')
ok(c13.includes('data class RootItem('), '根陣列元素 RootItem')
ok(c13.includes('// 根為陣列,請直接用 List<RootItem>'), '根陣列提示')
const c14 = gen('42')
ok(c14.includes('// 根為純量,型別為 Long'), '根純量提示')

// ── 自訂根名 ──
const c15 = gen('{"id":1}', { rootName: 'Person' })
ok(c15.includes('data class Person('), '自訂根名')

// ── 同名同結構重用 / 不同結構加序號 ──
const c16 = gen('{"point":{"x":1},"points":[{"x":1,"y":2}]}')
ok(c16.includes('data class Point(') && c16.includes('data class Point1('), '同名不同結構加序號')

// ── 解析錯誤 ──
const r = jsonToKotlin('{bad}')
ok(!r.ok && r.error.includes('JSON 解析失敗'), '壞 JSON 回報錯誤')

console.log(`\njson-to-kotlin: ${pass} 通過, ${fail} 失敗`)
if (fail) process.exit(1)
