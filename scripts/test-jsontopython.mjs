// JSON → Python 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontopy-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToPython.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToPython, classNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToPython, classNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToPython(j, o).code

// ── classNameFromKey ──
ok(classNameFromKey('user') === 'User', 'user→User')
ok(classNameFromKey('user_profile') === 'UserProfile', 'snake→Pascal')
ok(classNameFromKey('userProfile') === 'UserProfile', 'camel→Pascal')
ok(classNameFromKey('123') === '_123', '數字開頭加底線')

// ── 基本物件 ──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('@dataclass'), 'dataclass 裝飾器')
ok(c1.includes('class Root:'), 'Root 類別')
ok(c1.includes('id: int'), 'int 欄位')
ok(c1.includes('name: str'), 'str 欄位')
ok(c1.includes('active: bool'), 'bool 欄位')
ok(c1.includes('score: float'), 'float 欄位')
ok(c1.includes('from __future__ import annotations'), 'future annotations')

// ── null → Optional ──
const c2 = gen('{"a":null,"b":"x"}')
ok(c2.includes('a: Any'), '全 null → Any')
const c2b = gen('[{"a":1},{"a":null}]')
ok(c2b.includes('a: Optional[int]'), 'null 出現 → Optional[int]')
ok(c2b.includes('from typing import') && c2b.includes('Optional'), '匯入 Optional')

// ── 巢狀物件 → 另一個類別 ──
const c3 = gen('{"user":{"id":1,"name":"a"},"count":3}')
ok(c3.includes('class User:'), '巢狀產生 User 類別')
ok(c3.includes('user: User'), '欄位引用 User')
ok(c3.indexOf('class User:') < c3.indexOf('class Root:'), '葉節點類別在前')

// ── 陣列合併欄位 + 缺鍵 Optional ──
const c4 = gen('{"items":[{"x":1,"y":2},{"x":3}]}')
ok(c4.includes('class Item:'), '陣列元素單數化類別 Item')
ok(c4.includes('items: List[Item]'), 'List[Item]')
ok(c4.includes('x: int'), '共同欄位 x')
ok(c4.includes('y: Optional[int]'), '缺鍵欄位 → Optional')
ok(c4.includes('List') && c4.includes('from typing import'), '匯入 List')

// ── int + float 混合 → float ──
ok(gen('{"v":[1,2.5]}').includes('v: List[float]'), 'int+float → float')

// ── 根為陣列 → 別名 ──
const c5 = gen('[{"id":1}]')
ok(c5.includes('Root = List['), '根陣列 → Root = List[...]')
ok(c5.includes('class Root:') === false || c5.includes('Root = List['), '根陣列用別名而非類別')

// ── 根為純量 ──
ok(gen('42').includes('Root = int'), '純量根 → Root = int')
ok(gen('"hi"').includes('Root = str'), '純量字串根')

// ── 空物件 → pass ──
ok(gen('{}').includes('class Root:') && gen('{}').includes('pass'), '空物件 → pass')

// ── 不合法鍵名 sanitize + 註解 ──
const c6 = gen('{"first-name":"a","2nd":"b"}')
ok(c6.includes('first_name: str') && c6.includes('# JSON 鍵: first-name'), '連字號鍵 sanitize + 註解')
ok(c6.includes('_2nd') || c6.includes('field_'), '數字開頭鍵處理')

// ── TypedDict 樣式 ──
const td = gen('{"id":1}', { style: 'typeddict' })
ok(td.includes('class Root(TypedDict):'), 'TypedDict 基底')
ok(td.includes('TypedDict') && td.includes('from typing import'), '匯入 TypedDict')
ok(!td.includes('@dataclass'), 'TypedDict 無 dataclass 裝飾')

// ── Pydantic 樣式 ──
const pyd = gen('{"id":1}', { style: 'pydantic' })
ok(pyd.includes('class Root(BaseModel):'), 'Pydantic 基底')
ok(pyd.includes('from pydantic import BaseModel'), '匯入 BaseModel')

// ── 重用同結構類別 ──
const c7 = gen('{"a":{"id":1},"b":{"id":2}}')
const userCount = (c7.match(/class [A-Za-z0-9_]+:/g) || []).length
ok(userCount >= 2, '至少 Root + 一個子類別')

// ── 自訂根名稱 ──
ok(gen('{"id":1}', { rootName: 'Person' }).includes('class Person:'), '自訂 rootName')

// ── 不匯入未使用的 typing ──
ok(!gen('{"id":1}').includes('Optional'), '無 Optional 時不匯入')
ok(!gen('{"id":1}').includes('List'), '無 List 時不匯入')

// ── 解析錯誤 ──
const bad = jsonToPython('{bad}')
ok(!bad.ok && bad.error.includes('解析失敗'), '無效 JSON 報錯')

console.log(`jsontopython: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
