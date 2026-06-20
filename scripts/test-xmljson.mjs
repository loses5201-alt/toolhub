/*
  XML ↔ JSON 轉換引擎回歸測試(node 直接跑)。
  執行:node scripts/test-xmljson.mjs
  oracle:以 "@屬性 / #text" 慣例的明確語意手構樣本逐筆比對,並驗證往返一致。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `xmljson-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/xmlJson.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { xmlToJson, jsonToXml } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
// XML → JSON,比對解析後的物件(避免縮排細節影響)
function x2j(xml, expectedObj, msg, opts) {
  const r = xmlToJson(xml, opts)
  if (!r.ok) {
    fail++
    console.error(`✗ FAIL: ${msg} — 轉換失敗:${r.error}`)
    return
  }
  const got = JSON.stringify(JSON.parse(r.output))
  const want = JSON.stringify(expectedObj)
  if (got === want) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n--- got ---\n${got}\n--- want ---\n${want}`)
  }
}
// JSON → XML,比對輸出字串
function j2x(json, expected, msg, opts) {
  const r = jsonToXml(typeof json === 'string' ? json : JSON.stringify(json), opts)
  if (!r.ok) {
    fail++
    console.error(`✗ FAIL: ${msg} — 轉換失敗:${r.error}`)
    return
  }
  if (r.output === expected) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n--- got ---\n${r.output}\n--- want ---\n${expected}`)
  }
}

// ---- XML → JSON ----
x2j('<note><to>Tove</to><from>Jani</from></note>', { note: { to: 'Tove', from: 'Jani' } }, '基本巢狀元素')
x2j('<a/>', { a: '' }, '自關閉空元素 → 空字串')
x2j('<a></a>', { a: '' }, '空元素 → 空字串')
x2j('<book id="1" lang="en">Title</book>', { book: { '@id': '1', '@lang': 'en', '#text': 'Title' } }, '屬性 + 文字')
x2j('<list><item>a</item><item>b</item><item>c</item></list>', { list: { item: ['a', 'b', 'c'] } }, '同名重複子元素 → 陣列')
x2j('<r><a>1</a><b>2</b><a>3</a></r>', { r: { a: ['1', '3'], b: '2' } }, '交錯同名仍合併成陣列')
x2j('<p>hello <b>world</b></p>', { p: { b: 'world', '#text': 'hello' } }, '混合文字與子元素')
x2j('<img src="x.png"/>', { img: { '@src': 'x.png' } }, '只有屬性的自關閉元素')
x2j('<x>&lt;a&gt; &amp; &quot;b&quot;</x>', { x: '<a> & "b"' }, '文字實體解碼')
x2j('<x a="&amp;&lt;"/>', { x: { '@a': '&<' } }, '屬性實體解碼')
x2j('<x><![CDATA[ <raw> & ]]></x>', { x: '<raw> &' }, 'CDATA 視為文字')
x2j('<!-- c --><root><a>1</a></root>', { root: { a: '1' } }, '略過註解')
x2j('<?xml version="1.0"?><root>x</root>', { root: 'x' }, '略過處理指令')
x2j('<ns:tag ns:id="5">v</ns:tag>', { 'ns:tag': { '@ns:id': '5', '#text': 'v' } }, '命名空間前綴原樣保留')
// parseValues 數值/布林強制轉型
x2j('<r><n>123</n><f>1.5</f><b>true</b><z>0</z></r>', { r: { n: 123, f: 1.5, b: true, z: 0 } }, 'parseValues 轉數字/布林', { parseValues: true })
x2j('<r><phone>0912345678</phone><id>007</id></r>', { r: { phone: '0912345678', id: '007' } }, 'parseValues 不破壞前導零', { parseValues: true })
x2j('<r><n>123</n></r>', { r: { n: '123' } }, '預設不轉型(字串)')
// 自訂前綴 / textKey
x2j('<b id="1">t</b>', { b: { $id: '1', _text: 't' } }, '自訂 attrPrefix / textKey', { attrPrefix: '$', textKey: '_text' })

// ---- 錯誤處理 ----
ok(!xmlToJson('<a></b>').ok, '標籤不相符應失敗')
ok(!xmlToJson('<a><b></a>').ok, '巢狀不相符應失敗')
ok(!xmlToJson('<a>').ok, '未關閉標籤應失敗')
ok(!xmlToJson('</a>').ok, '多出結束標籤應失敗')
ok(!xmlToJson('<!-- x').ok, '未結束註解應失敗')
ok(!xmlToJson('   ').ok, '無元素應失敗')

// ---- JSON → XML ----
j2x({ note: { to: 'Tove', from: 'Jani' } }, '<note>\n  <to>Tove</to>\n  <from>Jani</from>\n</note>', '基本巢狀')
j2x({ a: '' }, '<a/>', '空字串 → 自關閉')
j2x({ a: null }, '<a/>', 'null → 自關閉')
j2x({ book: { '@id': '1', '@lang': 'en', '#text': 'Title' } }, '<book id="1" lang="en">Title</book>', '屬性 + 文字單行')
j2x({ list: { item: ['a', 'b', 'c'] } }, '<list>\n  <item>a</item>\n  <item>b</item>\n  <item>c</item>\n</list>', '陣列 → 重複元素')
j2x({ x: '<a> & "b"' }, '<x>&lt;a&gt; &amp; "b"</x>', '文字跳脫')
j2x({ x: { '@a': '"&<' } }, '<x a="&quot;&amp;&lt;"/>', '屬性跳脫')
j2x({ n: 123, b: true }, '<root>\n  <n>123</n>\n  <b>true</b>\n</root>', '多頂層鍵 → 包根元素')
j2x({ data: { n: 5, b: false } }, '<data>\n  <n>5</n>\n  <b>false</b>\n</data>', '數字/布林轉文字')
j2x({ p: { '#text': 'hello', b: 'world' } }, '<p>\n  hello\n  <b>world</b>\n</p>', '文字 + 子元素')
ok(!jsonToXml('[1,2]').ok, '頂層陣列應失敗')
ok(!jsonToXml('{bad').ok, '壞 JSON 應失敗')

// ---- 往返一致(XML → JSON → XML)----
for (const xml of [
  '<note><to>Tove</to><from>Jani</from></note>',
  '<list><item>a</item><item>b</item></list>',
  '<book id="1" lang="en">Title</book>',
  '<root><a>1</a><b><c>2</c></b></root>',
]) {
  const j = xmlToJson(xml)
  ok(j.ok, `往返:xml→json ok (${xml.slice(0, 24)}…)`)
  const back = jsonToXml(j.output)
  ok(back.ok, `往返:json→xml ok (${xml.slice(0, 24)}…)`)
  // 再轉一次 json 應與第一次相同(結構穩定)
  const j2 = xmlToJson(back.output)
  ok(j2.ok && j2.output === j.output, `往返結構穩定 (${xml.slice(0, 24)}…)`)
}

console.log(`\nXML ↔ JSON:${pass} 通過${fail ? `,${fail} 失敗` : ''}`)
if (fail) process.exit(1)
