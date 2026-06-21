/*
  Windows PE 執行檔(.exe / .dll / .sys)標頭解析引擎 —— 純函式、無 DOM 依賴(只用 DataView),
  可在 Node 直接測試。

  下載到一個 .exe 先別急著執行 —— 用這支看清楚:這是 32 位元還是 64 位元、給什麼 CPU(x86 /
  x64 / ARM)、編譯時間、是 GUI 還是命令列程式、有沒有開啟 ASLR / DEP 等防護、是否帶數位簽章、
  包含哪些區段、會去呼叫(import)哪些系統 DLL。檔案全程在你瀏覽器解析,不連網、不上傳、不執行。
*/

export interface PeSection { name: string; vaddr: number; vsize: number; rawSize: number; flags: string[] }
export interface PeInfo {
  isDll: boolean
  bits: number // 32 / 64
  magic: string // PE32 / PE32+
  machine: string
  machineId: number
  timestamp: string | null
  subsystem: string
  entryPoint: number
  imageBase: string
  numSections: number
  characteristics: string[]
  mitigations: string[] // ASLR / DEP / …
  signed: boolean
  sections: PeSection[]
  imports: string[]
  error?: string
}

const MACHINE: Record<number, string> = {
  0x14c: 'Intel x86(32 位元)', 0x8664: 'x64 / AMD64(64 位元)', 0x1c0: 'ARM',
  0x1c4: 'ARM Thumb-2', 0xaa64: 'ARM64', 0x200: 'Itanium(IA-64)', 0x1c2: 'ARM (Thumb)',
  0x5032: 'RISC-V 32', 0x5064: 'RISC-V 64', 0x0: '未指定',
}
const SUBSYSTEM: Record<number, string> = {
  1: '原生(driver / native)', 2: 'Windows GUI(視窗程式)', 3: 'Windows 命令列(console)',
  5: 'OS/2 命令列', 7: 'POSIX 命令列', 9: 'Windows CE GUI', 10: 'EFI 應用程式',
  16: 'Windows Boot 應用程式',
}

class PeError extends Error {}

