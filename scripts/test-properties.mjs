/*
  Java .properties 引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-properties.mjs
  oracle:java.util.Properties 文件中的解析規則與已知向量。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `properties-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/properties.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseProperties, jsonToProperties, propertiesToJson, logicalLines } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const P = (t) => parseProperties(t).data
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// --- 三種分隔符 ---
check('= 分隔', P('a=1').a === '1')
check(': 分隔', P('a:1').a === '1')
check('空白分隔', P('a 1').a === '1')
check('分隔符前後空白略過', P('  a   =   1').a === '1')
check('值保留中間空白', P('key = value here').key === 'value here')
check('值保留尾端空白(Java 不 trim 尾端)', P('a = 1  ').a === '1  ')

// --- 註解與空白行 ---
check('# 註解略過', eq(P('# comment\na=1'), { a: '1' }))
check('! 註解略過', eq(P('! comment\na=1'), { a: '1' }))
check('前導空白後的註解也略過', eq(P('   # c\na=1'), { a: '1' }))
check('空白行略過', eq(P('\n\na=1\n\n'), { a: '1' }))

// --- 跳脫 ---
check('\\t → tab', P('a=x\\ty').a === 'x\ty')
check('\\n → newline', P('a=x\\ny').a === 'x\ny')
check('\\\\ → 反斜線', P('a=x\\\\y').a === 'x\\y')
check('\\uXXXX → 中文', P('msg=\\u4f60\\u597d').msg === '你好')
check('\\= 在鍵中為字面 =', eq(P('a\\=b=v'), { 'a=b': 'v' }))
check('\\: 在鍵中為字面 :', eq(P('a\\:b=v'), { 'a:b': 'v' }))
check('鍵中跳脫空白', eq(P('a\\ b=v'), { 'a b': 'v' }))
check('值中未跳脫的 = 保留', P('url=http://a?x=1').url === 'http://a?x=1')
check('不合法 \\u 退化為 u', P('a=\\uZZ').a === 'uZZ')

// --- 續行 ---
check('反斜線續行', P('a=hello \\\nworld').a === 'hello world')
check('續行丟棄前導空白', P('a=one\\\n   two').a === 'onetwo')
check('偶數反斜線不續行', eq(logicalLines('a=x\\\\'), ['a=x\\\\']))
check('奇數反斜線續行', eq(logicalLines('a=x\\\nb'), ['a=xb']))

// --- 後鍵覆蓋 ---
check('重複鍵後者覆蓋', P('a=1\na=2').a === '2')

// --- 空值 ---
check('只有鍵無值 → 空字串', P('a=').a === '')
check('鍵後只有空白 → 空字串', P('a   ').a === '')

// --- propertiesToJson ---
const pj = propertiesToJson('name=ToolHub\nver=1.0')
check('propertiesToJson 正確', eq(JSON.parse(pj.text), { name: 'ToolHub', ver: '1.0' }))

// --- jsonToProperties ---
const jp = jsonToProperties('{"a":"1","b":"hi there"}')
check('jsonToProperties 基本', jp.text === 'a=1\nb=hi there')
check(
  'jsonToProperties 跳脫特殊字元',
  jsonToProperties('{"a:b":"x=y"}').text === 'a\\:b=x\\=y',
)
check(
  'jsonToProperties 換行跳脫',
  jsonToProperties('{"a":"line1\\nline2"}').text === 'a=line1\\nline2',
)
check(
  'jsonToProperties 鍵中空白跳脫',
  jsonToProperties('{"a b":"v"}').text === 'a\\ b=v',
)
check(
  'jsonToProperties 值前導空白跳脫、中間不跳脫',
  jsonToProperties('{"k":" a b"}').text === 'k=\\ a b',
)
check(
  'jsonToProperties 數字/布林轉字串',
  jsonToProperties('{"n":3,"ok":true}').text === 'n=3\nok=true',
)
check('jsonToProperties 非物件報錯', jsonToProperties('[1,2]').ok === false)
check('jsonToProperties 壞 JSON 報錯', jsonToProperties('{bad}').ok === false)

// --- 來回轉換穩定 ---
const original = 'app.name=My App\napp.url=http\\://x?a\\=1\nmsg=\\u4f60\\u597d'
const roundtrip = jsonToProperties(propertiesToJson(original).text).text
const reparsed = parseProperties(roundtrip).data
check(
  '來回轉換語意一致',
  eq(reparsed, { 'app.name': 'My App', 'app.url': 'http://x?a=1', msg: '你好' }),
)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
