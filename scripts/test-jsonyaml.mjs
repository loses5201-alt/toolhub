/*
  JSON ↔ YAML 互轉引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-jsonyaml.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsonyaml-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonYaml.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { jsonToYaml, yamlToJson } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 基本 JSON → YAML
{
  const r = jsonToYaml('{"name":"toolhub","port":8080,"debug":true}')
  check('json→yaml 成功', r.ok)
  check('json→yaml 含 name', r.output.includes('name: toolhub'))
  check('json→yaml 含數字', r.output.includes('port: 8080'))
  check('json→yaml 含布林', r.output.includes('debug: true'))
}

// 巢狀與陣列
{
  const r = jsonToYaml('{"a":{"b":[1,2,3]},"list":["x","y"]}')
  check('json→yaml 巢狀成功', r.ok)
  check('json→yaml 陣列項目', r.output.includes('- 1') && r.output.includes('- x'))
}

// YAML → JSON 基本
{
  const r = yamlToJson('name: toolhub\nport: 8080\ndebug: true\n')
  check('yaml→json 成功', r.ok)
  const obj = JSON.parse(r.output)
  check('yaml→json 值正確', obj.name === 'toolhub' && obj.port === 8080 && obj.debug === true)
}

// YAML → JSON 巢狀/陣列
{
  const y = 'server:\n  host: localhost\n  ports:\n    - 80\n    - 443\nflags: [a, b]\n'
  const r = yamlToJson(y)
  check('yaml→json 巢狀成功', r.ok)
  const obj = JSON.parse(r.output)
  check('yaml→json 巢狀值', obj.server.host === 'localhost' && obj.server.ports[1] === 443)
  check('yaml→json 行內陣列', Array.isArray(obj.flags) && obj.flags[0] === 'a')
}

// 來回一致(round-trip):JSON → YAML → JSON 物件等價
{
  const original = { name: '工具站', nums: [1, 2, 3], nested: { ok: true, v: null }, str: 'a: b' }
  const y = jsonToYaml(JSON.stringify(original))
  check('round-trip json→yaml 成功', y.ok)
  const j = yamlToJson(y.output)
  check('round-trip yaml→json 成功', j.ok)
  check('round-trip 物件等價', JSON.stringify(JSON.parse(j.output)) === JSON.stringify(original))
}

// 中文與特殊字元保留
{
  const r = yamlToJson('訊息: 你好世界\n符號: "a: b # c"\n')
  const obj = JSON.parse(r.output)
  check('中文值保留', obj['訊息'] === '你好世界')
  check('含冒號井號的字串保留', obj['符號'] === 'a: b # c')
}

// 縮排選項
{
  const r4 = jsonToYaml('{"a":{"b":1}}', 4)
  check('json→yaml indent=4', r4.output.includes('    b: 1'))
  const j0 = yamlToJson('a: 1\nb: 2\n', 0)
  check('yaml→json indent=0 壓一行', j0.ok && !j0.output.includes('\n'))
}

// 空輸入
check('json→yaml 空輸入報錯', !jsonToYaml('   ').ok)
check('yaml→json 空輸入報錯', !yamlToJson('   ').ok)
// 只有註解在 YAML 屬合法的 null 文件 → 輸出 JSON null(不視為錯誤)
{
  const r = yamlToJson('# 只是註解\n')
  check('只有註解 → 合法 null', r.ok && r.output.trim() === 'null')
}

// 無效輸入
{
  const r = jsonToYaml('{name: toolhub}') // 非合法 JSON(key 無引號)
  check('無效 JSON 報錯且不丟例外', !r.ok && r.error.includes('JSON 解析失敗'))
}
{
  const r = yamlToJson('a:\n - 1\n- 2\n') // 縮排不一致
  check('無效 YAML 報錯且不丟例外', !r.ok)
}

// 多份文件偵測
{
  const r = yamlToJson('a: 1\n---\nb: 2\n')
  check('多份 YAML 文件給清楚提示', !r.ok && r.error.includes('多份'))
}

// 數字型別:不誤把版本字串轉成數字(json:true 模式下標量仍依 YAML 規則,但帶引號者為字串)
{
  const r = yamlToJson('version: "1.10"\ncount: 5\n')
  const obj = JSON.parse(r.output)
  check('帶引號版本維持字串', obj.version === '1.10')
  check('純數字維持數字', obj.count === 5)
}

console.log(fail === 0 ? '\nAll json-yaml tests passed.' : `\n${fail} test(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
