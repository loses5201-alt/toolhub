/*
  JSON ↔ YAML 互轉引擎(薄包裝 + 友善錯誤訊息)。

  解析/序列化交給成熟的 js-yaml(避免自刻 parser 出錯寫壞設定檔);
  這裡負責:統一錯誤訊息、JSON 縮排選項、把「YAML 多份文件(---)」擋下來給清楚提示。
  與環境無關、不碰 DOM,方便用 Node 跑回歸測試;js-yaml 在 .vue 動態 import。

  典型用途:k8s / docker-compose / CI(GitHub Actions)設定常含密鑰,線上轉換器要你上傳;
  本工具全程在瀏覽器轉換、不上傳。
*/
import yaml from 'js-yaml'

export interface ConvertResult {
  ok: boolean
  output: string
  error: string
}

function ok(output: string): ConvertResult {
  return { ok: true, output, error: '' }
}
function err(error: string): ConvertResult {
  return { ok: false, output: '', error }
}

/** 把 js-yaml 的錯誤整理成單行、好讀的訊息(含行號)。 */
function tidyYamlError(e: unknown): string {
  const m = e as { reason?: string; mark?: { line?: number } }
  const reason = m?.reason || (e as Error)?.message || '格式錯誤'
  const line = m?.mark?.line
  return typeof line === 'number' ? `第 ${line + 1} 行:${reason}` : reason
}

/** JSON 字串 → YAML 字串。indent 為 YAML 縮排空格數(2 或 4)。 */
export function jsonToYaml(input: string, indent = 2): ConvertResult {
  const text = input.trim()
  if (!text) return err('請先貼上 JSON 內容。')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return err('JSON 解析失敗:' + (e as Error).message)
  }
  try {
    const out = yaml.dump(data, { indent, lineWidth: -1, noRefs: true, sortKeys: false })
    return ok(out)
  } catch (e) {
    return err('YAML 產生失敗:' + (e as Error).message)
  }
}

/** YAML 字串 → JSON 字串。indent 為 JSON 縮排空格數(0 = 壓成一行)。 */
export function yamlToJson(input: string, indent = 2): ConvertResult {
  const text = input.trim()
  if (!text) return err('請先貼上 YAML 內容。')
  // js-yaml 的 load 只取單一文件,遇到多份(---)會丟錯;先給清楚提示
  let data: unknown
  try {
    data = yaml.load(text, { json: true })
  } catch (e) {
    const msg = tidyYamlError(e)
    if (/multiple documents/i.test(msg) || /expected a single document/i.test(msg)) {
      return err('偵測到多份 YAML 文件(以 --- 分隔),請一次只轉一份。')
    }
    return err('YAML 解析失敗:' + msg)
  }
  if (data === undefined) return err('YAML 內容為空或只有註解。')
  try {
    const out = indent > 0 ? JSON.stringify(data, null, indent) : JSON.stringify(data)
    return ok(out)
  } catch (e) {
    // 循環參照等
    return err('JSON 產生失敗:' + (e as Error).message)
  }
}
