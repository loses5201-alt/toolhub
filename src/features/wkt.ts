/*
  WKT ⇆ GeoJSON 轉換引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。

  WKT(Well-Known Text)是空間資料庫(PostGIS / MySQL / SQL Server / Oracle Spatial)與許多 GIS
  工具用來表示幾何的文字格式,例如 POINT (121 25)、POLYGON ((...))。前端地圖(Leaflet / Mapbox)
  與開放資料則多用 GeoJSON。兩者常需互轉:把資料庫查出的 WKT 貼進地圖,或把 GeoJSON 存回資料庫。

  本引擎雙向轉換,支援 POINT / LINESTRING / POLYGON / MULTI* / GEOMETRYCOLLECTION、EMPTY、
  以及 Z / M / ZM 維度標記(高程保留為 GeoJSON 第三軸)。全程在你瀏覽器處理,不上傳、不連網。
  座標一律為 [x=經度, y=緯度] 對應 GeoJSON 規範。
*/

export interface Geometry {
  type: string
  coordinates?: unknown
  geometries?: Geometry[]
}

// ---- 詞法分析 ----

type Tok = { t: 'word' | 'num' | '(' | ')' | ','; v: string }

function tokenize(s: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (c === '(' || c === ')' || c === ',') { toks.push({ t: c, v: c }); i++; continue }
    if (/[A-Za-z]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[A-Za-z]/.test(s[j])) j++
      toks.push({ t: 'word', v: s.slice(i, j).toUpperCase() })
      i = j
      continue
    }
    if (/[-+.0-9]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[-+.0-9eE]/.test(s[j])) j++
      toks.push({ t: 'num', v: s.slice(i, j) })
      i = j
      continue
    }
    throw new Error(`無法辨識的字元「${c}」(位置 ${i})`)
  }
  return toks
}

// ---- 語法分析(遞迴下降)----

class Parser {
  toks: Tok[]
  pos = 0
  constructor(toks: Tok[]) { this.toks = toks }
  peek(): Tok | undefined { return this.toks[this.pos] }
  next(): Tok { const t = this.toks[this.pos++]; if (!t) throw new Error('WKT 內容意外結束'); return t }
  expect(t: Tok['t']): Tok {
    const tok = this.next()
    if (tok.t !== t) throw new Error(`預期「${t}」但讀到「${tok.v}」`)
    return tok
  }

  number(): number {
    const tok = this.expect('num')
    const n = Number(tok.v)
    if (!Number.isFinite(n)) throw new Error(`無效數字「${tok.v}」`)
    return n
  }

  /** 一個座標:連續數字(≥2),保留前 3 軸(x y z)。 */
  coord(): number[] {
    const nums: number[] = [this.number(), this.number()]
    while (this.peek()?.t === 'num') nums.push(this.number())
    return nums.slice(0, 3)
  }

  /** 以逗號分隔、外層用括號包住的清單。 */
  list<T>(item: () => T): T[] {
    this.expect('(')
    const out: T[] = [item()]
    while (this.peek()?.t === ',') { this.next(); out.push(item()) }
    this.expect(')')
    return out
  }

  /** MULTIPOINT 的點:可能是 (x y) 也可能是裸 x y。 */
  multiPointCoord(): number[] {
    if (this.peek()?.t === '(') {
      this.next()
      const c = this.coord()
      this.expect(')')
      return c
    }
    return this.coord()
  }

  /** 讀型別關鍵字後,若接 EMPTY 回 true 並吃掉它。 */
  consumeEmpty(): boolean {
    // 可選維度標記 Z / M / ZM
    if (this.peek()?.t === 'word' && /^(Z|M|ZM)$/.test(this.peek()!.v)) this.next()
    if (this.peek()?.t === 'word' && this.peek()!.v === 'EMPTY') { this.next(); return true }
    return false
  }

