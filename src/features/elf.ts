/*
  ELF 執行檔(Linux / BSD 的 .so / 無副檔名執行檔 / .o / core dump)標頭解析引擎 ——
  純函式、無 DOM 依賴(只用 DataView),可在 Node 直接測試。

  拿到一個來路不明的 Linux 執行檔,不必在機器上跑就能看清楚:32 還是 64 位元、大 / 小端、
  給哪種 CPU(x86-64 / ARM64 / RISC-V…)、是執行檔還是共享函式庫(.so)、是不是 PIE、
  有沒有開 NX(不可執行堆疊)/ RELRO 等防護、是動態還是靜態連結、會用到哪些共享函式庫(DT_NEEDED)、
  動態載入器(interpreter)是誰、有沒有被 strip 掉符號。全程在你瀏覽器解析,不連網、不上傳、不執行。
*/

export interface ElfSegment { type: string; flags: string; vaddr: string; fileSize: number; memSize: number }
export interface ElfInfo {
  class: number // 32 / 64
  endian: string // 小端 / 大端
  osabi: string
  type: string // 可執行 / 共享函式庫 / …
  machine: string
  entry: string
  pie: boolean
  nx: string // 已啟用 / 可執行堆疊(危險)/ 未知
  relro: string // 無 / 部分 / 完整
  linkage: string // 動態 / 靜態
  stripped: boolean | null
  interpreter: string
  soname: string
  runpath: string
  needed: string[]
  segments: ElfSegment[]
  sections: { name: string; size: number }[]
  error?: string
}

const E_TYPE: Record<number, string> = { 1: '可重定位目的檔(.o)', 2: '可執行檔(固定位址)', 3: '共享物件 / PIE(.so 或 PIE 執行檔)', 4: '核心傾印(core dump)' }
const E_MACHINE: Record<number, string> = {
  0x03: 'Intel x86(32 位元)', 0x3e: 'x86-64 / AMD64', 0x28: 'ARM', 0xb7: 'AArch64(ARM64)',
  0xf3: 'RISC-V', 0x08: 'MIPS', 0x14: 'PowerPC', 0x15: 'PowerPC64', 0x16: 'S390', 0x2b: 'SPARC v9', 0x102: 'LoongArch',
}
const OSABI: Record<number, string> = { 0: 'System V', 1: 'HP-UX', 2: 'NetBSD', 3: 'Linux', 6: 'Solaris', 9: 'FreeBSD', 12: 'OpenBSD' }
const PT: Record<number, string> = {
  1: 'LOAD', 2: 'DYNAMIC', 3: 'INTERP', 4: 'NOTE', 5: 'SHLIB', 6: 'PHDR', 7: 'TLS',
  0x6474e550: 'GNU_EH_FRAME', 0x6474e551: 'GNU_STACK', 0x6474e552: 'GNU_RELRO', 0x6474e553: 'GNU_PROPERTY',
}

class ElfError extends Error {}

