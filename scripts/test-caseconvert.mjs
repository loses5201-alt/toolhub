/*
  命名格式轉換引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-caseconvert.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `caseconvert-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/caseConvert.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { splitWords, convertCase, convertLines, convertAll, CASE_FORMATS } = await import(
  'file://' + out
)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${g}\n   want: ${w}`)
  }
}

// --- splitWords ---
eq('空字串拆字回空陣列', splitWords(''), [])
eq('camelCase 拆字', splitWords('myVariableName'), ['my', 'Variable', 'Name'])
eq('PascalCase 拆字', splitWords('MyVariableName'), ['My', 'Variable', 'Name'])
eq('snake_case 拆字', splitWords('my_variable_name'), ['my', 'variable', 'name'])
eq('kebab-case 拆字', splitWords('my-variable-name'), ['my', 'variable', 'name'])
eq('dot.case 拆字', splitWords('my.variable.name'), ['my', 'variable', 'name'])
eq('path/case 拆字', splitWords('my/variable/name'), ['my', 'variable', 'name'])
eq('混合分隔符', splitWords('foo_bar-baz.qux'), ['foo', 'bar', 'baz', 'qux'])
eq('多重分隔符視為一個', splitWords('a___b--c'), ['a', 'b', 'c'])
eq('縮寫接一般字 HTMLParser', splitWords('HTMLParser'), ['HTML', 'Parser'])
eq('縮寫在中間 parseHTMLNow', splitWords('parseHTMLNow'), ['parse', 'HTML', 'Now'])
eq('字母接數字不拆', splitWords('version2'), ['version2'])
eq('數字接大寫拆', splitWords('v2Test'), ['v2', 'Test'])
eq('前後空白', splitWords('  hello world  '), ['hello', 'world'])
eq('全大寫縮寫單字', splitWords('API'), ['API'])

// --- convertCase 各格式 ---
const src = 'my variable name'
eq('camel', convertCase(src, 'camel'), 'myVariableName')
eq('pascal', convertCase(src, 'pascal'), 'MyVariableName')
eq('snake', convertCase(src, 'snake'), 'my_variable_name')
eq('constant', convertCase(src, 'constant'), 'MY_VARIABLE_NAME')
eq('kebab', convertCase(src, 'kebab'), 'my-variable-name')
eq('cobol', convertCase(src, 'cobol'), 'MY-VARIABLE-NAME')
eq('train', convertCase(src, 'train'), 'My-Variable-Name')
eq('dot', convertCase(src, 'dot'), 'my.variable.name')
eq('path', convertCase(src, 'path'), 'my/variable/name')
eq('title', convertCase(src, 'title'), 'My Variable Name')
eq('sentence', convertCase(src, 'sentence'), 'My variable name')
eq('lower', convertCase(src, 'lower'), 'my variable name')
eq('upper', convertCase(src, 'upper'), 'MY VARIABLE NAME')

// --- 跨格式互轉(camel → 各式)---
eq('camel→snake', convertCase('getUserId', 'snake'), 'get_user_id')
eq('snake→camel', convertCase('get_user_id', 'camel'), 'getUserId')
eq('constant→kebab', convertCase('MAX_RETRY_COUNT', 'kebab'), 'max-retry-count')
eq('kebab→pascal', convertCase('background-color', 'pascal'), 'BackgroundColor')

// --- 縮寫在 Pascal 會被正規化(記錄行為)---
eq('縮寫 Pascal 正規化', convertCase('HTMLParser', 'pascal'), 'HtmlParser')
eq('縮寫 constant', convertCase('HTMLParser', 'constant'), 'HTML_PARSER')

// --- 空輸入 ---
eq('空輸入各格式回空', convertCase('', 'camel'), '')
eq('純分隔符回空', convertCase('___', 'snake'), '')

// --- convertLines 批次 ---
eq(
  '逐行轉 snake',
  convertLines('fooBar\nbazQux', 'snake'),
  'foo_bar\nbaz_qux',
)
eq('空白行原樣保留', convertLines('fooBar\n\nbazQux', 'snake'), 'foo_bar\n\nbaz_qux')
eq('行內前後空白不影響', convertLines('  fooBar  ', 'kebab'), 'foo-bar')
eq('全空輸入', convertLines('', 'camel'), '')

// --- convertAll ---
const all = convertAll('user name')
eq('convertAll camel', all.camel, 'userName')
eq('convertAll constant', all.constant, 'USER_NAME')
eq('convertAll 涵蓋所有格式', Object.keys(all).sort(), CASE_FORMATS.map((f) => f.id).sort())
eq('convertAll 空輸入全空', Object.values(convertAll('')).every((v) => v === ''), true)

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
}
console.log('\n全部通過')