/** 解析 PE 執行檔位元組。 */
export function parsePe(bytes: Uint8Array): PeInfo {
  const empty: PeInfo = {
    isDll: false, bits: 0, magic: '', machine: '', machineId: 0, timestamp: null, subsystem: '',
    entryPoint: 0, imageBase: '', numSections: 0, characteristics: [], mitigations: [], signed: false,
    sections: [], imports: [],
  }
  if (!bytes || bytes.length < 64) return { ...empty, error: '資料太短,不像 PE 執行檔' }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    if (dv.getUint16(0, true) !== 0x5a4d) throw new PeError('缺少 MZ 標頭,不是 Windows 執行檔') // 'MZ'
    const peOff = dv.getUint32(0x3c, true)
    if (peOff + 24 > bytes.length) throw new PeError('PE 標頭位置超出範圍')
    if (dv.getUint32(peOff, true) !== 0x00004550) throw new PeError('缺少 PE\\0\\0 簽章') // 'PE\0\0'

    const coff = peOff + 4
    const machineId = dv.getUint16(coff, true)
    const numSections = dv.getUint16(coff + 2, true)
    const timeDateStamp = dv.getUint32(coff + 4, true)
    const sizeOptHdr = dv.getUint16(coff + 16, true)
    const characteristics = dv.getUint16(coff + 18, true)

    const opt = coff + 20
    if (opt + 2 > bytes.length) throw new PeError('缺少 Optional Header')
    const optMagic = dv.getUint16(opt, true)
    const isPlus = optMagic === 0x20b
    const bits = isPlus ? 64 : 32

    const info: PeInfo = { ...empty, machineId, numSections, bits }
    info.magic = isPlus ? 'PE32+' : optMagic === 0x10b ? 'PE32' : `未知(0x${optMagic.toString(16)})`
    info.machine = MACHINE[machineId] || `未知(0x${machineId.toString(16)})`
    info.isDll = !!(characteristics & 0x2000)
    info.timestamp = timeDateStamp > 0 ? new Date(timeDateStamp * 1000).toISOString() : null
    info.entryPoint = dv.getUint32(opt + 16, true)
    info.imageBase = isPlus ? '0x' + dv.getBigUint64(opt + 24, true).toString(16) : '0x' + dv.getUint32(opt + 28, true).toString(16)
    info.subsystem = SUBSYSTEM[dv.getUint16(opt + 68, true)] || `未知(${dv.getUint16(opt + 68, true)})`

    // Characteristics(檔案屬性)
    const CHAR: [number, string][] = [[0x0002, '可執行映像'], [0x2000, 'DLL'], [0x0100, '32 位元機器'], [0x0020, '可處理大位址(>2GB)'], [0x1000, '系統檔'], [0x0001, '無重定位資訊']]
    info.characteristics = CHAR.filter(([m]) => characteristics & m).map(([, n]) => n)

    // DllCharacteristics(安全防護)
    const dllChar = dv.getUint16(opt + 70, true)
    const MIT: [number, string][] = [[0x0020, '高熵 ASLR(64 位元)'], [0x0040, 'ASLR(位址隨機化)'], [0x0100, 'DEP / NX(資料不可執行)'], [0x0400, '無結構化例外處理(SafeSEH 變體)'], [0x0800, '禁止繫結'], [0x1000, 'AppContainer'], [0x4000, 'Control Flow Guard(CFG)'], [0x8000, '支援終端機伺服器']]
    info.mitigations = MIT.filter(([m]) => dllChar & m).map(([, n]) => n)

    // 資料目錄:取 Import(1)與 Certificate(4)
    const numRva = dv.getUint32(opt + (isPlus ? 108 : 92), true)
    const ddStart = opt + (isPlus ? 112 : 96)
    const dir = (i: number) => (i < numRva && ddStart + i * 8 + 8 <= bytes.length ? { rva: dv.getUint32(ddStart + i * 8, true), size: dv.getUint32(ddStart + i * 8 + 4, true) } : { rva: 0, size: 0 })
    const importDir = dir(1)
    const certDir = dir(4)
    info.signed = certDir.size > 0 // 安全目錄存在 = 帶 Authenticode 簽章(本工具不驗證有效性)

    // 區段表
    const secStart = opt + sizeOptHdr
    const sections: { vaddr: number; vsize: number; raw: number; rawPtr: number }[] = []
    for (let i = 0; i < numSections; i++) {
      const sp = secStart + i * 40
      if (sp + 40 > bytes.length) break
      let name = ''
      for (let j = 0; j < 8; j++) { const c = bytes[sp + j]; if (c) name += String.fromCharCode(c) }
      const vsize = dv.getUint32(sp + 8, true)
      const vaddr = dv.getUint32(sp + 12, true)
      const raw = dv.getUint32(sp + 16, true)
      const rawPtr = dv.getUint32(sp + 20, true)
      const ch = dv.getUint32(sp + 36, true)
      const flags: string[] = []
      if (ch & 0x20000000) flags.push('可執行')
      if (ch & 0x40000000) flags.push('可讀')
      if (ch & 0x80000000) flags.push('可寫')
      if (ch & 0x00000020) flags.push('程式碼')
      if (ch & 0x00000040) flags.push('已初始化資料')
      if (ch & 0x00000080) flags.push('未初始化資料(BSS)')
      info.sections.push({ name, vaddr, vsize, rawSize: raw, flags })
      sections.push({ vaddr, vsize, raw, rawPtr })
    }

    // RVA → 檔案偏移
    const rva2off = (rva: number): number => {
      for (const s of sections) { const span = Math.max(s.vsize, s.raw); if (rva >= s.vaddr && rva < s.vaddr + span) return s.rawPtr + (rva - s.vaddr) }
      return -1
    }
    const readCStr = (off: number): string => { let s = ''; for (let i = off; i < bytes.length && bytes[i] !== 0; i++) s += String.fromCharCode(bytes[i]); return s }

    // Import 目錄:逐個 IMAGE_IMPORT_DESCRIPTOR(20 位元組)直到全零項
    if (importDir.rva) {
      let p = rva2off(importDir.rva)
      const seen = new Set<string>()
      for (let n = 0; p >= 0 && p + 20 <= bytes.length && n < 4096; n++, p += 20) {
        const nameRva = dv.getUint32(p + 12, true)
        const origThunk = dv.getUint32(p, true)
        if (nameRva === 0 && origThunk === 0 && dv.getUint32(p + 16, true) === 0) break
        if (nameRva === 0) continue
        const off = rva2off(nameRva)
        if (off < 0) continue
        const dll = readCStr(off)
        if (dll && !seen.has(dll.toLowerCase())) { seen.add(dll.toLowerCase()); info.imports.push(dll) }
      }
    }

    return info
  } catch (e) {
    return { ...empty, error: e instanceof PeError ? e.message : '解析失敗' }
  }
}
