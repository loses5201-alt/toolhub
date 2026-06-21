/*
  Windows PE 執行檔解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-pe.mjs
  oracle:測試內自帶一支獨立的「PE 組裝器」(buildPe),依 PE/COFF 規範手寫 DOS / PE / Optional Header /
  區段表 / Import 目錄,組成合法 PE 位元組後用引擎解回來比對(PE32+ 與 PE32 兩種),另測錯誤路徑。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `pe-test-${Date.now()}.mjs`)
await build({ entryPoints: ['src/features/pe.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { parsePe } = await import('file://' + out)

let fail = 0
function check(note, cond) { if (cond) console.log(`✓ ${note}`); else { fail++; console.error(`✗ ${note}`) } }

/* ---------- 獨立 PE 組裝器(oracle)---------- */
function buildPe({ isPlus = true, machine = 0x8664, characteristics = 0x0022, subsystem = 2, dllChar = 0x0160, timeDateStamp = 1577836800, dlls = ['KERNEL32.dll', 'USER32.dll'], signed = true }) {
  const size = 0x600
  const buf = new Uint8Array(size)
  const dv = new DataView(buf.buffer)
  // DOS 標頭
  dv.setUint16(0, 0x5a4d, true) // 'MZ'
  const peOff = 0x40
  dv.setUint32(0x3c, peOff, true)
  // PE 簽章
  dv.setUint32(peOff, 0x00004550, true) // 'PE\0\0'
  const coff = peOff + 4
  const sizeOptHdr = isPlus ? 240 : 224
  dv.setUint16(coff, machine, true)
  dv.setUint16(coff + 2, 2, true) // numSections
  dv.setUint32(coff + 4, timeDateStamp, true)
  dv.setUint16(coff + 16, sizeOptHdr, true)
  dv.setUint16(coff + 18, characteristics, true)
  // Optional Header
  const opt = coff + 20
  dv.setUint16(opt, isPlus ? 0x20b : 0x10b, true)
  dv.setUint32(opt + 16, 0x1000, true) // entry point
  if (isPlus) dv.setBigUint64(opt + 24, 0x140000000n, true)
  else dv.setUint32(opt + 28, 0x400000, true) // imageBase
  dv.setUint16(opt + 68, subsystem, true)
  dv.setUint16(opt + 70, dllChar, true)
  const numRvaOff = isPlus ? 108 : 92
  const ddStart = opt + (isPlus ? 112 : 96)
  dv.setUint32(opt + numRvaOff, 16, true)
  // 資料目錄 1 = Import、4 = Certificate
  dv.setUint32(ddStart + 1 * 8, 0x2000, true)
  dv.setUint32(ddStart + 1 * 8 + 4, dlls.length * 20 + 20, true)
  if (signed) { dv.setUint32(ddStart + 4 * 8, 0x5000, true); dv.setUint32(ddStart + 4 * 8 + 4, 128, true) }
  // 區段表
  const secStart = opt + sizeOptHdr
  function section(idx, name, vaddr, vsize, rawPtr, rawSize, ch) {
    const sp = secStart + idx * 40
    for (let j = 0; j < name.length; j++) buf[sp + j] = name.charCodeAt(j)
    dv.setUint32(sp + 8, vsize, true)
    dv.setUint32(sp + 12, vaddr, true)
    dv.setUint32(sp + 16, rawSize, true)
    dv.setUint32(sp + 20, rawPtr, true)
    dv.setUint32(sp + 36, ch, true)
  }
  section(0, '.text', 0x1000, 0x100, 0x200, 0x200, 0x60000020) // code|exec|read
  section(1, '.rdata', 0x2000, 0x200, 0x400, 0x200, 0x40000040) // initialized data|read
  // Import 目錄置於 .rdata(rva 0x2000 → file 0x400)
  const importFile = 0x400
  let nameRva = 0x2050
  const nameOffsets = []
  for (let i = 0; i < dlls.length; i++) {
    const dp = importFile + i * 20
    dv.setUint32(dp, 0x2080 + i * 0x10, true) // OriginalFirstThunk
    dv.setUint32(dp + 12, nameRva, true) // Name RVA
    dv.setUint32(dp + 16, 0x2090 + i * 0x10, true) // FirstThunk
    nameOffsets.push({ rva: nameRva, name: dlls[i] })
    nameRva += dlls[i].length + 2
  }
  // 終止描述子(全零)已是預設
  // 寫入 DLL 名稱字串(rva 0x2000 → file 0x400)
  for (const { rva, name } of nameOffsets) {
    const off = 0x400 + (rva - 0x2000)
    for (let j = 0; j < name.length; j++) buf[off + j] = name.charCodeAt(j)
  }
  return buf
}

