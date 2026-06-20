/*
  .ics(iCalendar / RFC 5545)行事曆檔解析引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把收到的會議邀請 / 訂閱行事曆 .ics 拆成一筆筆事件:摘要、起訖時間、地點、說明、重複規則。
  別人寄來的 .ics 用記事本打開全是亂碼般的欄位;線上 .ics 檢視器又要你上傳含行程隱私的檔案。
  這支在你瀏覽器解析,搭配 RRULE 解讀把重複規則翻成白話。不連網、不上傳。
*/

export interface IcsDate {
  date: Date
  allDay: boolean // VALUE=DATE(整天事件,無時刻)
  tzid?: string // 原始 TZID 參數(僅標示,時間仍以本機解讀)
  utc: boolean // 原值是否以 Z 結尾(UTC)
}

export interface IcsEvent {
  summary?: string
  description?: string
  location?: string
  start?: IcsDate
  end?: IcsDate
  rrule?: string // 原始 RRULE 值(不含 RRULE: 前綴)
  uid?: string
  organizer?: string
  status?: string
}

export interface ContentLine {
  name: string
  params: Record<string, string>
  value: string
}

/** RFC 5545 行折疊還原:CRLF 後接空白/Tab 代表續行,須接回上一行。 */
export function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out.filter((l) => l.length > 0)
}

/** 解析一行 content line:NAME;PARAM=VAL;...:VALUE 。參數值可帶雙引號。 */
export function parseLine(line: string): ContentLine | null {
  // 找到不在引號內的第一個冒號
  let colon = -1
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuote = !inQuote
    else if (ch === ':' && !inQuote) { colon = i; break }
  }
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const segs = head.split(';')
  const name = segs[0].trim().toUpperCase()
  const params: Record<string, string> = {}
  for (let i = 1; i < segs.length; i++) {
    const eq = segs[i].indexOf('=')
    if (eq < 0) continue
    const k = segs[i].slice(0, eq).trim().toUpperCase()
    let v = segs[i].slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    params[k] = v
  }
  return { name, params, value }
}

/** 還原 TEXT 型別值的跳脫:\n→換行、\,→,、\;→;、\\→\ 。 */
export function unescapeText(v: string): string {
  return v.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c))
}

/** 解析 DATE / DATE-TIME 值(以本機時間建構;Z 與 TZID 僅標示)。 */
export function parseIcsDate(value: string, params: Record<string, string>): IcsDate | null {
  const v = value.trim()
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateOnly || params.VALUE === 'DATE') {
    const m = dateOnly ?? v.match(/^(\d{4})(\d{2})(\d{2})/)
    if (!m) return null
    return { date: new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0), allDay: true, tzid: params.TZID, utc: false }
  }
  const dt = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!dt) return null
  return {
    date: new Date(+dt[1], +dt[2] - 1, +dt[3], +dt[4], +dt[5], +dt[6]),
    allDay: false,
    tzid: params.TZID,
    utc: !!dt[7],
  }
}

/** 解析整份 .ics 文字,回傳事件陣列(依開始時間排序,無開始時間者殿後)。 */
export function parseIcs(text: string): IcsEvent[] {
  const lines = unfoldLines(text)
  const events: IcsEvent[] = []
  let cur: IcsEvent | null = null
  // 為避免落入 VEVENT 內的 VALARM 等子元件混入欄位,追蹤巢狀層級
  const stack: string[] = []

  for (const line of lines) {
    const cl = parseLine(line)
    if (!cl) continue
    if (cl.name === 'BEGIN') {
      stack.push(cl.value.toUpperCase())
      if (cl.value.toUpperCase() === 'VEVENT') cur = {}
      continue
    }
    if (cl.name === 'END') {
      const ended = stack.pop()
      if (ended === 'VEVENT' && cur) {
        events.push(cur)
        cur = null
      }
      continue
    }
    // 只收 VEVENT 直屬欄位(stack 頂端為 VEVENT)
    if (!cur || stack[stack.length - 1] !== 'VEVENT') continue
    switch (cl.name) {
      case 'SUMMARY': cur.summary = unescapeText(cl.value); break
      case 'DESCRIPTION': cur.description = unescapeText(cl.value); break
      case 'LOCATION': cur.location = unescapeText(cl.value); break
      case 'UID': cur.uid = cl.value.trim(); break
      case 'STATUS': cur.status = cl.value.trim().toUpperCase(); break
      case 'ORGANIZER': cur.organizer = (cl.params.CN || cl.value.replace(/^mailto:/i, '')).trim(); break
      case 'DTSTART': { const d = parseIcsDate(cl.value, cl.params); if (d) cur.start = d; break }
      case 'DTEND': { const d = parseIcsDate(cl.value, cl.params); if (d) cur.end = d; break }
      case 'RRULE': cur.rrule = cl.value.trim(); break
      default: break
    }
  }

  return events.sort((a, b) => {
    const ta = a.start ? a.start.date.getTime() : Infinity
    const tb = b.start ? b.start.date.getTime() : Infinity
    return ta - tb
  })
}
