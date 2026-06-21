/*
  mbox 信箱分割引擎 —— 純函式、無 DOM 依賴,可在 Node 直接測試。
  把 Thunderbird / Google Takeout 匯出的 Unix mbox 檔分割成一封封獨立郵件,
  每封還原成標準 RFC 822 內容(可再交給 .eml 解析或下載成 .eml)。
  全程在你的瀏覽器處理,信件不連網、不上傳。

  mbox 格式:每封信以開頭為 "From " 的 From_ 分隔行起始(該行不屬於郵件本體);
  mboxrd 變體會把本體中開頭為「>*From 」的行多加一個 '>',分割時還原。
*/

export interface MboxMessage {
  /** 分隔用的 From_ 行(原始,不含於 raw)。 */
  fromLine: string
  /** 還原後的 RFC 822 郵件內容(標頭 + 空行 + 內文)。 */
  raw: string
}

/** 還原 mboxrd 對本體中「>From 」「>>From 」等行的跳脫(去掉一個 '>')。 */
export function unescapeMboxrd(body: string): string {
  return body.replace(/^>(>*From )/gm, '$1')
}

/** 把整個 mbox 檔分割成各封郵件。非 mbox(找不到 From_ 行)回空陣列。 */
export function splitMbox(text: string): MboxMessage[] {
  const norm = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = norm.split('\n')
  const msgs: MboxMessage[] = []
  let cur: { fromLine: string; body: string[] } | null = null
  for (const line of lines) {
    if (/^From /.test(line)) {
      if (cur) msgs.push(finish(cur))
      cur = { fromLine: line, body: [] }
    } else if (cur) {
      cur.body.push(line)
    }
    // 第一個 From_ 行之前的內容(cur 為 null)直接略過
  }
  if (cur) msgs.push(finish(cur))
  return msgs
}

function finish(cur: { fromLine: string; body: string[] }): MboxMessage {
  const raw = unescapeMboxrd(cur.body.join('\n')).replace(/\n+$/, '')
  return { fromLine: cur.fromLine, raw }
}