  geometry(): Geometry {
    const type = this.expect('word').v
    switch (type) {
      case 'POINT': {
        if (this.consumeEmpty()) return { type: 'Point', coordinates: [] }
        this.expect('(')
        const c = this.coord()
        this.expect(')')
        return { type: 'Point', coordinates: c }
      }
      case 'LINESTRING': {
        if (this.consumeEmpty()) return { type: 'LineString', coordinates: [] }
        return { type: 'LineString', coordinates: this.list(() => this.coord()) }
      }
      case 'POLYGON': {
        if (this.consumeEmpty()) return { type: 'Polygon', coordinates: [] }
        return { type: 'Polygon', coordinates: this.list(() => this.list(() => this.coord())) }
      }
      case 'MULTIPOINT': {
        if (this.consumeEmpty()) return { type: 'MultiPoint', coordinates: [] }
        return { type: 'MultiPoint', coordinates: this.list(() => this.multiPointCoord()) }
      }
      case 'MULTILINESTRING': {
        if (this.consumeEmpty()) return { type: 'MultiLineString', coordinates: [] }
        return { type: 'MultiLineString', coordinates: this.list(() => this.list(() => this.coord())) }
      }
      case 'MULTIPOLYGON': {
        if (this.consumeEmpty()) return { type: 'MultiPolygon', coordinates: [] }
        return { type: 'MultiPolygon', coordinates: this.list(() => this.list(() => this.list(() => this.coord()))) }
      }
      case 'GEOMETRYCOLLECTION': {
        if (this.consumeEmpty()) return { type: 'GeometryCollection', geometries: [] }
        return { type: 'GeometryCollection', geometries: this.list(() => this.geometry()) }
      }
      default:
        throw new Error(`不支援的幾何型別「${type}」`)
    }
  }
}

/** WKT 文字 → GeoJSON 幾何物件。語法錯誤會丟 Error。 */
export function wktToGeoJson(wkt: string): Geometry {
  const s = wkt.trim().replace(/^SRID=\d+\s*;\s*/i, '') // 容忍 EWKT 的 SRID 前綴
  if (!s) throw new Error('內容為空')
  const p = new Parser(tokenize(s))
  const g = p.geometry()
  if (p.peek()) throw new Error(`結尾有多餘內容「${p.peek()!.v}」`)
  return g
}

// ---- GeoJSON → WKT ----

function num(n: number): string {
  return Number.isFinite(n) ? String(n) : '0'
}
function coordStr(c: unknown): string {
  return Array.isArray(c) ? (c as number[]).map(num).join(' ') : ''
}
function ring(r: unknown): string {
  return '(' + (Array.isArray(r) ? r.map(coordStr).join(', ') : '') + ')'
}
function poly(p: unknown): string {
  return '(' + (Array.isArray(p) ? p.map(ring).join(', ') : '') + ')'
}

/** GeoJSON 幾何物件 → WKT 文字。不支援的型別會丟 Error。 */
export function geoJsonToWkt(geom: Geometry): string {
  const c = geom.coordinates
  switch (geom.type) {
    case 'Point':
      return Array.isArray(c) && c.length ? `POINT (${coordStr(c)})` : 'POINT EMPTY'
    case 'LineString':
      return Array.isArray(c) && c.length ? `LINESTRING ${ring(c)}` : 'LINESTRING EMPTY'
    case 'Polygon':
      return Array.isArray(c) && c.length ? `POLYGON ${poly(c)}` : 'POLYGON EMPTY'
    case 'MultiPoint':
      return Array.isArray(c) && c.length ? `MULTIPOINT (${(c as unknown[]).map(coordStr).join(', ')})` : 'MULTIPOINT EMPTY'
    case 'MultiLineString':
      return Array.isArray(c) && c.length ? `MULTILINESTRING ${poly(c)}` : 'MULTILINESTRING EMPTY'
    case 'MultiPolygon':
      return Array.isArray(c) && c.length ? `MULTIPOLYGON (${(c as unknown[]).map(poly).join(', ')})` : 'MULTIPOLYGON EMPTY'
    case 'GeometryCollection':
      return geom.geometries && geom.geometries.length
        ? `GEOMETRYCOLLECTION (${geom.geometries.map(geoJsonToWkt).join(', ')})`
        : 'GEOMETRYCOLLECTION EMPTY'
    default:
      throw new Error(`不支援的型別「${geom.type}」`)
  }
}

/** 從 GeoJSON 字串(可為 Feature / FeatureCollection / 幾何)取出幾何並轉 WKT,多個以換行分隔。 */
export function geoJsonTextToWkt(text: string): string {
  const obj = JSON.parse(text)
  const geoms: Geometry[] = []
  const pick = (o: { type?: string; geometry?: Geometry; features?: { geometry?: Geometry }[] } | Geometry) => {
    const t = (o as { type?: string }).type
    if (t === 'FeatureCollection') for (const f of (o as { features?: { geometry?: Geometry }[] }).features || []) { if (f?.geometry) geoms.push(f.geometry) }
    else if (t === 'Feature') { const g = (o as { geometry?: Geometry }).geometry; if (g) geoms.push(g) }
    else if (t) geoms.push(o as Geometry)
  }
  pick(obj)
  if (!geoms.length) throw new Error('找不到可轉換的幾何')
  return geoms.map(geoJsonToWkt).join('\n')
}
