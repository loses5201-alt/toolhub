// ZIP 工坊引擎 —— 純函式,輸入/輸出皆為位元組(Uint8Array),
// 與環境無關:瀏覽器把結果包成 Blob 下載,Node 可直接拿來做回歸測試。
// 用 JSZip(純 JS + pako,無 WASM、不連網),全程在本機處理、不上傳。
import JSZip from 'jszip'

export interface ZipInputFile {
  /** 在壓縮檔內的路徑/檔名(可含資料夾,如 "圖片/a.png") */
  name: string
  data: Uint8Array
  /** 修改時間,省略則用現在時間 */
  date?: Date
}

export interface ZipEntryInfo {
  /** 在壓縮檔內的完整路徑 */
  name: string
  /** 是否為資料夾項目 */
  dir: boolean
  /** 解壓後位元組大小(資料夾為 0) */
  size: number
  /** 修改時間,讀不到則為 null */
  date: Date | null
  /** 解壓後的位元組;資料夾為 null */
  data: Uint8Array | null
}

/** 把使用者選的路徑正規化:統一斜線、去掉開頭的 / 與 ./、擋掉 .. 跳脫。 */
export function normalizeName(raw: string): string {
  let name = String(raw).replace(/\\/g, '/').replace(/^\.?\/+/, '')
  // 移除任何 ".." 路徑段,避免打包出可跳出目錄的惡意路徑
  name = name
    .split('/')
    .filter((seg) => seg !== '' && seg !== '.' && seg !== '..')
    .join('/')
  return name || 'file'
}

function clampLevel(level: number | undefined): number {
  if (level == null || Number.isNaN(level)) return 6
  return Math.max(0, Math.min(9, Math.round(level)))
}

/**
 * 把多個檔案打包成一個 zip 的位元組。
 * level 0 = 不壓縮(STORE,最快、適合已壓縮過的相片/影片);1–9 = DEFLATE 壓縮強度。
 */
export async function buildZip(
  files: ZipInputFile[],
  opts: { level?: number } = {},
): Promise<Uint8Array> {
  if (!files.length) throw new Error('沒有要打包的檔案。')
  const zip = new JSZip()
  const seen = new Set<string>()
  for (const f of files) {
    let name = normalizeName(f.name)
    // 同名自動加序號,避免後者覆蓋前者
    if (seen.has(name)) {
      const dot = name.lastIndexOf('.')
      const base = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ''
      let i = 2
      while (seen.has(`${base} (${i})${ext}`)) i++
      name = `${base} (${i})${ext}`
    }
    seen.add(name)
    zip.file(name, f.data, f.date ? { date: f.date } : undefined)
  }
  const level = clampLevel(opts.level)
  return zip.generateAsync({
    type: 'uint8array',
    compression: level === 0 ? 'STORE' : 'DEFLATE',
    compressionOptions: { level: level === 0 ? 1 : level },
  })
}

/**
 * 讀取 zip 位元組,列出內容並一併取出每個檔案的位元組(供本機檢視/下載)。
 * 解壓在記憶體完成、不上傳;壞檔/非 zip 會丟出錯誤。
 */
export async function readZip(data: Uint8Array): Promise<ZipEntryInfo[]> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    throw new Error('無法讀取,這似乎不是有效的 ZIP 檔(或檔案已損毀)。')
  }
  const entries: { path: string; obj: JSZip.JSZipObject }[] = []
  zip.forEach((path, obj) => entries.push({ path, obj }))
  const out: ZipEntryInfo[] = []
  for (const { path, obj } of entries) {
    if (obj.dir) {
      out.push({ name: path, dir: true, size: 0, date: obj.date ?? null, data: null })
      continue
    }
    const bytes = await obj.async('uint8array')
    out.push({
      name: path,
      dir: false,
      size: bytes.length,
      date: obj.date ?? null,
      data: bytes,
    })
  }
  // 依路徑排序,瀏覽時較好找
  out.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  return out
}
