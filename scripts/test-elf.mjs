/*
  ELF 執行檔解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-elf.mjs
  oracle:測試內自帶一支獨立的「ELF 組裝器」(buildElf),依 ELF64 規範手寫 ELF 標頭 / 程式標頭
  (LOAD / INTERP / DYNAMIC / GNU_STACK / GNU_RELRO)/ 動態區段(DT_NEEDED / DT_STRTAB / DT_FLAGS)/
  區段標頭,以「虛擬位址 = 檔案偏移」恆等對映組成合法 ELF 後用引擎解回來比對;另測 32 位元 / 大端 /
  靜態連結 / strip / 可執行堆疊 / 錯誤路徑。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `elf-test-${Date.now()}.mjs`)
await build({ entryPoints: ['src/features/elf.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { parseElf } = await import('file://' + out)

let fail = 0
function check(note, cond) { if (cond) console.log(`✓ ${note}`); else { fail++; console.error(`✗ ${note}`) } }

/* ---------- 位元組寫入工具 ---------- */
function W(size) {
  const b = new Uint8Array(size)
  const dv = new DataView(b.buffer)
  return {
    b,
    u16: (o, v, le = true) => dv.setUint16(o, v, le),
    u32: (o, v, le = true) => dv.setUint32(o, v, le),
    u64: (o, v, le = true) => dv.setBigUint64(o, BigInt(v), le),
    str: (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i) },
  }
}

/* ---------- 完整 ELF64 LE 組裝器(oracle)---------- */
function buildElf({ eType = 3, stripped = false, execStack = false } = {}) {
  const total = 784
  const w = W(total)
  // 區段資料位置
  const interpOff = 344, interpStr = '/lib64/ld-linux-x86-64.so.2'
  const dynstrOff = 376 // "\0libc.so.6\0libm.so.6\0"
  const dynOff = 400
  const shstrOff = 496
  const shoff = 528
  // ELF 標頭
  w.str(0, '\x7fELF')
  w.b[4] = 2 // 64 位元
  w.b[5] = 1 // 小端
  w.b[6] = 1 // version
  w.b[7] = 3 // OSABI Linux
  w.u16(16, eType)
  w.u16(18, 0x3e) // x86-64
  w.u32(20, 1)
  w.u64(24, 0x1000) // entry
  w.u64(32, 64) // phoff
  w.u64(40, shoff)
  w.u32(48, 0) // flags
  w.u16(52, 64) // ehsize
  w.u16(54, 56) // phentsize
  w.u16(56, 5) // phnum
  w.u16(58, 64) // shentsize
  w.u16(60, 4) // shnum
  w.u16(62, 3) // shstrndx
  // 程式標頭(每個 56 位元組,自 64 起)
  function ph(idx, type, flags, off, vaddr, filesz, memsz) {
    const p = 64 + idx * 56
    w.u32(p, type); w.u32(p + 4, flags); w.u64(p + 8, off); w.u64(p + 16, vaddr); w.u64(p + 24, vaddr); w.u64(p + 32, filesz); w.u64(p + 40, memsz)
  }
  ph(0, 1, 5, 0, 0, total, total) // LOAD R+X 涵蓋整檔(恆等對映)
  ph(1, 3, 4, interpOff, interpOff, interpStr.length + 1, interpStr.length + 1) // INTERP
  ph(2, 2, 6, dynOff, dynOff, 96, 96) // DYNAMIC
  ph(3, 0x6474e551, execStack ? 7 : 6, 0, 0, 0, 0) // GNU_STACK
  ph(4, 0x6474e552, 4, 0, 0, 0, 0) // GNU_RELRO
  // INTERP 字串
  w.str(interpOff, interpStr)
  // 動態字串表:"\0libc.so.6\0libm.so.6\0"(libc 在 offset 1、libm 在 offset 11)
  w.str(dynstrOff + 1, 'libc.so.6'); w.str(dynstrOff + 11, 'libm.so.6')
  // 動態區段:6 個條目 ×16 位元組
  function dyn(idx, tag, val) { const p = dynOff + idx * 16; w.u64(p, tag); w.u64(p + 8, val) }
  dyn(0, 1, 1) // DT_NEEDED libc
  dyn(1, 1, 11) // DT_NEEDED libm
  dyn(2, 5, dynstrOff) // DT_STRTAB(位址 = 偏移)
  dyn(3, 10, 21) // DT_STRSZ
  dyn(4, 30, 0x8) // DT_FLAGS = DF_BIND_NOW → 完整 RELRO
  dyn(5, 0, 0) // DT_NULL
  // 區段名稱字串表:"\0.symtab\0.text\0.shstrtab\0"
  w.str(shstrOff + 1, stripped ? '.dynsym' : '.symtab') // 同長 7,strip 時改名
  w.str(shstrOff + 9, '.text')
  w.str(shstrOff + 15, '.shstrtab')
  // 區段標頭(每個 64 位元組)
  function sh(idx, nameOff, type, size, off) {
    const p = shoff + idx * 64
    w.u32(p, nameOff); w.u32(p + 4, type); w.u64(p + 24, off); w.u64(p + 32, size)
  }
  sh(0, 0, 0, 0, 0) // null
  sh(1, 1, 2, 100, 0) // .symtab(或 strip 時 .dynsym)
  sh(2, 9, 1, 200, 0) // .text
  sh(3, 15, 3, 25, shstrOff) // .shstrtab(其 sh_offset 為名稱表基底)
  return w.b
}

