// 動態設定每頁的 <title> 與 description / Open Graph,利於 SEO、分享預覽與書籤辨識
const SITE = 'ToolHub · 台灣在地實用工具站'
const DEFAULT_DESC =
  'ToolHub — 給自己與家人朋友的實用工具站。台灣在地計算、防詐騙下載中心,乾淨、不上傳、好用。'

function setTag(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** 設定頁面標題與描述;title 會自動補上站名。 */
export function setMeta(title?: string, description?: string) {
  const fullTitle = title ? `${title}｜${SITE}` : SITE
  const desc = description || DEFAULT_DESC
  document.title = fullTitle
  setTag('meta[name="description"]', 'name', 'description', desc)
  setTag('meta[property="og:title"]', 'property', 'og:title', fullTitle)
  setTag('meta[property="og:description"]', 'property', 'og:description', desc)
  setTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle)
  setTag('meta[name="twitter:description"]', 'name', 'twitter:description', desc)
}
