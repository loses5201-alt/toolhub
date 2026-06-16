/*
  ZIP 工坊引擎的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 把含 jszip 的 TS 引擎打包成 ESM 再 import。
  執行:node scripts/test-zipstudio.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `zipstudio-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/zipStudio.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const { buildZip, readZip, normalizeName } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const bytes = (s) => enc.encode(s)
function bytesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// 路徑正規化
check('normalizeName 去掉開頭斜線', normalizeName('/a/b.txt') === 'a/b.txt')
check('normalizeName 反斜線轉斜線', normalizeName('a\\b.txt') === 'a/b.txt')
check('normalizeName 擋掉 .. 跳脫', normalizeName('../../etc/passwd') === 'etc/passwd')
check('normalizeName 空字串給預設名', normalizeName('') === 'file')

// 來回:打包再解開,內容一致
const helloTxt = bytes('你好,世界 hello\nsecond line')
const z1 = await buildZip([
  { name: 'a.txt', data: helloTxt },
  { name: '資料夾/b.bin', data: new Uint8Array([0, 1, 2, 255, 254, 100]) },
])
check('buildZip 產出非空位元組', z1 instanceof Uint8Array && z1.length > 0)
check('zip 標頭為 PK', z1[0] === 0x50 && z1[1] === 0x4b)

const e1 = await readZip(z1)
const fileEntries = e1.filter((e) => !e.dir)
check('readZip 取回兩個檔', fileEntries.length === 2)
const a = e1.find((e) => e.name === 'a.txt')
check('a.txt 內容完全一致', a && bytesEqual(a.data, helloTxt))
check('a.txt 解出中文正確', a && dec.decode(a.data).startsWith('你好,世界'))
check('a.txt size 正確', a && a.size === helloTxt.length)
const b = e1.find((e) => e.name === '資料夾/b.bin')
check('二進位檔位元組一致', b && bytesEqual(b.data, new Uint8Array([0, 1, 2, 255, 254, 100])))

// 同名自動加序號,不互相覆蓋
const z2 = await buildZip([
  { name: 'dup.txt', data: bytes('first') },
  { name: 'dup.txt', data: bytes('second') },
])
const e2 = await readZip(z2)
const names = e2.filter((e) => !e.dir).map((e) => e.name).sort()
check('同名自動改名為 dup (2).txt', names.includes('dup.txt') && names.includes('dup (2).txt'))
const first = e2.find((e) => e.name === 'dup.txt')
const second = e2.find((e) => e.name === 'dup (2).txt')
check('兩份同名內容各自保留', dec.decode(first.data) === 'first' && dec.decode(second.data) === 'second')

// 壓縮強度 0(STORE)也能正確來回
const big = bytes('A'.repeat(5000))
const zStore = await buildZip([{ name: 'r.txt', data: big }], { level: 0 })
const zMax = await buildZip([{ name: 'r.txt', data: big }], { level: 9 })
const eStore = await readZip(zStore)
check('STORE(level 0)來回一致', bytesEqual(eStore[0].data, big))
check('可壓縮資料 level 9 比 STORE 小', zMax.length < zStore.length)

// 空清單應丟錯
let threw = false
try {
  await buildZip([])
} catch {
  threw = true
}
check('空清單 buildZip 丟錯', threw)

// 非 zip 位元組應丟出可讀錯誤
let threw2 = false
try {
  await readZip(bytes('this is definitely not a zip file at all'))
} catch (err) {
  threw2 = /ZIP/.test(err.message)
}
check('非 ZIP 檔丟出可讀錯誤', threw2)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 項失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)
