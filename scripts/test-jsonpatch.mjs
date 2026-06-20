/*
  JSON Patch(RFC 6902)引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-jsonpatch.mjs
  oracle:RFC 6902 Appendix A 範例 + JSON Pointer(RFC 6901)規則 + diff→apply 來回一致。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `jsonpatch-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/jsonPatch.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { applyPatch, diffPatch, parsePointer, deepEqual } = await import('file://' + out)

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
function ok(note, cond) {
  eq(note, !!cond, true)
}
const ap = (doc, patch) => applyPatch(doc, patch)

// --- parsePointer / 跳脫 ---
eq('pointer 根', parsePointer(''), [])
eq('pointer 一般', parsePointer('/foo/0/bar'), ['foo', '0', 'bar'])
eq('pointer ~1 → /', parsePointer('/a~1b'), ['a/b'])
eq('pointer ~0 → ~', parsePointer('/a~0b'), ['a~b'])

// --- RFC 6902 Appendix A ---
// A.1 add object member
eq('A.1 add', ap({ foo: 'bar' }, [{ op: 'add', path: '/baz', value: 'qux' }]).result, { foo: 'bar', baz: 'qux' })
// A.2 add array element
eq('A.2 add array', ap({ foo: ['bar', 'baz'] }, [{ op: 'add', path: '/foo/1', value: 'qux' }]).result, { foo: ['bar', 'qux', 'baz'] })
// A.3 remove
eq('A.3 remove', ap({ baz: 'qux', foo: 'bar' }, [{ op: 'remove', path: '/baz' }]).result, { foo: 'bar' })
// A.4 remove array element
eq('A.4 remove array', ap({ foo: ['bar', 'qux', 'baz'] }, [{ op: 'remove', path: '/foo/1' }]).result, { foo: ['bar', 'baz'] })
// A.5 replace
eq('A.5 replace', ap({ baz: 'qux', foo: 'bar' }, [{ op: 'replace', path: '/baz', value: 'boo' }]).result, { baz: 'boo', foo: 'bar' })
// A.6 move
eq(
  'A.6 move',
  ap({ foo: { bar: 'baz', waldo: 'fred' }, qux: { corge: 'grault' } }, [{ op: 'move', from: '/foo/waldo', path: '/qux/thud' }]).result,
  { foo: { bar: 'baz' }, qux: { corge: 'grault', thud: 'fred' } },
)
// A.7 move within array
eq('A.7 move array', ap({ foo: ['all', 'grass', 'cows', 'eat'] }, [{ op: 'move', from: '/foo/1', path: '/foo/3' }]).result, { foo: ['all', 'cows', 'eat', 'grass'] })
// A.8 test success
ok('A.8 test success', ap({ baz: 'qux', foo: ['a', 2, 'c'] }, [{ op: 'test', path: '/baz', value: 'qux' }, { op: 'test', path: '/foo/1', value: 2 }]).ok)
// A.9 test fail
eq('A.9 test fail', ap({ baz: 'qux' }, [{ op: 'test', path: '/baz', value: 'bar' }]).ok, false)
// A.10 add nested member object
eq('A.10 add nested', ap({ foo: 'bar' }, [{ op: 'add', path: '/child', value: { grandchild: {} } }]).result, { foo: 'bar', child: { grandchild: {} } })
// A.12 add to nonexistent target → error
eq('A.12 add to missing parent fails', ap({ foo: 'bar' }, [{ op: 'add', path: '/baz/bat', value: 'qux' }]).ok, false)
// A.16 append with -
eq('A.16 append -', ap({ foo: ['bar'] }, [{ op: 'add', path: '/foo/-', value: ['abc', 'def'] }]).result, { foo: ['bar', ['abc', 'def']] })

// --- copy ---
eq('copy', ap({ a: { x: 1 }, b: {} }, [{ op: 'copy', from: '/a/x', path: '/b/y' }]).result, { a: { x: 1 }, b: { y: 1 } })

// --- replace 不存在 → error ---
eq('replace 不存在 fails', ap({ a: 1 }, [{ op: 'replace', path: '/b', value: 2 }]).ok, false)

// --- 取代根 ---
eq('replace 根', ap({ a: 1 }, [{ op: 'replace', path: '', value: { b: 2 } }]).result, { b: 2 })

// --- move 不能移到自己底下 ---
eq('move 到自身底下 fails', ap({ a: { b: 1 } }, [{ op: 'move', from: '/a', path: '/a/c' }]).ok, false)

// --- 不可變:原文件不被修改 ---
const orig = { foo: [1, 2] }
ap(orig, [{ op: 'add', path: '/foo/-', value: 3 }])
eq('原文件未被改動', orig, { foo: [1, 2] })

// --- 未知 op ---
eq('未知 op fails', ap({}, [{ op: 'frob', path: '/a' }]).ok, false)

// --- patch 非陣列 ---
eq('patch 非陣列 fails', applyPatch({}, { op: 'add' }).ok, false)

// --- deepEqual ---
ok('deepEqual 物件', deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }))
ok('deepEqual 不等', !deepEqual({ a: 1 }, { a: 2 }))

// --- diffPatch + 來回一致 ---
function roundtrip(a, b, note) {
  const patch = diffPatch(a, b)
  const res = applyPatch(a, patch)
  ok(`${note} apply ok`, res.ok)
  eq(`${note} diff→apply == b`, res.result, b)
}
roundtrip({ a: 1, b: 2 }, { a: 1, b: 3 }, '改值')
roundtrip({ a: 1 }, { a: 1, b: 2 }, '加鍵')
roundtrip({ a: 1, b: 2 }, { a: 1 }, '刪鍵')
roundtrip({ a: { x: 1, y: 2 } }, { a: { x: 1, y: 9, z: 3 } }, '巢狀')
roundtrip({ a: [1, 2, 3] }, { a: [1, 2, 3, 4] }, '陣列整段replace')
roundtrip({ a: 1 }, { a: 1 }, '無差異')

// 無差異 → 空 patch
eq('無差異空 patch', diffPatch({ a: 1 }, { a: 1 }), [])

if (fail) {
  console.error(`\n${fail} 筆失敗`)
  process.exit(1)
}
console.log('\n全部通過 ✅')
