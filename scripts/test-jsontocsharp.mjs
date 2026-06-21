// JSON → C# 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontocs-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToCsharp.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToCsharp, pascalFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToCsharp, pascalFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToCsharp(j, o).code

// ── pascalFromKey ──
ok(pascalFromKey('user') === 'User', 'user→User')
ok(pascalFromKey('user_profile') === 'UserProfile', 'snake→Pascal')
ok(pascalFromKey('userProfile') === 'UserProfile', 'camel→Pascal')
ok(pascalFromKey('user-name') === 'UserName', 'kebab→Pascal')
ok(pascalFromKey('123') === '_123', '數字開頭加底線')
ok(pascalFromKey('') === 'Field', '空→Field')

// ── 基本物件 ──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('using System.Collections.Generic;'), 'using List')
ok(c1.includes('using System.Text.Json.Serialization;'), 'using System.Text.Json')
ok(c1.includes('public class Root'), 'Root class')
ok(c1.includes('public long Id { get; set; }'), 'long 屬性')
ok(c1.includes('public string Name { get; set; }'), 'string 屬性')
ok(c1.includes('public bool Active { get; set; }'), 'bool 屬性')
ok(c1.includes('public double Score { get; set; }'), 'double 屬性')
// id→Id 與鍵不同 → 屬性標註
ok(c1.includes('[JsonPropertyName("id")]'), 'JsonPropertyName for id')

// ── Newtonsoft 標註 ──
const c2 = gen('{"userName":"a"}', { jsonLib: 'newtonsoft' })
ok(c2.includes('using Newtonsoft.Json;'), 'using Newtonsoft')
ok(c2.includes('[JsonProperty("userName")]'), 'JsonProperty 標註')
ok(c2.includes('public string UserName { get; set; }'), 'Pascal 屬性名')

// ── 無標註庫 ──
const c3 = gen('{"userName":"a"}', { jsonLib: 'none' })
ok(!c3.includes('using System.Text.Json') && !c3.includes('Newtonsoft'), 'none 不匯入 json 庫')
ok(c3.includes('// JSON 鍵: userName'), 'none 用註解標原鍵')
ok(!c3.includes('[Json'), 'none 無屬性標註')

// ── record 樣式 ──
const c4 = gen('{"id":1}', { style: 'record' })
ok(c4.includes('public record Root'), 'record 關鍵字')
ok(c4.includes('public long Id { get; init; }'), 'record 用 init')

// ── null → nullable / object ──
const c5 = gen('{"a":null,"b":"x"}')
ok(c5.includes('public object A { get; set; }'), '全 null → object')
const c5b = gen('[{"a":1},{"a":null}]')
ok(c5b.includes('public long? A { get; set; }'), 'null 出現 → long?')
// 參考型別 nullable 不加 ?(預設可空)
const c5c = gen('[{"a":"x"},{"a":null}]')
ok(c5c.includes('public string A { get; set; }'), 'string nullable 不加 ?')

// ── 巢狀物件 → 另一個類別 ──
const c6 = gen('{"user":{"id":1,"name":"a"},"count":3}')
ok(c6.includes('public class User'), '巢狀產生 User 類別')
ok(c6.includes('public User User { get; set; }'), '屬性引用 User')
ok(c6.indexOf('public class User') < c6.indexOf('public class Root'), '葉節點類別在前')

// ── 陣列合併欄位 + 缺鍵 nullable ──
const c7 = gen('{"items":[{"x":1,"y":2},{"x":3}]}')
ok(c7.includes('public class Item'), '陣列元素單數化類別 Item')
ok(c7.includes('public List<Item> Items { get; set; }'), 'List<Item>')
ok(c7.includes('public long? Y { get; set; }'), '缺鍵 → long?')

// ── 字串陣列 ──
const c8 = gen('{"tags":["a","b"]}')
ok(c8.includes('public List<string> Tags { get; set; }'), 'List<string>')

// ── int+float → double ──
const c9 = gen('[{"v":1},{"v":2.5}]')
ok(c9.includes('public double V { get; set; }'), 'int+float → double')

// ── 型別衝突 → object ──
const c10 = gen('[{"v":1},{"v":"x"}]')
ok(c10.includes('public object V { get; set; }'), '衝突 → object')

// ── namespace 包覆 ──
const c11 = gen('{"id":1}', { namespace: 'MyApp.Models' })
ok(c11.includes('namespace MyApp.Models'), 'namespace 宣告')
ok(c11.includes('    public class Root'), 'namespace 內縮排')

// ── 根為陣列 / 純量 ──
const c12 = gen('[{"id":1}]')
ok(c12.includes('public class RootItem'), '根陣列元素 RootItem')
ok(c12.includes('// 根為陣列,請直接用 List<RootItem>'), '根陣列提示')
const c13 = gen('42')
ok(c13.includes('// 根為純量,型別為 long'), '根純量提示')

// ── 自訂根名 ──
const c14 = gen('{"id":1}', { rootName: 'Person' })
ok(c14.includes('public class Person'), '自訂根名')

// ── 物件欄位各依鍵名成類別 ──
const c15 = gen('{"a":{"x":1},"b":{"x":1}}')
ok(c15.includes('public class A') && c15.includes('public class B'), '各鍵名各一類別')
// ── 同 baseName 不同結構 → 加序號 ──
const c16 = gen('{"point":{"x":1},"points":[{"x":1,"y":2}]}')
ok(c16.includes('public class Point\n') && c16.includes('public class Point1'), '同名不同結構加序號')

// ── 解析錯誤 ──
const r = jsonToCsharp('{bad}')
ok(!r.ok && r.error.includes('JSON 解析失敗'), '壞 JSON 回報錯誤')

console.log(`\njson-to-csharp: ${pass} 通過, ${fail} 失敗`)
if (fail) process.exit(1)