/** 解析 ELF 位元組。 */
export function parseElf(bytes: Uint8Array): ElfInfo {
  const empty: ElfInfo = {
    class: 0, endian: '', osabi: '', type: '', machine: '', entry: '', pie: false, nx: '未知', relro: '無',
    linkage: '', stripped: null, interpreter: '', soname: '', runpath: '', needed: [], segments: [], sections: [],
  }
  if (!bytes || bytes.length < 20) return { ...empty, error: '資料太短,不像 ELF 檔' }
  if (!(bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46)) return { ...empty, error: '缺少 ELF magic(\\x7fELF),不是 ELF 檔' }

  const is64 = bytes[4] === 2
  const le = bytes[5] !== 2 // EI_DATA:2 = 大端
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (o: number) => dv.getUint16(o, le)
  const u32 = (o: number) => dv.getUint32(o, le)
  const u64 = (o: number) => Number(dv.getBigUint64(o, le))
  const addr = (o: number) => (is64 ? u64(o) : u32(o))
  const aSize = is64 ? 8 : 4

  try {
    const info: ElfInfo = { ...empty }
    info.class = is64 ? 64 : 32
    info.endian = le ? '小端(little-endian)' : '大端(big-endian)'
    info.osabi = OSABI[bytes[7]] || `未知(${bytes[7]})`
    const eType = u16(16)
    const eMachine = u16(18)
    info.type = E_TYPE[eType] || `未知(${eType})`
    info.machine = E_MACHINE[eMachine] || `未知(0x${eMachine.toString(16)})`
    info.entry = '0x' + addr(24).toString(16)

    const phoff = addr(24 + aSize)
    const shoff = addr(24 + aSize * 2)
    const after = 24 + aSize * 3 + 4 // 跳過 e_flags
    const phentsize = u16(after + 2)
    const phnum = u16(after + 4)
    const shentsize = u16(after + 6)
    const shnum = u16(after + 8)
    const shstrndx = u16(after + 10)

    // 程式標頭(segments)
    let hasInterp = false, hasDynamic = false, dynOff = 0, dynSize = 0
    const loads: { vaddr: number; off: number; filesz: number }[] = []
    for (let i = 0; i < phnum; i++) {
      const p = phoff + i * phentsize
      if (p + phentsize > bytes.length) break
      const pType = u32(p)
      let pFlags: number, pOff: number, pVaddr: number, pFilesz: number, pMemsz: number
      if (is64) { pFlags = u32(p + 4); pOff = u64(p + 8); pVaddr = u64(p + 16); pFilesz = u64(p + 32); pMemsz = u64(p + 40) }
      else { pOff = u32(p + 4); pVaddr = u32(p + 8); pFilesz = u32(p + 16); pMemsz = u32(p + 20); pFlags = u32(p + 24) }
      const fl = `${pFlags & 4 ? 'R' : '-'}${pFlags & 2 ? 'W' : '-'}${pFlags & 1 ? 'X' : '-'}`
      info.segments.push({ type: PT[pType] || `0x${pType.toString(16)}`, flags: fl, vaddr: '0x' + pVaddr.toString(16), fileSize: pFilesz, memSize: pMemsz })
      if (pType === 1) loads.push({ vaddr: pVaddr, off: pOff, filesz: pFilesz })
      if (pType === 3) { hasInterp = true; info.interpreter = readCStr(pOff).slice(0, pFilesz).replace(/\0.*$/, '') }
      if (pType === 2) { hasDynamic = true; dynOff = pOff; dynSize = pFilesz }
      if (pType === 0x6474e551) info.nx = (pFlags & 1) ? '⚠️ 可執行堆疊(無 NX 保護)' : '已啟用(NX / 不可執行堆疊)'
      if (pType === 0x6474e552) info.relro = '部分(GNU_RELRO)'
    }

    function readCStr(off: number): string {
      let s = ''
      for (let i = off; i < bytes.length && bytes[i] !== 0; i++) s += String.fromCharCode(bytes[i])
      return s
    }
    const vaddr2off = (a: number): number => {
      for (const l of loads) if (a >= l.vaddr && a < l.vaddr + l.filesz) return l.off + (a - l.vaddr)
      return -1
    }

    info.type = E_TYPE[eType] || info.type
    info.pie = eType === 3 && hasInterp
    info.linkage = hasInterp || hasDynamic ? '動態連結' : '靜態連結'

    // 動態區段:DT_NEEDED / DT_STRTAB / DT_FLAGS …
    if (hasDynamic && dynOff) {
      const entSize = is64 ? 16 : 8
      let strtabAddr = 0
      const neededOffs: number[] = []
      let sonameOff = -1, runpathOff = -1, bindNow = false
      const end = Math.min(dynOff + dynSize, bytes.length)
      for (let p = dynOff; p + entSize <= end; p += entSize) {
        const tag = is64 ? u64(p) : u32(p)
        const val = is64 ? u64(p + 8) : u32(p + 4)
        if (tag === 0) break // DT_NULL
        if (tag === 1) neededOffs.push(val) // DT_NEEDED
        else if (tag === 5) strtabAddr = val // DT_STRTAB
        else if (tag === 14) sonameOff = val // DT_SONAME
        else if (tag === 29 || tag === 15) runpathOff = val // DT_RUNPATH / DT_RPATH
        else if (tag === 24) bindNow = true // DT_BIND_NOW
        else if (tag === 30 && (val & 0x8)) bindNow = true // DT_FLAGS: DF_BIND_NOW
        else if (tag === 0x6ffffffb && (val & 0x1)) bindNow = true // DT_FLAGS_1: DF_1_NOW
      }
      const strBase = strtabAddr ? vaddr2off(strtabAddr) : -1
      if (strBase >= 0) {
        info.needed = neededOffs.map((o) => readCStr(strBase + o)).filter(Boolean)
        if (sonameOff >= 0) info.soname = readCStr(strBase + sonameOff)
        if (runpathOff >= 0) info.runpath = readCStr(strBase + runpathOff)
      }
      if (info.relro.startsWith('部分') && bindNow) info.relro = '完整(GNU_RELRO + BIND_NOW)'
    }

    // 區段標頭:取名稱(供列出 + 判斷是否 strip)
    if (shoff && shnum && shstrndx < shnum) {
      const shStr = shoff + shstrndx * shentsize
      const strOff = addr(shStr + (is64 ? 24 : 16)) // sh_offset
      const names: { name: string; size: number }[] = []
      for (let i = 0; i < shnum; i++) {
        const sp = shoff + i * shentsize
        if (sp + shentsize > bytes.length) break
        const nameOff = u32(sp)
        const size = addr(sp + (is64 ? 32 : 20)) // sh_size
        const name = readCStr(strOff + nameOff)
        if (i > 0) names.push({ name, size })
      }
      info.sections = names
      info.stripped = !names.some((s) => s.name === '.symtab')
    }

    return info
  } catch (e) {
    return { ...empty, error: e instanceof ElfError ? e.message : '解析失敗' }
  }
}
