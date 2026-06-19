/*
  .env ↔ JSON / shell 引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-dotenv.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `dotenv-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/dotenv.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseDotenv, stringifyDotenv, stringifyShell, pairsToJson, jsonToPairs } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}
const obj = (text) => JSON.parse(pairsToJson(parseDotenv(text).pairs))

// --- 基本解析 ---
check('簡單鍵值', obj('A=1\nB=hello').A === '1' && obj('A=1\nB=hello').B === 'hello')
check('空白行/註解略過', parseDotenv('# c\n\nA=1\n  # d\nB=2').pairs.length === 2)
check('export 前綴', obj('export PORT=3000').PORT === '3000')
check('值前後空白去除', obj('A =  hi  ').A === 'hi')
check('= 兩側空白', obj('  A = b ').A === 'b')

// --- 引號 ---
check('雙引號保留空白', obj('A="hello world"').A === 'hello world')
check('雙引號跳脫換行', obj('A="line1\\nline2"').A === 'line1\nline2')
check('雙引號跳脫 tab/quote', obj('A="a\\tb\\"c"').A === 'a\tb"c')
check('單引號字面值', obj("A='no\\nescape'").A === 'no\\nescape')
check('單引號保留 #', obj("A='a#b'").A === 'a#b')

// --- 行內註解 ---
check('無引號去行內註解', obj('A=value # comment').A === 'value')
check('值內 # 無前空白不算註解', obj('A=ab#cd').A === 'ab#cd')
check('雙引號內 # 保留', obj('A="a # b"').A === 'a # b')

// --- 錯誤處理 ---
check('無 = 報錯且續行', (() => {
  const r = parseDotenv('A=1\nNOTVALID\nB=2')
  return r.pairs.length === 2 && r.errors.length === 1
})())
check('非法鍵名報錯', parseDotenv('1BAD=x').errors.length === 1 && parseDotenv('1BAD=x').pairs.length === 0)
check('雙引號未結束報錯', parseDotenv('A="oops').errors.length === 1)
check('同名後者覆蓋', obj('A=1\nA=2').A === '2')
check('空值', obj('A=').A === '')

// --- 序列化 .env ---
check('序列化:單純值不加引號', stringifyDotenv([{ key: 'A', value: 'bcd' }]) === 'A=bcd')
check('序列化:含空白加引號', stringifyDotenv([{ key: 'A', value: 'b c' }]) === 'A="b c"')
check('序列化:含換行跳脫', stringifyDotenv([{ key: 'A', value: 'a\nb' }]) === 'A="a\\nb"')
check('序列化:空值加引號', stringifyDotenv([{ key: 'A', value: '' }]) === 'A=""')
check('序列化:含 # 加引號', stringifyDotenv([{ key: 'A', value: 'a#b' }]) === 'A="a#b"')

// --- 往返一致 ---
const round = 'A=1\nB="hello world"\nC="x\\ny"\nD=plain'
check('往返一致(.env→pairs→.env→pairs)', (() => {
  const p1 = parseDotenv(round).pairs
  const p2 = parseDotenv(stringifyDotenv(p1)).pairs
  return JSON.stringify(p1) === JSON.stringify(p2)
})())

// --- shell ---
check('shell export 基本', stringifyShell([{ key: 'A', value: 'b' }]) === "export A='b'")
check('shell 單引號脫逸', stringifyShell([{ key: 'A', value: "a'b" }]) === "export A='a'\\''b'")

// --- JSON → pairs ---
check('JSON→pairs 字串', jsonToPairs('{"A":"1","B":"two"}').pairs.length === 2)
check('JSON→pairs 數字/布林轉字串', (() => {
  const r = jsonToPairs('{"N":3000,"B":true}')
  return r.pairs[0].value === '3000' && r.pairs[1].value === 'true'
})())
check('JSON→pairs null 轉空字串', jsonToPairs('{"A":null}').pairs[0].value === '')
check('JSON→pairs 陣列報錯', jsonToPairs('[1,2]').error !== '')
check('JSON→pairs 巢狀物件報錯', jsonToPairs('{"A":{"x":1}}').error !== '')
check('JSON→pairs 壞語法報錯', jsonToPairs('{bad}').error !== '')
check('JSON→pairs 非法鍵名報錯', jsonToPairs('{"1x":"a"}').error !== '')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