/* ---------- PIE 動態執行檔(完整功能)---------- */
{
  const r = parseElf(buildElf({ eType: 3 }))
  check('64 位元', r.class === 64)
  check('小端', r.endian.includes('小端'))
  check('OSABI Linux', r.osabi === 'Linux')
  check('machine x86-64', r.machine.includes('x86-64'))
  check('type 共享物件 / PIE', r.type.includes('PIE') || r.type.includes('共享'))
  check('entry 0x1000', r.entry === '0x1000')
  check('PIE = true(DYN + INTERP)', r.pie === true)
  check('NX 已啟用', r.nx.includes('已啟用'))
  check('RELRO 完整', r.relro.includes('完整'))
  check('動態連結', r.linkage === '動態連結')
  check('未被 strip(.symtab 存在)', r.stripped === false)
  check('interpreter', r.interpreter === '/lib64/ld-linux-x86-64.so.2')
  check('needed = libc + libm', JSON.stringify(r.needed) === JSON.stringify(['libc.so.6', 'libm.so.6']))
  check('5 個 segment', r.segments.length === 5)
  check('segment 旗標 LOAD = R-X', r.segments[0].flags === 'R-X')
  check('3 個 section(扣除 null)', r.sections.length === 3 && r.sections.some((s) => s.name === '.text'))
}

/* ---------- ET_EXEC(非 PIE)---------- */
{
  const r = parseElf(buildElf({ eType: 2 }))
  check('ET_EXEC:type 可執行檔', r.type.includes('可執行檔'))
  check('ET_EXEC:PIE = false', r.pie === false)
}

/* ---------- strip 後(無 .symtab)---------- */
check('strip:stripped = true', parseElf(buildElf({ stripped: true })).stripped === true)

/* ---------- 可執行堆疊(無 NX)---------- */
check('可執行堆疊警示', parseElf(buildElf({ execStack: true })).nx.includes('可執行堆疊'))

/* ---------- 靜態連結(僅 ELF 標頭 + 1 個 LOAD)---------- */
{
  const w = W(64 + 56)
  w.str(0, '\x7fELF'); w.b[4] = 2; w.b[5] = 1; w.b[6] = 1; w.b[7] = 0
  w.u16(16, 2); w.u16(18, 0x3e); w.u64(24, 0x401000); w.u64(32, 64); w.u64(40, 0)
  w.u16(52, 64); w.u16(54, 56); w.u16(56, 1); w.u16(58, 64); w.u16(60, 0); w.u16(62, 0)
  w.u32(64, 1); w.u32(68, 5) // 一個 LOAD segment
  const r = parseElf(w.b)
  check('靜態連結(無 INTERP / DYNAMIC)', r.linkage === '靜態連結')
  check('靜態:OSABI System V', r.osabi === 'System V')
}

/* ---------- 32 位元 + 大端(標頭偵測)---------- */
{
  const w = W(52)
  w.str(0, '\x7fELF'); w.b[4] = 1 /* 32 */; w.b[5] = 2 /* 大端 */; w.b[6] = 1; w.b[7] = 0
  w.u16(16, 2, false); w.u16(18, 0x28, false) // ARM,大端
  const r = parseElf(w.b)
  check('32 位元偵測', r.class === 32)
  check('大端偵測', r.endian.includes('大端'))
  check('大端:machine ARM', r.machine === 'ARM')
}

/* ---------- AArch64 machine ---------- */
{
  const w = W(64); w.str(0, '\x7fELF'); w.b[4] = 2; w.b[5] = 1; w.u16(18, 0xb7)
  check('AArch64 machine', parseElf(w.b).machine.includes('AArch64'))
}

/* ---------- 錯誤路徑 ---------- */
check('無 ELF magic → 錯誤', !!parseElf(Uint8Array.from([0x4d, 0x5a, ...new Array(40).fill(0)])).error)
check('資料太短 → 錯誤', !!parseElf(Uint8Array.from([0x7f, 0x45])).error)

console.log(fail === 0 ? '\n全部通過 🎉' : `\n${fail} 項失敗`)
process.exit(fail ? 1 : 0)
