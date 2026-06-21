/*
  PHP serialize() 解碼引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-phpserialize.mjs
  oracle:依 PHP serialize() 官方格式手構的序列化字串(可用 PHP serialize() 互相印證),逐項比對型別與值。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `php-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/phpSerialize.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parsePhpInput, decodePhp, phpToJson } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}
// 把序列化字串解析成頂層節點
const top = (s) => decodePhp(parsePhpInput(s).bytes).node
const dec = (s) => decodePhp(parsePhpInput(s).bytes)
const toJson = (s) => phpToJson(top(s))

// --- 純量 ---
check('N; → null', top('N;').type === 'null')
check('b:1; → bool true', top('b:1;').type === 'bool' && top('b:1;').value === 'true')
check('b:0; → bool false', top('b:0;').value === 'false')
check('i:42; → int 42', top('i:42;').type === 'int' && top('i:42;').value === '42')
check('i:-7; → int -7', top('i:-7;').value === '-7')
check('i:0; → int 0', top('i:0;').value === '0')
check('d:3.14; → float 3.14', top('d:3.14;').type === 'float' && top('d:3.14;').value === '3.14')
check('d:-0.5; → float -0.5', top('d:-0.5;').value === '-0.5')
check('d:INF; → float INF', top('d:INF;').value === 'INF')

// --- 字串(位元組長度)---
check('s:5:"hello"; → hello', top('s:5:"hello";').type === 'string' && top('s:5:"hello";').value === 'hello')
check('s:0:""; → 空字串', top('s:0:"";').value === '')
// "日本" = 6 個 UTF-8 位元組(每個漢字 3 byte)
check('s:6:"日本"; → 日本(位元組長度正確)', top('s:6:"日本";').value === '日本')
check('字串內含分號 s:3:"a;b"', top('s:3:"a;b";').value === 'a;b')
check('字串內含雙引號 s:3:"a"b"', top('s:3:"a"b";').value === 'a"b')

// --- array(連續整數鍵)---
{
  const n = top('a:2:{i:0;s:1:"a";i:1;s:1:"b";}')
  check('a:2 連續整數鍵 → array 兩筆', n.type === 'array' && n.entries.length === 2)
  check('array 第一筆鍵 0 值 a', n.entries[0].key.value === '0' && n.entries[0].value.value === 'a')
  check('array 第二筆鍵 1 值 b', n.entries[1].key.value === '1' && n.entries[1].value.value === 'b')
}
// --- array(關聯陣列)---
{
  const n = top('a:1:{s:3:"key";i:9;}')
  check('關聯陣列鍵 key 值 9', n.entries[0].key.value === 'key' && n.entries[0].value.value === '9')
}
// --- 空 array ---
check('a:0:{} → 空陣列', top('a:0:{}').type === 'array' && top('a:0:{}').entries.length === 0)

// --- 巢狀 array ---
{
  const n = top('a:1:{s:4:"list";a:2:{i:0;i:1;i:1;i:2;}}')
  check('巢狀陣列型別正確', n.entries[0].value.type === 'array')
  check('巢狀陣列內含兩筆', n.entries[0].value.entries.length === 2)
  check('巢狀陣列值 1,2', n.entries[0].value.entries[0].value.value === '1' && n.entries[0].value.entries[1].value.value === '2')
}

// --- object ---
{
  const n = top('O:3:"Foo":1:{s:3:"bar";i:1;}')
  check('O → object 型別', n.type === 'object')
  check('object 類別名 Foo', n.className === 'Foo')
  check('object 屬性 bar=1', n.entries[0].key.value === 'bar' && n.entries[0].value.value === '1')
}
// --- object 含 protected / private 屬性 ---
{
  // protected 屬性鍵 = \0*\0secret(長度 10:NUL + * + NUL + secret(6)= 9... 實際 "\0*\0secret" = 1+1+1+6 = 9 byte)
  const key = '\u0000*\u0000secret'
  const ser = `O:3:"Foo":1:{s:${new TextEncoder().encode(key).length}:"${key}";i:5;}`
  const n = top(ser)
  check('protected 屬性名去除標記 → secret', n.entries[0].key.value === 'secret')
  check('protected 可見性標註', n.entries[0].visibility === 'protected')
}
{
  const key = '\u0000Foo\u0000pwd'
  const ser = `O:3:"Foo":1:{s:${new TextEncoder().encode(key).length}:"${key}";s:1:"x";}`
  const n = top(ser)
  check('private 屬性名去除標記 → pwd', n.entries[0].key.value === 'pwd')
  check('private 可見性標註含類別', n.entries[0].visibility === 'private(Foo)')
}

// --- reference ---
check('R:1; → ref', top('R:1;').type === 'ref' && top('R:1;').value.includes('#1'))
check('r:2; → ref', top('r:2;').type === 'ref')

// --- custom(Serializable)---
{
  const n = top('C:3:"Obj":4:{abcd}')
  check('C → custom 型別', n.type === 'custom' && n.className === 'Obj')
  check('custom 原始資料 abcd', n.value === 'abcd')
}

// --- 尾端多餘資料 ---
check('尾端多餘位元組偵測', dec('i:1;XYZ').trailing === 3)
check('無尾端多餘', dec('i:1;').trailing === 0)

// --- 錯誤路徑 ---
check('截斷字串報錯', dec('s:5:"ab";').error !== undefined)
check('未知標記報錯', dec('X:1;').error !== undefined)
check('字串缺結尾分號報錯', dec('s:2:"ab"').error !== undefined)
check('bool 非 0/1 報錯', dec('b:2;').error !== undefined)
check('整數欄位非數字報錯', dec('i:abc;').error !== undefined)
// 容器內部分失敗仍保留已解析節點
{
  const r = dec('a:2:{i:0;i:1;i:1;s:5:"ab";}')
  check('容器部分失敗仍回頂層 array', r.node && r.node.type === 'array')
  check('容器部分失敗標記 error', r.node.error !== undefined)
}

// --- phpToJson ---
check('toJson 連續整數鍵 → 陣列', JSON.stringify(toJson('a:2:{i:0;s:1:"a";i:1;s:1:"b";}')) === '["a","b"]')
check('toJson 關聯陣列 → 物件', JSON.stringify(toJson('a:1:{s:3:"key";i:9;}')) === '{"key":9}')
check('toJson bool/int/null', JSON.stringify(toJson('a:3:{i:0;b:1;i:1;N;i:2;i:5;}')) === '[true,null,5]')
check('toJson 物件含 __class__', toJson('O:3:"Foo":1:{s:1:"a";i:1;}').__class__ === 'Foo')
check('toJson 巢狀', JSON.stringify(toJson('a:1:{s:1:"x";a:2:{i:0;i:1;i:1;i:2;}}')) === '{"x":[1,2]}')

// --- base64 包裝偵測 ---
{
  const b64 = Buffer.from('i:7;', 'utf8').toString('base64')
  const r = parsePhpInput(b64)
  check('base64 包裝自動偵測', r.source === 'base64')
  check('base64 解出 i:7', decodePhp(r.bytes).node.value === '7')
}
check('純文字來源標記', parsePhpInput('i:7;').source === 'text')

// --- byteLength 記錄 ---
check('頂層 byteLength = 輸入長度', top('i:42;').byteLength === 5)

if (fail) { console.error(`\n${fail} 個測試失敗`); process.exit(1) }
console.log('\n全部 PHP serialize 測試通過')