/* ---------- PE32+(64 位元)---------- */
{
  const r = parsePe(buildPe({ isPlus: true }))
  check('PE32+:無錯誤', !r.error)
  check('PE32+:64 位元', r.bits === 64 && r.magic === 'PE32+')
  check('PE32+:machine = x64', r.machineId === 0x8664 && r.machine.includes('x64'))
  check('PE32+:非 DLL(EXE)', r.isDll === false)
  check('PE32+:timestamp', r.timestamp === new Date(1577836800 * 1000).toISOString())
  check('PE32+:subsystem GUI', r.subsystem.includes('GUI'))
  check('PE32+:entryPoint 0x1000', r.entryPoint === 0x1000)
  check('PE32+:imageBase', r.imageBase === '0x140000000')
  check('PE32+:numSections 2', r.numSections === 2 && r.sections.length === 2)
  check('PE32+:characteristics 含可執行映像', r.characteristics.includes('可執行映像'))
  check('PE32+:mitigations 含 ASLR', r.mitigations.some((m) => m.includes('ASLR')))
  check('PE32+:mitigations 含 DEP', r.mitigations.some((m) => m.includes('DEP')))
  check('PE32+:signed = true', r.signed === true)
  check('PE32+:.text 區段可執行 / 程式碼', r.sections[0].name === '.text' && r.sections[0].flags.includes('可執行') && r.sections[0].flags.includes('程式碼'))
  check('PE32+:.rdata 區段', r.sections[1].name === '.rdata' && r.sections[1].flags.includes('已初始化資料'))
  check('PE32+:imports = KERNEL32 + USER32', JSON.stringify(r.imports) === JSON.stringify(['KERNEL32.dll', 'USER32.dll']))
}

/* ---------- PE32(32 位元、DLL、未簽章)---------- */
{
  const r = parsePe(buildPe({ isPlus: false, machine: 0x14c, characteristics: 0x2002, subsystem: 3, dllChar: 0, dlls: ['msvcrt.dll'], signed: false }))
  check('PE32:32 位元', r.bits === 32 && r.magic === 'PE32')
  check('PE32:machine = x86', r.machine.includes('x86'))
  check('PE32:DLL', r.isDll === true && r.characteristics.includes('DLL'))
  check('PE32:subsystem console', r.subsystem.includes('命令列'))
  check('PE32:imageBase 0x400000', r.imageBase === '0x400000')
  check('PE32:無防護 mitigations', r.mitigations.length === 0)
  check('PE32:未簽章', r.signed === false)
  check('PE32:imports = msvcrt', JSON.stringify(r.imports) === JSON.stringify(['msvcrt.dll']))
}

/* ---------- timestamp 0 ---------- */
check('timestamp 0 → null', parsePe(buildPe({ timeDateStamp: 0 })).timestamp === null)

/* ---------- ARM64 machine ---------- */
check('machine ARM64', parsePe(buildPe({ machine: 0xaa64 })).machine.includes('ARM64'))

/* ---------- 錯誤路徑 ---------- */
check('無 MZ → 錯誤', !!parsePe(Uint8Array.from([0x00, 0x00, ...new Array(80).fill(0)])).error)
check('資料太短 → 錯誤', !!parsePe(Uint8Array.from([0x4d, 0x5a])).error)
{
  const b = buildPe({})
  b[0x40] = 0 // 破壞 PE 簽章
  check('PE 簽章錯誤 → 錯誤', !!parsePe(b).error)
}

console.log(fail === 0 ? '\n全部通過 🎉' : `\n${fail} 項失敗`)
process.exit(fail ? 1 : 0)
