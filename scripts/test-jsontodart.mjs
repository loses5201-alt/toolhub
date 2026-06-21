// JSON → Dart 回歸測試
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jsontodart-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/jsonToDart.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { jsonToDart, classNameFromKey, propNameFromKey } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { jsonToDart, classNameFromKey, propNameFromKey } = await import('file://' + outFile)

let pass = 0
let fail = 0
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', msg)
  }
}
const gen = (j, o) => jsonToDart(j, o).code

// ── 命名 ──
ok(classNameFromKey('user') === 'User', 'class user→User')
ok(classNameFromKey('user_profile') === 'UserProfile', 'class snake→Pascal')
ok(classNameFromKey('2nd') === 'N2nd', 'class 數字開頭加前綴')
ok(propNameFromKey('user_name') === 'userName', 'prop snake→camel')
ok(propNameFromKey('UserName') === 'userName', 'prop Pascal→camel')
ok(propNameFromKey('user-name') === 'userName', 'prop kebab→camel')
ok(propNameFromKey('') === 'field', '空→field')
ok(propNameFromKey('class') === 'class_', '關鍵字 class→class_')
ok(propNameFromKey('default') === 'default_', '關鍵字 default→default_')

// ── 基本物件(plain)──
const c1 = gen('{"id":1,"name":"a","active":true,"score":9.5}')
ok(c1.includes('class Root {'), 'Root class')
ok(c1.includes('final int id;'), 'int 欄位')
ok(c1.includes('final String name;'), 'String 欄位')
ok(c1.includes('final bool active;'), 'bool 欄位')
ok(c1.includes('final double score;'), 'double 欄位')
ok(c1.includes('Root({required this.id, required this.name, required this.active, required this.score});'), '建構子 required')
ok(c1.includes('factory Root.fromJson(Map<String, dynamic> json) => Root('), 'fromJson 工廠')
ok(c1.includes("id: json[\"id\"] as int,"), 'fromJson int 轉換')
ok(c1.includes("name: json[\"name\"] as String,"), 'fromJson String 轉換')
ok(c1.includes('Map<String, dynamic> toJson() => {'), 'toJson')
ok(c1.includes('"id": id,'), 'toJson 純量直出')
ok(!c1.includes('import'), 'plain 模式無 import')

// ── 整數+小數混合 → double ──
const c2 = gen('[{"v":1},{"v":2.5}]', { rootName: 'Nums' })
ok(c2.includes('final double v;'), '混合 int+double → double')

// ── null / 缺鍵 → 可空 ──
const c3 = gen('[{"a":1,"b":2},{"a":3}]', { rootName: 'Row' })
ok(c3.includes('final int? b;'), '缺鍵 → int?')
ok(c3.includes('this.b'), '可空欄位建構子非 required')
ok(c3.includes('required this.a'), '必有欄位 required')
ok(c3.includes('b: json["b"] as int?,'), '可空純量 fromJson 帶 ?')

const c4 = gen('{"x":null}')
ok(c4.includes('final dynamic x;'), '全 null → dynamic')
ok(c4.includes('x: json["x"],'), 'dynamic fromJson 不轉型')

// ── 巢狀物件 ──
const c5 = gen('{"id":1,"address":{"city":"台北","zip":"100"}}')
ok(c5.includes('class Address {'), '巢狀 → Address class')
ok(c5.includes('final Address address;'), '欄位型別為 Address')
ok(c5.includes('address: Address.fromJson(json["address"] as Map<String, dynamic>),'), '巢狀 fromJson')
ok(c5.includes('"address": address.toJson(),'), '巢狀 toJson')
// 葉節點先輸出
ok(c5.indexOf('class Address {') < c5.indexOf('class Root {'), '葉節點類別在前')

// ── 可空巢狀物件 ──
const c6 = gen('[{"a":{"b":1}},{"c":2}]', { rootName: 'Row' })
ok(c6.includes('a == null ? null :') || c6.includes('json["a"] == null ? null :'), '可空巢狀三元判斷')

