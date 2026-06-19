/*
  INI ↔ JSON 引擎回歸測試。執行:node scripts/test-ini.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ini-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ini.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseIni, stringifyIni, iniToJson, jsonToIni } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (!cond) {
    fail++
    console.error('❌', note)
  } else {
    console.log('✓', note)
  }
}
const obj = (text) => JSON.parse(iniToJson(text).json)

// --- 解析:區段與鍵值 ---
check('區段內鍵值', (() => {
  const o = obj('[db]\nhost=localhost\nport=5432')
  return o.db.host === 'localhost' && o.db.port === '5432'
})())
check('根層鍵(區段前)', (() => {
  const o = obj('name=app\n[db]\nhost=x')
  return o.name === 'app' && o.db.host === 'x'
})())
check('冒號分隔也可', obj('[s]\na: b').s.a === 'b')

// --- 註解 / 空白 ---
check('; 與 # 註解略過', (() => {
  const o = obj('; comment\n# c2\n[s]\na=1')
  return Object.keys(o).length === 1 && o.s.a === '1'
})())
check('值前後空白去除', obj('[s]\na =  hi  ').s.a === 'hi')

// --- 引號 ---
check('去除雙引號', obj('[s]\na="hello world"').s.a === 'hello world')
check('去除單引號', obj("[s]\na='x'").s.a === 'x')
check('值含 = 只切第一個', obj('[s]\nurl=a=b=c').s.url === 'a=b=c')

// --- 覆蓋 / 重複區段 ---
check('同鍵後者覆蓋', obj('[s]\na=1\na=2').s.a === '2')
check('重複區段合併', (() => {
  const o = obj('[s]\na=1\n[s]\nb=2')
  return o.s.a === '1' && o.s.b === '2'
})())

// --- 錯誤處理 ---
check('區段缺 ] 報錯', parseIni('[s\na=1').errors.length === 1)
check('無 = 報錯且續行', (() => {
  const r = parseIni('[s]\nbadline\na=1')
  return r.errors.length === 1 && r.data.s.a === '1'
})())
check('空區段名報錯', parseIni('[]\na=1').errors.length >= 1)

// --- 序列化 INI ---
check('序列化:根鍵在前、區段在後', (() => {
  const { ini } = stringifyIni({ name: 'app', db: { host: 'x' } })
  return ini.indexOf('name=app') < ini.indexOf('[db]')
})())
check('序列化:前後空白加引號(避免被 trim 掉)', stringifyIni({ s: { a: ' x ' } }).ini.includes('a=" x "'))
check('序列化:內部空白不需引號(INI 讀到行尾)', (() => {
  const { ini } = stringifyIni({ s: { a: 'b c' } })
  return ini.includes('a=b c') && obj(ini).s.a === 'b c'
})())
check('序列化:單純值不加引號', stringifyIni({ s: { a: 'bcd' } }).ini.includes('a=bcd'))
check('序列化:數字/布林轉字串', (() => {
  const { ini } = stringifyIni({ s: { p: 3000, d: true } })
  return ini.includes('p=3000') && ini.includes('d=true')
})())

// --- 往返一致 ---
check('往返一致 INI→JSON→INI→JSON', (() => {
  const src = '[db]\nhost=localhost\nport=5432\n[app]\nname="my app"'
  const o1 = obj(src)
  const back = jsonToIni(JSON.stringify(o1)).ini
  const o2 = obj(back)
  return JSON.stringify(o1) === JSON.stringify(o2)
})())

// --- JSON → INI ---
check('JSON→INI 基本', jsonToIni('{"s":{"a":"1"}}').ini.includes('[s]') && jsonToIni('{"s":{"a":"1"}}').ini.includes('a=1'))
check('JSON→INI 陣列報錯', jsonToIni('{"a":[1,2]}').error !== '')
check('JSON→INI 巢狀過深報錯', jsonToIni('{"s":{"a":{"x":1}}}').error !== '')
check('JSON→INI 壞語法報錯', jsonToIni('{bad}').error !== '')
check('JSON→INI 頂層非物件報錯', jsonToIni('[1,2]').error !== '')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