// ── 純量陣列 ──
const c7 = gen('{"tags":["a","b"],"nums":[1,2]}')
ok(c7.includes('final List<String> tags;'), 'List<String>')
ok(c7.includes('final List<int> nums;'), 'List<int>')
ok(c7.includes('tags: (json["tags"] as List<dynamic>).map((e) => e as String).toList(),'), '純量陣列 fromJson')
ok(c7.includes('"tags": tags,'), '純量陣列 toJson 直出')

// ── 物件陣列 ──
const c8 = gen('{"orders":[{"no":"A","amount":1},{"no":"B","amount":2,"note":"x"}]}')
ok(c8.includes('class Order {'), '物件陣列 → 單數類別名 Order')
ok(c8.includes('final List<Order> orders;'), 'List<Order>')
ok(c8.includes('orders: (json["orders"] as List<dynamic>).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList(),'), '物件陣列 fromJson')
ok(c8.includes('"orders": orders.map((e) => e.toJson()).toList(),'), '物件陣列 toJson')
ok(c8.includes('final String? note;'), '部分物件缺鍵 → note 可空')

// ── 巢狀陣列(List<List<int>>)──
const c9 = gen('{"grid":[[1,2],[3,4]]}')
ok(c9.includes('final List<List<int>> grid;'), 'List<List<int>>')
ok(c9.includes('"grid": grid,'), '純量巢狀陣列 toJson 直出')

// ── 改名鍵:plain 仍以原鍵存取 ──
const c10 = gen('{"user_name":"x"}')
ok(c10.includes('final String userName;'), 'snake → camel 屬性')
ok(c10.includes('userName: json["user_name"] as String,'), 'plain fromJson 用原鍵')
ok(c10.includes('"user_name": userName,'), 'plain toJson 用原鍵')

// ── json_serializable 模式 ──
const s1 = gen('{"id":1,"user_name":"x"}', { mode: 'serializable' })
ok(s1.includes("import 'package:json_annotation/json_annotation.dart';"), 'serializable import')
ok(s1.includes("part 'model.g.dart';"), 'serializable part 預設 model')
ok(s1.includes('@JsonSerializable()'), '@JsonSerializable 標註')
ok(s1.includes('@JsonKey(name: "user_name")'), '改名鍵補 @JsonKey')
ok(!s1.includes('@JsonKey(name: "id")'), '同名鍵不補 @JsonKey')
ok(s1.includes('factory Root.fromJson(Map<String, dynamic> json) => _$RootFromJson(json);'), 'serializable fromJson')
ok(s1.includes('Map<String, dynamic> toJson() => _$RootToJson(this);'), 'serializable toJson')
ok(!s1.includes('this.id;') && s1.includes('final int id;'), 'serializable 仍有欄位')

const s2 = gen('{}', { mode: 'serializable', partFile: 'user.dart' })
ok(s2.includes("part 'user.g.dart';"), 'partFile 去 .dart 副檔名')

// ── 根為陣列/純量 ──
const r1 = gen('[1,2,3]', { rootName: 'Nums' })
ok(r1.includes('// 根為陣列,請直接用 List<int>'), '根陣列註解')
const r2 = gen('42')
ok(r2.includes('// 根為純量,型別為 int'), '根純量註解')

// ── 同名不同結構 → 加序號 ──
const c11 = gen('{"a":{"x":1},"b":{"y":2},"items":[{"x":1}]}', { rootName: 'Root' })
ok(/class A \{/.test(c11) && /class B \{/.test(c11), '不同結構各自成類別')

// ── 解析錯誤 ──
const err = jsonToDart('{bad')
ok(err.ok === false && /JSON 解析失敗/.test(err.error), '壞 JSON 報錯')

// ── 空物件 ──
const c12 = gen('{}')
ok(c12.includes('class Root {'), '空物件仍輸出 class')
ok(c12.includes('Root();'), '空物件無參數建構子')

console.log(`jsontodart: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
