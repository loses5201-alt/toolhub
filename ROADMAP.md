# ROADMAP — ToolHub

> 自主開發的待辦與已完成清單,跨 session 接力用。完成一項就移到「已完成」並標日期。

## 已完成
- 骨架(Vue3+TS+Vite+Tailwind v4)、單一事實來源 tools.config、動態路由
- 工具(22 個):可疑網址檢查器、詐騙簡訊檢查、常見詐騙手法圖鑑、資遣費、特休、加班費、貸款試算、定存複利、勞退自提、勞保老年年金、分期APR、綜所稅速算、二代健保、BMI、TDEE、油錢試算、旅費分帳、單位換算、預產期、發票對獎、民國年
- 防詐騙下載中心(30 軟體 10 分類)+ 版本自動更新 Action + NetworkFirst
- 關鍵字導引、PWA、GitHub Pages 部署、每頁 SEO meta + OG
- 長輩友善:字級放大切換(A− / A / A+,存 localStorage)— 2026-06-15
- 深化防詐騙:詐騙簡訊話術辨識(sms-check,複用 linkcheck)— 2026-06-15
- 新增分期實際利率 APR、油錢試算、TDEE — 2026-06-15
- 新增勞保老年年金試算(兩式擇優 + 提前/延後)— 2026-06-15
- 強化 linkcheck:危險協定攔截、官方網域當幌子偵測、擴充品牌庫(回歸測試 23 筆)— 2026-06-15
- 新增常見詐騙手法圖鑑(10 類話術/破綻/應對)— 2026-06-15

## 已完成(續)
- 新增請假扣薪試算、年齡計算(實歲/虛歲/保險年齡)— 2026-06-15
- Signal/Git/Python 加入 GitHub 版本自動更新 — 2026-06-15
- 下載中心:軟體搜尋 + 資料暫缺容錯狀態 — 2026-06-15
- 修正首頁搜尋「LINE 下載」未導向下載中心的問題(虛擬可搜尋項目)— 2026-06-15
- 無障礙:鍵盤 focus-visible 焦點框、prefers-reduced-motion、跳至主要內容 — 2026-06-15

## 處理工坊(2026-06 新方向:純前端、不上傳、無廣告、無浮水印、可批次)
- 圖片工坊(image-studio):批次轉檔/壓縮/縮放,canvas 處理、去 EXIF — 2026-06-15
- HEIC 轉 JPG/PNG(heic-convert):iPhone .heic 在 Windows/舊機/網站常打不開,免費線上站要上傳私密照片;
  heic2any(libheif WASM)在瀏覽器內解碼、不上傳,支援拖放/批次/品質/最長邊縮放,多影像 HEIC 取第一張,
  重編碼自動去 EXIF。heic2any ~1.3MB 動態 import + heic-vendor chunk + globIgnores 不預快取(precache 仍 390KB)— 2026-06-15
- PDF 工坊(pdf-studio):合併、整理頁面(刪頁/重排/擷取)、圖片↔PDF — 2026-06-15
  - pdf-lib(合併/組頁/圖轉PDF)+ pdfjs-dist(渲染);PDF 函式庫拆 pdf-vendor chunk 不預快取(PWA 預快取 1163KB→281KB,改 runtime StaleWhileRevalidate)
  - 新增「PDF 浮水印」分頁(Watermark.vue):每頁斜向重複加註用途(防盜用,與 image-watermark 互補,但對象是 PDF 文件);
    因 pdf-lib 內建字型不含中文,改用 canvas 把浮水印畫成透明 PNG 再蓋上每頁(支援中文),相同尺寸頁面共用嵌入圖省檔案;
    顏色/密度/透明度/字級/角度可調,常見用途一鍵帶入;零新相依(複用既有 pdf-lib)— 2026-06-15

- 資料轉換工坊(data-convert):CSV ↔ JSON 互轉,自製解析器處理引號/換行,零相依 — 2026-06-15
  - 升級:加入 Excel(.xlsx)三方互轉(CSV/JSON/Excel),from→to 格式選擇 UI,
    統一以物件陣列為中介;SheetJS 動態 import + sheet-vendor chunk(424KB)不預快取 — 2026-06-15
- ZIP 工坊(zip-studio,category=workshop):把多個檔案/資料夾打包成一個 .zip 好寄出/上傳,
  或把收到的 .zip 在本機解開、逐檔檢視與下載。線上壓縮/解壓站要把可能含機密的檔案上傳到別人伺服器、
  滿廣告又限大小/檔數;本工具用 JSZip(純 JS + pako,無 WASM、不連網)全程在瀏覽器處理、不上傳。
  壓縮三段強度(STORE/標準/最大)、檔名可改(含 / 建資料夾)、同名自動加序號不覆蓋、顯示壓縮比;
  解壓列出全部項目逐檔下載。引擎 src/features/zipStudio.ts(buildZip/readZip/normalizeName 純位元組進出、
  與環境無關故可 Node 測,normalizeName 擋 .. 跳脫)+ 回歸測試 scripts/test-zipstudio.mjs(17 筆:來回一致、
  中文/二進位、同名改名、STORE vs DEFLATE、非 ZIP 報錯,以 esbuild 打包含 jszip 後跑,併入 npm test)。
  JSZip 動態 import + zip-vendor chunk(gzip 45KB)不預快取;不支援密碼加密 ZIP(引導用 secure-box)。
  type-check + test(全 162 筆)+ build 通過 — 2026-06-16拖曳框選塗黑/馬賽克,真的把像素燒掉、不上傳,分享截圖前遮個資 — 2026-06-15
- 表格清理工坊(table-clean,category=workshop):貼上 CSV/TSV(或從 Excel/Google 試算表複製整塊貼上),
  做去空白、刪空白列、去重複(整列或指定欄、可忽略大小寫)、篩選(包含/等於/開頭/數值大小/空白等 10 種運算子)、
  排序(文字 localeCompare 繁中、或當數字排且非數值排最後、穩定排序)、選欄,再匯出 CSV/JSON。管線固定順序
  trim→刪空→去重→篩選→排序→選欄。與 data-convert(格式互轉)、list-compare(兩份清單比對)互補。
  含個資的名單全程瀏覽器處理、不上傳(線上 CSV 清理站都要上傳)。引擎 src/features/tableClean.ts
  (純函式無 DOM,複用 data-convert 的 parseCSV/rowsToCSV,以第一列定欄數補齊/裁切短長列、數值比較吃千分位逗號)
  + 回歸測試 scripts/test-tableclean.mjs(43 筆:解析/TSV/引號/補齊裁切/各清理動作/篩選 10 運算子/數值與穩定排序/
  選欄越界/序列化/端到端管線,併入 npm test)。零新相依;type-check + 全測試 + build 通過 — 2026-06-17
- 亂碼修復(mojibake-fix,category=workshop):修復最常見且可還原的一類亂碼 —— 原文是 UTF-8 卻被當成
  西歐編碼(Latin-1 / Windows-1252)讀,導致「中文」變 ä¸­æ–‡、é 變 Ã©、彎引號變 â€™。做法:把畫面上的
  亂碼字元逆推回原始位元組(0x00–0xFF 直接對應 + Windows-1252 在 0x80–0x9F 的可見特殊字反查表),
  再用 TextDecoder('utf-8',{fatal}) 重新解讀;以「亂碼嫌疑分數」是否下降決定是否接受,最多 5 輪
  (處理雙重/三重亂碼),且偵測到「修了反而更糟」會自動保持原狀不破壞正常文字。誠實揭露限制:含 �(U+FFFD)
  代表位元組已遺失不可還原、Big5 被當 UTF-8 的反向亂碼也無法救。引擎 src/features/mojibake.ts
  (reencodeToBytes/fixOnce/suspicionScore/fixMojibake 純函式無 DOM)+ 回歸測試 scripts/test-mojibake.mjs
  (26 筆:歐語符號/中文/中英混合/emoji/雙重亂碼/正常文字不破壞/逆推與分數,以 latin1 還原程序產生樣本,
  併入 npm test)。零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 金額大寫互轉升級:num-to-chinese 新增「中文數字 → 阿拉伯數字」反向模式(模式切換分頁),
  讀支票/合約大寫或老文件時核對。引擎 amountChinese.ts 新增 chineseToNumber:加性解析器
  (個位 number、小單位十百千/拾佰仟、大單位萬億兆分節結算 total/section/number),支援大寫與一般、
  兩=2、〇/零、簡體 万亿、阿拉伯混用(5萬)、小數「點/点」逐字串接;無法辨識字/多個小數點回錯誤。
  回歸測試 test-amountchinese.mjs +26 筆(十/二十三/一百零五/兩百零五/億萬完整 123456789/兆/混用/小數/
  錯誤處理/與正向 amountToChinese 來回一致),併入既有 npm test。零新相依;type-check + 全測試 + build 通過 — 2026-06-17
- CSV ↔ Markdown 表格(markdown-table,category=workshop):把 CSV/Excel 表格轉成 GitHub/Notion 風格的
  Markdown 表格(依顯示寬度對齊、CJK 全形算 2 格),或把 Markdown 表格轉回 CSV。寫 README/issue/Notion/HackMD
  時免手刻表格。儲存格內 | 自動逸出 \|、換行轉空白;可指定靠左/置中/靠右(分隔列 :--- / :--: / --:);
  解析容許有無外框管線、偵測對齊、短列補空長列裁切、找不到分隔列報錯。引擎 src/features/markdownTable.ts
  (displayWidth/tableToMarkdown/splitRow/markdownToTable 純函式無 DOM,複用 tableClean 的 Table)+ 回歸測試
  scripts/test-markdowntable.mjs(22 筆:行數/分隔列/逸出/換行/對齊/無外框/對齊偵測/還原/補裁/報錯/往返一致含中文,
  esbuild 多入口打包後跑,併入 npm test)。補足 data-convert 不含 Markdown 的缺口;不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 文字資料抽取(data-extract,category=workshop):從一大段雜亂文字(轉寄信、文件、PDF 複製文字、貼上網頁)
  一次抓出 Email、網址、台灣手機、有效統一編號,各自去重(email 忽略大小寫、手機正規化成 09 開頭 10 碼)。
  統編複用既有 isValidVat 做檢查碼驗證 → 高精度不誤抓;網址只吃 RFC 3986 ASCII 安全字元(遇中文即停)
  並去尾端標點;手機用 (?:\+?886|0)9... 樣式且過濾市話/不足碼;統編用 lookbehind/lookahead 取獨立 8 碼不從長數字誤抓。
  與 text-redact(遮蔽個資)互補(本工具是抽出)。引擎 src/features/dataExtract.ts(extractEmails/Urls/Mobiles/Vats/
  normalizeMobile/extractAll 純函式無 DOM,import vatCheck.isValidVat)+ 回歸測試 scripts/test-dataextract.mjs
  (23 筆:各類抽取/去重/尾端標點/+886 正規化/市話不誤抓/統編檢查碼過濾/長數字不誤抓/整合/空輸入,併入 npm test)。
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- JSON 攤平轉表格(json-flatten,category=workshop):把巢狀 JSON(物件裡有物件/陣列)壓平成路徑鍵
  (a.b、a[0].c),頂層陣列→一元素一列、頂層物件→單列,缺欄自動補空,輸出 CSV/JSON 丟進 Excel。
  補足 data-convert「只吃扁平物件陣列」的缺口(巢狀 API 回傳)。boolean→true/false、null→空、空物件/空陣列
  保留鍵避免整列消失、頂層純值用 value 鍵。引擎 src/features/jsonFlatten.ts(flattenInto/flattenOne/
  flattenJson/flattenedToCSV 純函式無 DOM,複用 data-convert 的 objectsToCSV 做欄位聯集+引號逸出)+ 回歸測試
  scripts/test-jsonflatten.mjs(23 筆:巢狀路徑/陣列索引/型別/頂層純值/空物件陣列/多列聯集/CSV 逸出/真實範例,
  併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 表格統計 / 樞紐(table-stats,category=workshop):把一份明細「依某欄分組,對另一欄做統計」
  (等同 Excel 樞紐分析 / SQL GROUP BY):支援 count/sum/avg/min/max/distinct 六種聚合,可選不分組(全部一組);
  數值自動吃千分位逗號+去空白、非數值在 sum/avg/min/max 時略過(全組無數值回空字串),avg 分母只算有效數值;
  分組維持首次出現順序;結果兩欄(分組欄/「全部」+ 統計欄),可下載 CSV/JSON。與 table-clean/table-merge/
  list-compare/data-convert 構成資料工具家族。引擎 src/features/tableStats.ts(parseNum/formatNum 整數不帶小數、
  其餘最多 4 位去尾零 / aggregate / computeStats 純函式無 DOM,複用 tableClean 的 Table)+ 回歸測試
  scripts/test-tablestats.mjs(28 筆:六種聚合、空值處理、不分組、千分位、全非數值、首次順序、parseNum/formatNum,
  esbuild 多入口打包後跑,併入 npm test)。資料不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 表格合併 / VLOOKUP(table-merge,category=workshop):把兩份表格依「對應欄(key)」併成一張,
  等同 Excel VLOOKUP / SQL JOIN(例:左=客戶名單、右=訂單金額,依 Email 對起來)。支援 left join
  (保留所有左列、對不到留空)與 inner join(只留對到的列);右表同 key 取第一筆(VLOOKUP 行為)並回報重複數;
  key 預設忽略英文大小寫+去前後空白(僅 key 正規化,資料值原樣保留);右表欄名與左表衝突自動加「(2)」不覆蓋;
  可選是否帶入右表 key 欄。回報 matched/unmatched/rightDuplicates 統計。與 table-clean(單表清理)、
  list-compare(集合比對)、data-convert(格式互轉)互補。引擎 src/features/tableMerge.ts(純函式無 DOM,
  複用 tableClean 的 Table/parseTable/toCSV)+ 回歸測試 scripts/test-tablemerge.mjs(20 筆:left/inner、
  填值留空、計數、大小寫/去空白 key、重複 key 取第一、欄名衝突改名、多欄、空右表、序列化整合,
  以 esbuild 多入口打包後跑,併入 npm test)。含個資名單不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 動圖工坊(gif-studio,category=workshop):把多張圖片做成會動的 GIF —— 線上 GIF 製作站多半要上傳照片、
  滿廣告又加浮水印;本工具全程在瀏覽器用 Canvas + gifenc(純 JS、無 WASM/worker)編碼、不上傳。可調輸出寬度
  (高度依第一張比例自動算,最長邊上限 1200px)、播放速度(1–24 張/秒)、縮放方式(完整顯示留白/填滿裁切/拉伸)、
  底色、顏色數(8–256,每張各自量化最佳調色盤畫質較佳)、循環次數(無限/1/3/5,首張寫 repeat 旗標);拖放/多次加入/
  上下移調序/移除;編碼分影格 await 讓進度可更新。引擎 src/features/gifStudio.ts(encodeGif/planCanvasSize/
  fpsToDelay 純函式,像素進、GIF 位元組出,與環境無關)+ 回歸測試 scripts/test-gifstudio.mjs(23 筆:GIF89a 檔頭/
  邏輯螢幕寬高/結尾 0x3B/NETSCAPE2.0 循環擴充/maxColors/空影格與像素數不符與尺寸錯誤、planCanvasSize 等比與最長邊上限、
  fpsToDelay 夾限與 10ms 對齊,以 esbuild 打包含 gifenc 後跑,併入 npm test)。gifenc 動態 import + gif-vendor chunk
  (gzip 3.2KB)不預快取;gifenc 無型別宣告於 env.d.ts 補上;type-check + 全測試 + build 通過 — 2026-06-18
- 證件浮水印加註(image-watermark):交付證件影本前斜向重複加註用途(防盜用,內政部宣導作法),
  canvas 把文字燒進像素、密度/顏色/角度可調、不上傳、可批次;與 image-redact 互補 — 2026-06-15
- 文字清理工坊(text-clean):清掉貼上時夾帶的零寬/不可見字元、全形↔半形、多餘空白/空行、
  行首編號、大小寫,即時字數統計;零相依、不上傳 — 2026-06-15
- 本機密碼產生器(password-gen,category=life):crypto.getRandomValues + 拒絕取樣(無取模偏差),
  保證每類至少一字 + Fisher–Yates 洗牌,熵/強度標示,不連網不記錄(線上產生器可能偷記密碼)— 2026-06-15
- 身分證字號檢核(tw-id-check,category=life):內政部檢查碼規則 + 首碼縣市對照表(I/O/W/X 跳號),
  抓打錯一碼/亂編假號;明確標示「檢查碼正確≠真有此人」;本機計算不上傳。A123456789 驗證通過 — 2026-06-15
- 統一編號檢核(tw-vat-check,category=life):財政部統編檢查碼規則(加權[1,2,1,2,1,2,4,1]、乘積個+十位和,
  現行被 5 整除、第 7 碼為 7 的加 0/加 1 特例),抓打錯一碼/亂編假統編(假發票、人頭公司常見);
  單筆 + 批次(換行/逗號/分號分隔,標無效與重複、可複製無效清單,對帳整名單用);明確標示「檢查碼正確≠真有此公司」
  並附經濟部商工登記公示資料查詢官方連結(查證引導,延續 anti-scam DNA)。引擎 src/features/vatCheck.ts
  (純函式無 DOM)+ 回歸測試 scripts/test-vatcheck.mjs(含台積電/鴻海/統一企業實算、特例分支、批次,併入 npm test,28 筆全過)。
  零三方相依;type-check + test + build 通過 — 2026-06-16
- 電話號碼檢視 / 防詐(phone-check,category=anti-scam):貼上陌生來電號碼,正規化(+886 ↔ 0、去連字號)、
  判類型(手機/市話/免付費/付費語音/短碼/國外)、依區碼推測區域,標出常見詐騙警訊(付費語音 0204 回撥高額、
  國際冠碼/+ 開頭卻自稱國內機構、+886 來電顯示可偽冒等),附 165 全民防騙網 + Whoscall 查證連結。
  明確聲明「非詐騙判定、來電顯示可偽冒」。引擎 src/features/phoneCheck.ts(純函式無 DOM)+ 回歸測試
  scripts/test-phonecheck.mjs(21 筆,併入 npm test)。延續 anti-scam DNA 與「可疑賣家/電話查證引導」待辦。
  零三方相依;type-check + test + build 通過 — 2026-06-16
- 圖片裁切/旋轉(image-crop,category=workshop):把拍歪照片轉正、裁掉背景;左右轉90°/水平鏡像/垂直翻轉 +
  拖曳框選裁切(複用 image-redact 的 pointer 拖曳比例邏輯),操作歷史可逐步復原/回到原圖;
  中間步驟用無損 PNG 暫存避免多次編碼失真,下載時才依選定格式(JPG/PNG+品質)重新編碼;
  canvas 處理、不上傳、重編碼自動去 EXIF。零相依 — 2026-06-15

- 證件照排版 4×6(id-photo,category=workshop):把一張大頭照排成一張 4×6 吋相紙(300 DPI)的多張
  一吋(2.8×3.5)/二吋(3.5×4.5)證件照,可直接拿去超商相片機/沖印店沖洗。鎖定證件比例的可拖曳裁切框
  (框大小用滑桿、整體拖曳對位,box.h 依 spec 比例與圖片長寬連動,畫面上與單張預覽都不變形)+ 即時單張預覽;
  排版時直式/橫式各算可放張數取較多者、整列置中、淺灰裁切參考線;另提供「只下載單張」。
  臉部照片是高敏個資 → 沖印店要錢、線上排版站要上傳臉,本工具全程 canvas 在瀏覽器處理、不上傳、
  重編碼去 EXIF。零相依(純 canvas);換尺寸/首次載入用 nextTick 補畫預覽避免 canvas 清空後空白。
  type-check + build 通過 — 2026-06-16
  - 評估後跳過圖片去背(@imgly/background-removal):需 onnxruntime-web peer + 執行期向 IMG.LY CDN 抓
    ~40MB ONNX 模型 + 引入 4 個 high 漏洞,與「乾淨、不依賴他人伺服器」DNA 衝突且過重,依指示跳過。
- 字幕工坊(subtitle-studio,category=workshop):SRT ↔ WebVTT 互轉、整體平移對時(字幕快/慢幾秒,
  正延後/負提早)、速率縮放(影格率不同造成的漸進偏移)、自動重新編號。線上字幕站要上傳可能含劇本/課程
  機密的字幕檔,本工具全程瀏覽器純函式處理、不上傳。零相依:引擎 src/features/subtitle.ts
  (parseTime/formatTime/parseSubtitles/shiftCues/scaleCues/toSrt/toVtt,以毫秒為內部單位,解析時略過
  WEBVTT 標頭/NOTE/STYLE 與 cue 設定、支援逗號/點與省略小時),含回歸測試 scripts/test-subtitle.mjs
  (23 筆,併入 npm test);上傳檔自動依副檔名切換輸出格式、即時統計句數與時間範圍、複製/下載/範例。
  type-check + test + build 通過 — 2026-06-16
- 網站圖示 / Favicon 產生器(favicon-gen,category=workshop):上傳一張圖,輸出 favicon.ico
  (canvas 各尺寸 PNG → 自製 ICO 容器包 16/32/48)、apple-touch-icon(180)、PWA 圖示(192/512),
  附可直接貼上的 HTML。線上 favicon 站要上傳尚未公開的 logo、夾廣告、有的綁追蹤,本工具全程瀏覽器
  canvas 處理、不上傳。縮放完整/填滿 + 背景(透明/白/黑/品牌色)可選、即時預覽。
  零相依:ICO 組裝引擎 src/features/ico.ts(純函式 little-endian,256 尺寸欄位寫 0),含回歸測試
  scripts/test-ico.mjs(16 筆,驗證標頭/entry/offset/影像放置,併入 npm test)。
  type-check + test + build 通過 — 2026-06-16

- 檔案分割 / 合併(file-split,category=workshop):大檔寄不出去(email/LINE/雲端有大小限制)時,
  把任何檔案切成小份分批傳,收到後再合併還原。線上分割站要把可能很大又含機密的檔案整個上傳到別人伺服器、
  滿廣告又限大小;本工具用 Blob.slice(惰性、不需整檔讀進記憶體)切割、new Blob([...parts]) 合併,
  全程瀏覽器不上傳。分割檔用標準 .001 .002 命名(與 7-Zip/HJSplit 一致),對方就算沒有本工具也能用內建
  copy /b(Windows)/ cat(Mac/Linux)指令合併;合併會依檔名序號自動排序並偵測缺份/重複避免合出損壞檔。
  引擎 src/features/fileSplit.ts(planChunks 切點規劃 + 份數上限保護、partName 補零命名、partIndexOf/baseNameOf、
  orderParts 排序+序列檢查、joinBytes 供測試驗證來回一致;純函式無 DOM)+ 回歸測試 scripts/test-filesplit.mjs
  (26 筆:切點/整除/單份/錯誤/命名/序號/排序缺份重複/位元組來回一致含中文,併入 npm test)。零三方相依、不上傳。
  ⚠️ 本環境 npm registry 被網路政策擋(403)無法裝 node_modules,改用 node --experimental-strip-types
  直跑引擎驗證(26 筆全過);.vue 無法本機 build/type-check,靠細讀 + 既有 image-redact 模式 + 部署 Action
  的真實 build 把關(deploy needs build,build 失敗不會發佈,線上站安全)— 2026-06-16

## 可信策展(2026-06:延續下載中心模式,資料 public/data/*.json + 容錯視圖)
- 推薦好站(/picks,views/Picks.vue + public/data/picks.json):人工挑選、免費好用、連結皆指向官方;
  旗艦收錄「防詐查證」(165/事實查核/MyGoPen/Cofacts)貼合本站 DNA;另含 AI 助手/翻譯學習/修圖設計/台灣在地。
  finder 加虛擬項 picks-center 讓關鍵字導向;App 導覽 + 首頁入口卡;NetworkFirst 自動涵蓋新 JSON — 2026-06-15

## 處理工坊(續)
- QR Code 產生器(qr-generate,category=workshop):qrcode 函式庫,文字/網址、WiFi、vCard 三模式,
  即時預覽 + 下載 PNG、尺寸/容錯等級可調;直接編碼原始內容(不像線上產生器偷塞追蹤短網址),
  輸入不上傳。qrcode 動態 import,precache +33KB(可接受,未拆 vendor)— 2026-06-15

## 處理工坊(續 2)
- 顏色可讀性檢測(contrast-check,category=workshop):輸入文字色與背景色,依 WCAG 2.1 算對比比值,
  判斷一般字/大字下達不達 AA/AAA,即時預覽實際配色。做簡報/海報/網頁/長輩友善文件選色用,與色彩工坊互補。
  純函式引擎 src/features/contrast.ts(parseColor 吃 #RGB/#RRGGBB/rgb()、relativeLuminance、contrastRatio、
  grade 一般/大字 AA/AAA + UI),回歸測試 scripts/test-contrast.mjs(23 筆:解析/黑白=21/同色=1/
  #767676 vs #777777 AA 臨界/各灰階門檻邊界,併入 npm test 全 784 筆)。零相依、不上傳;type-check + build 通過 — 2026-06-18
- 錄音機(voice-recorder,category=workshop):用麥克風錄語音備忘/訪談/會議/長輩口述,
  可暫停/繼續、即時音量計(AnalyserNode getByteTimeDomainData 算 peak)確認有收音、試聽後下載音檔。
  getUserMedia + MediaRecorder 全程在裝置錄製、聲音不上傳;mime 自動挑選(opus/webm→mp4→ogg)決定副檔名;
  收尾統一 cleanupStream(停軌道/關 AudioContext/取消 rAF)避免麥克風一直亮。與螢幕錄影(錄畫面)互補。
  UI-only 無純邏輯可單元測,比照 screen-record 由部署 build 把關;type-check + build 通過 — 2026-06-18
- 條碼產生器(barcode-generate,category=workshop):把料號、商品編號、書本 ISBN 做成一維條碼
  (CODE128/EAN-13/EAN-8/UPC-A/CODE39/ITF-14),可下載向量 SVG 或 3× 高解析 PNG 印標籤,與 QR Code 產生器
  (二維)互補。線上條碼站常滿廣告/限量/偷塞追蹤;本工具用 JsBarcode 在瀏覽器產生、不上傳。
  純函式引擎 src/features/barcode.ts:GS1 檢查碼(EAN-13/EAN-8/UPC-A/ITF-14 共用「由右交替乘 3、1」)
  + 各格式輸入驗證/正規化(少打檢查碼自動補上並提示、CODE39 自動轉大寫、CODE128 擋中文),與 DOM 無關可 Node 測。
  回歸測試 scripts/test-barcode.mjs(22 筆:以已知真實條碼核算檢查碼/補碼/檢查碼錯誤提示/長度字元驗證/空輸入,
  併入 npm test,全 761 筆通過)。JsBarcode 動態 import + barcode-vendor chunk(68KB)不預快取;
  套件未宣告 types 欄位於 env.d.ts 補最小宣告。type-check + 全測試 + build 通過 — 2026-06-18
- 文字差異比對(text-diff,category=workshop):比對合約改版/條款/規格新舊兩版,
  逐行 + 行內逐字標出改了哪裡(綠＋紅－、配對修改行做詞層級 LCS)。線上 diff 工具多半要把
  可能機密的文字送他人伺服器,此工具全程瀏覽器計算、不上傳。零相依:引擎 src/features/textDiff.ts
  (泛型 LCS,行層級→配對行詞層級),含回歸測試 scripts/test-textdiff.mjs(13 筆,併入 npm test);
  忽略大小寫/空白、行號對照、5000 行上限保護、對調/範例/複製。type-check + build 通過 — 2026-06-15

- PDF 取出文字(pdf-studio 新增「取出文字」分頁,ExtractText.vue + lib.extractPdfText):
  用既有 pdfjs-dist 的 getTextContent 抽出 PDF 可選取文字(依 hasEOL 還原斷行),方便複製/引用/搜尋;
  掃描影像 PDF 抽不到字時明確提示需 OCR、引導改用「PDF 轉圖片」;頁碼分隔可切、複製/下載 .txt、字數統計。
  零新相依(複用 pdf-vendor),不上傳 — 2026-06-15

- 圖片拼接 / 長圖(image-stitch,category=workshop):把多張截圖/收據/對話接成一張長圖(縱向)
  或長條(橫向);可選自動縮放統一寬/高、對齊(靠邊/置中)、間距、底色、PNG/JPG 品質;
  12000px 上限保護避免畫布過大當機。canvas 合成、不上傳、重輸出去 EXIF,零相依 — 2026-06-15

- PDF 頁碼(pdf-studio 新增「PDF 頁碼」分頁,PageNumbers.vue + lib.addPageNumbers):
  在每頁加上「第 X 頁」「X / Y」等頁碼,交付合約/報告前自動編號;格式 {n}/{total} 自訂、
  六向位置、起始頁碼、第一頁不標(封面)、顏色/字級可調。線上加頁碼工具要上傳機密文件且常付費限頁;
  頁碼以 canvas 畫成透明 PNG 蓋上(支援中文,複用浮水印作法),相同號碼+尺寸頁面共用嵌入圖。
  零新相依(複用 pdf-lib),不上傳;type-check + build 通過 — 2026-06-16

- PDF 壓縮(pdf-studio 新增「壓縮 PDF」分頁,Compress.vue + lib.compressPdfViaRaster):
  把每頁用 pdfjs 渲染成 JPEG 再以 pdf-lib 重組,維持原頁面尺寸(pt)。對「手機掃描/相片多」的 PDF
  (最常見寄不出去的情況)大幅縮小;三段強度(倍率+JPEG品質)。誠實揭露代價:文字會變成影像、無法再選取;
  顯示壓縮前後大小與省下%,若沒變小明確建議保留原檔。零新相依(複用 pdfjs+pdf-lib),不上傳 — 2026-06-16

- 本機加密保險箱(secure-box,category=workshop):用 Web Crypto AES-GCM 256 + PBKDF2(25 萬次)
  替文字或檔案上密碼,加密、解密、密碼全程本機不上傳;把結果寄出、另以電話告知密碼對方才解得開。
  引擎 src/features/cryptoBox.ts(純模組、僅用 globalThis.crypto,無 DOM 依賴,故可 Node 測);
  容器 magic"THB1"+salt(16)+iv(12)+密文;GCM 標籤自動偵測密碼錯誤/竄改/非本工具檔案。
  回歸測試 scripts/test-cryptobox.mjs(9 筆:來回/隨機性/錯密碼/竄改/格式,併入 npm test);
  明確警示「忘記密碼無法救回」。零三方相依;type-check + test + build 通過 — 2026-06-16

## 防詐騙(續)
- 信用卡卡號檢核(card-check,category=anti-scam):用 Luhn 檢查碼驗證卡號有沒有打對(少打/多打/錯一碼),
  依 IIN/BIN 開頭與長度判斷發卡組織(Visa/Mastercard/AmEx/JCB/UnionPay/Discover/Diners)。本機計算、不上傳、不儲存;
  明確聲明「檢查碼正確 ≠ 真有此卡」並衛教卡號+期限+末三碼/OTP 湊齊即遭盜刷、假客服話術與 165。
  純函式引擎 src/features/cardCheck.ts(luhnValid/detectBrand 規則順序處理 62/6011 專一前綴與 MC 2221–2720 新號段/
  formatCardNumber AmEx 4-6-5/checkCard 長度核對)+ 回歸測試 scripts/test-cardcheck.mjs(25 筆:公開測試卡號、
  Luhn 正反例、2720/2721 邊界、分組、整合,併入 npm test 全 809 筆)。零相依;type-check + 全測試 + build 通過 — 2026-06-18
- 郵件來源檢視 / 防冒名(email-check,category=anti-scam):貼上可疑信件的「郵件原始碼/標頭」,
  解析 From / Reply-To / Return-Path 與 SPF/DKIM/DMARC 驗證結果,比對寄件網域是否對得上,標出冒名釣魚
  常見破綻:顯示名稱藏別網域、回覆地址跑到別處(BEC 變更匯款)、退信來源不符、驗證失敗、免費信箱卻自稱機構。
  分 高風險/注意/參考 三級並白話解釋,明確聲明「標頭可偽冒、非詐騙判定」並導向官方查證 + 165。
  引擎 src/features/emailHeader.ts(splitHeaders 還原 RFC5322 折行、parseAddress、rootDomain 處理 com.tw 等
  台灣二級網域、analyzeHeaders;純函式無 DOM 可 Node 測)+ 回歸測試 scripts/test-emailheader.mjs
  (19 筆:折行/網域根/各冒名情境/驗證失敗,併入 npm test,全 181 筆通過)。零三方相依、不上傳;
  type-check + test + build 通過 — 2026-06-16
- 文字個資遮蔽(text-redact,category=anti-scam):貼上對話/單據文字,自動找出身分證、手機、
  信用卡、Email 並打碼;轉貼客服對話、分享截圖文字前先遮個資。引擎 src/features/piiMask.ts
  (純規則,身分證用內政部檢查碼、信用卡用 Luhn 驗證才遮,降誤判;重疊去重;保留分隔符)。
  可選類別、保留末 4 碼;即時計數;明確告知銀行帳號/地址/市話等不自動偵測需人工複查。
  回歸測試 scripts/test-piimask.mjs(20 筆,併入 npm test);與「圖片遮蔽」互補。
  零三方相依;type-check + test + build 通過 — 2026-06-16
- QR Code 解碼 / 看網址(qr-decode,category=anti-scam):上傳或貼上含 QR 的截圖/照片,
  用 jsQR 在瀏覽器解出內容(圖片不上傳);解出是網址時警示並一鍵帶 ?u= 丟到可疑網址檢查器
  (link-check 改讀 route.query.u 自動填入)。陌生 QR 直接掃易被導到釣魚頁,先看清楚再決定。
  jsQR 動態 import + qr-vendor chunk(131KB)不預快取 — 2026-06-15
- 照片隱私檢視器 EXIF(exif-viewer,category=anti-scam):exifr 解析照片夾帶的拍攝時間/機型/
  GPS 座標,GPS 紅框警示 + Google Maps 連結;沒夾帶則提示相對安全;連到圖片工坊去 EXIF。
  exifr 拆 exif-vendor chunk(75KB)+ globIgnores 不預快取,照片不上傳 — 2026-06-15
- 檔案校驗碼 / 完整性驗證(file-checksum,category=anti-scam):Web Crypto crypto.subtle.digest
  算 SHA-256/SHA-1/SHA-512,拖放/多選、貼上官方校驗碼自動比對(✓相符/✗不相符 + 警示),
  全程本機不上傳。貼合下載中心「附校驗碼」防掉包 DNA,連回 /downloads — 2026-06-15

- 名單比對 / 去重(list-compare,category=workshop):對帳、整名單最常見的兩件事 —— ①一份名單去重
  (找出重複幾次、留乾淨一份)②比對兩份名單算交集/只在A/只在B/聯集(如「全體」減「已繳」=還沒繳的人)。
  比對選項可忽略大小寫/全形半形/頭尾或多餘空白(避免「看似相同卻被當不同」),輸出保留首次出現原始樣子。
  與 data-convert(格式互轉)、text-diff(逐行逐字 diff)互補;線上同類工具要把含個資名單上傳他人伺服器,
  此工具全程瀏覽器、不上傳。引擎 src/features/listCompare.ts(純函式無 DOM:normalizeKey/parseList/dedupe/compare)
  + 回歸測試 scripts/test-listcompare.mjs(27 筆,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 抽籤 / 分組無偏差亂數引擎(random-picker,category=life):兩條排程各自新增了功能重複的抽籤工具
  (random-picker / random-draw),已合併為唯一的 random-picker(UI 較佳),並改用具拒絕取樣、有回歸測試的共用引擎
  src/features/randomDraw.ts(原 Math 洗牌 r*(i+1) 有取模偏差 → 改 cryptoRandInt 拒絕取樣,機率真正均等;
  純函式、亂數來源可注入故可確定性測試:cryptoRandInt/shuffle/drawWinners/makeGroupsByCount/makeGroupsBySize)。
  回歸測試 scripts/test-randomdraw.mjs(注入確定性 rand 驗輸出 + 6 萬次取樣驗範圍與均勻度,併入 npm test)。
  zero-dep;type-check + test + build 通過 — 2026-06-17

- 網址清理 / 看穿轉址(url-clean,category=anti-scam):①看穿轉址 —— 把 google.com/url?q=、
  Facebook l.php?u=、Outlook safelinks、l.instagram.com 等轉址包裝一層層拆開(含多層巢狀、迴圈/深度保護、
  通用強參數名 url/u/q/target… 偵測),先看清楚連結最後落點主機再決定點不點(詐騙常用包裝藏釣魚連結);
  ②清理追蹤 —— 移除 utm_*/pk_/mc_… 前綴與 fbclid/gclid/msclkid/igshid… 追蹤參數(大小寫不敏感),
  分享連結更乾淨更短不洩漏來源。與 link-check(風險啟發式)互補並交叉連結。引擎 src/features/urlClean.ts
  (純函式、只用標準 URL:cleanUrl/unwrapRedirect/processUrl)+ 回歸測試 scripts/test-urlclean.mjs
  (24 筆:清理/大小寫/多層巢狀/safelinks/自指不誤拆/整合,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 金額轉國字大寫(num-to-chinese,category=life):把數字金額轉中文大寫(壹貳參…拾佰仟萬億兆、元角分整),
  支票/本票/合約/收據填寫防竄改用。可含千分位逗號、四捨五入到分(進位用 BigInt 避免大數誤差)、可到兆級;
  正確處理節內與節間的零(零壹佰、壹億零壹、收斂雙零、去尾零)、角為零分不為零補零。輸出「金額大寫(新臺幣…元整)」
  與「純數字大寫」兩種。引擎 src/features/amountChinese.ts(純函式)+ 回歸測試 scripts/test-amountchinese.mjs
  (37 筆:整數零處理 / 角分 / 四捨五入跨整數進位 / 千分位 / 溢位,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 行事曆事件 .ics 產生器(event-ics,category=life):填活動標題/時間/地點/備註/連結/提醒,產生符合 RFC 5545 的
  .ics 下載,直接匯入 Google/Apple/Outlook —— 不必像活動邀請服務那樣授權存取你的行事曆。支援定時(未填結束預設 +1 小時、
  跨日進位)與全日(DTEND 取隔天排他)、VALARM 事前提醒、RFC 文字逸出(逗號/分號/換行/反斜線)、CRLF 行尾、檔名去非法字元。
  採浮動本地時間。引擎 src/features/icsEvent.ts(純函式、uid/dtstamp 可注入故可測)+ 回歸測試 scripts/test-icsevent.mjs
  (27 筆,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 日期計算機(date-calc,category=datetime):①兩日期相差幾天(另標含頭尾)②從某天加/減 N 天(可勾「只算工作日」
  跳過週末)③兩日期間工作日數(含起訖、排週末)。用於契約/退貨鑑賞期/繳費/活動倒數到期日推算;與 age-calc(年齡)、
  roc-year(年制換算)、due-date(預產期)互補,專做一般日期算術。以 UTC 為基準避免 DST 誤差;parseDate 回推驗證擋
  2/30 等假日期、閏年判斷正確。引擎 src/features/dateCalc.ts(純函式)+ 回歸測試 scripts/test-datecalc.mjs(28 筆,
  併入 npm test)。明確標示「只排週末未扣國定假日」。零三方相依;type-check + test + build 通過 — 2026-06-17

- 檔案真實類型檢測(file-type,category=anti-scam):讀檔案開頭「魔術位元組」判斷實際格式,與副檔名比對。
  抓出詐騙常見的「副檔名造假」—— 名為 照片.jpg 實為 Windows 執行檔(PE/MZ)會標🚫danger;類型不符標 mismatch、
  辨識不出標 unknown、相符標 ok。支援 PDF/PNG/JPEG/GIF/BMP/WebP、ZIP(含 docx/xlsx/apk 等 ZIP 封裝視為相符)、
  RAR/7z/gzip、舊 OLE Office、MP3/WAV/MP4/AVI、EXE/ELF/Mach-O 等;RIFF 系列與 MP4 offset 4 特判。
  明確聲明「非防毒、相符≠安全」,與 file-checksum 交叉連結。引擎 src/features/fileType.ts(純函式:detectType/
  getExtension/checkFile)+ 回歸測試 scripts/test-filetype.mjs(27 筆,併入 npm test)。只讀前 32 bytes、不上傳。
  零三方相依;type-check + test + build 通過 — 2026-06-17

- 合併列印 / 套印(mail-merge,category=workshop):一份範本(內含 {{欄位}} 佔位符)+ 一份名單(第一列欄位名,
  自動偵測逗號或 Tab、支援引號內逗號/換行/跳脫雙引號,可直接貼 Excel),幫每筆各產生填好內容的文字 —— 年節祝福、
  開會通知、繳費提醒、邀請函免逐一改名。回報範本欄位 / 缺漏欄位(缺者留空),逐筆或一次複製。線上套印服務常要上傳
  含個資名單,本工具全程瀏覽器、不上傳不寄送。引擎 src/features/mailMerge.ts(純函式:extractPlaceholders/parseTable/
  merge,內含最小 CSV/TSV 解析器)+ 回歸測試 scripts/test-mailmerge.mjs(23 筆,併入 npm test)。
  零三方相依;type-check + test + build 通過 — 2026-06-17

- 工時時數表(work-hours,category=labor):加總多段班別工時,自動處理跨午夜夜班(下班<=上班 → +24h)、
  扣除休息分鐘(休息≥工時則 0 不為負)、可選填時薪估算「原始工資」(時數×時薪,明示未含加班加成,連結 overtime-pay)。
  打工/排班族對帳薪資、報工時用。引擎 src/features/workHours.ts(純函式:parseTime/shiftMinutes/totalMinutes/
  formatHM/toDecimalHours/estimatePay)+ 回歸測試 scripts/test-workhours.mjs(24 筆,併入 npm test)。
  零三方相依;type-check + test + build 通過 — 2026-06-17

- 文字朗讀(text-speech,category=life,長輩友善):用瀏覽器內建 Web Speech API(speechSynthesis)把貼上的文字唸出來,
  給視力不便/眼睛累/想用聽的長輩與家人。中文語音優先排序、速度/音調可調、播放/暫停/繼續/停止、不支援時優雅降級提示。
  全程在裝置上發聲、文字不上傳、免帳號。UI-only(瀏覽器 API 無純邏輯可單元測,雲端無瀏覽器,靠 type-check + 細讀
  + 功能偵測與 graceful degradation 確保安全);零三方相依;type-check + build 通過 — 2026-06-17

- vCard 聯絡人產生器(vcard-maker,category=workshop):把單筆聯絡人,或一份 Excel/CSV 通訊錄(第一列欄位名)
  做成標準 vCard 3.0 的 .vcf,直接匯入 iPhone/Android/Google/Apple/Outlook 聯絡人,免逐筆手動新增。線上 CSV→vCard
  轉換器要把含姓名電話的個資名單上傳他人伺服器,本工具全程瀏覽器、不上傳(延續 mail-merge/data-convert/event-ics
  「不上傳含個資名單」DNA)。單筆表單 + 批次貼 Excel 兩模式;欄位名同義詞自動對應(姓名/手機/市話/Email/公司/職稱/
  地址/生日/網址/備註,中英文皆可,同欄位重複取第一個、其餘列未對應)。引擎 src/features/vcard.ts(純函式無 DOM:
  escapeText 依 RFC 6350 逸出反斜線/逗號/分號/換行、buildVCard/buildVCards、tableToContacts;CRLF 行尾、為免折行截斷
  中文不做 line folding、N/FN 顯示名 fallback、TEL CELL/HOME、ADR 街道欄、URL/BDAY 不逸出)+ 回歸測試
  scripts/test-vcard.mjs(43 筆:逸出/結構/姓名分合/全欄位/批次略過空白/表格對應/英文大小寫/重複欄/端到端,
  併入 npm test)。本環境 npm registry 已可安裝,實際跑通 type-check + 全測試 + build。零三方相依、不上傳 — 2026-06-17

- 日期計算機升級工作天試算(date-calc):工作日模式新增「放假日 / 補班日」自填(進階面板 CustomDays.vue),
  把交期/請款的工作天算準 —— 扣掉國定假日/公司休假、加回颱風補班/補行上班。引擎 dateCalc.ts 新增 BusinessOpts
  (holidays/workdays Set)、isWorkday(優先序:補班 > 假日 > 週末)、parseDateList(從文字抽合法 YYYY-MM-DD、去重濾無效);
  addBusinessDays/businessDaysBetween 接受 opts 且不帶 opts 時與舊行為完全相同(向後相容)。
  刻意**不內建台灣國定假日**(假日年年不同、雲端沙盒無法驗證官方來源,寫死易誤導)→ 改由使用者依人事行政總處
  辦公日曆表自填、附官方連結,延續「資料可驗證」原則。回歸測試 test-datecalc.mjs +13 筆(parseDateList/isWorkday
  優先序/加扣假日/計補班/無 opts 向後相容)。零新相依;type-check + 全測試 + build 通過 — 2026-06-17

- PDF 工坊「整理頁面」支援逐頁旋轉(pdf-studio/Organize):每頁新增順/逆時針 90° 旋轉鈕,縮圖即時
  CSS transform 預覽,匯出時把旋轉燒進 PDF。lib.ts buildFromOrder 新增 rotations 參數(與 order 等長),
  用 pdf-lib getRotation().angle + delta 正規化後 setRotation(degrees);Organize 以 rot 陣列與 order 同步維護
  (刪除/移動/復原一起 splice/swap)。解決手機/掃描器拍歪的文件要轉正的常見痛點;零新相依(複用既有 pdf-lib)。
  type-check + 全測試 + build 通過 — 2026-06-17

- 音訊工坊(audio-studio,category=workshop):載入音檔(mp3/m4a/wav/ogg/aac…),裁剪片段、淡入淡出、
  音量增減(dB)、峰值正規化、轉單聲道,匯出無失真 16-bit PCM WAV。做手機鈴聲、剪訪談/會議前後空白、
  截一段音訊都好用。與「錄音機」「螢幕錄影」(擷取)互補(這支是編輯)。解碼交給瀏覽器
  AudioContext.decodeAudioData(支援格式依瀏覽器),其餘為純前端運算。處理管線:裁剪→淡化→增益→正規化→單聲道。
  引擎 src/features/audioStudio.ts(encodeWav/decodeWav/sliceAudio/applyGain/applyFade/normalize/mixToMono/
  duration/estimateWavBytes 純函式無 DOM:WAV 為手寫 DataView header + 交錯 16-bit、-1/+1 對稱映射,
  decodeWav 掃 chunk 找 fmt/data 供測試讀回)+ 回歸測試 scripts/test-audiostudio.mjs(26 筆:量測/WAV 編解碼
  來回誤差在量化精度內/非 WAV 報錯/裁剪夾範圍與空段/增益夾不破音/淡入淡出端點為 0 中點半值/正規化峰值≈0.99
  與全靜音不爆 NaN/轉單聲道為平均,以 esbuild 打包後跑,併入 npm test)。零新相依、音檔不上傳;
  type-check + 全測試 + build 通過 — 2026-06-18

- PDF 工坊新增「併頁省紙(N-up)」分頁(pdf-studio/NUp):把多頁 PDF 縮排到每張 A4 放 2/4/6/9 頁
  (2-up 橫式並排、4/6/9 直式格線),印講義、校稿、省紙最實用 —— 線上 N-up 工具多半要上傳檔案。
  來源頁面等比例縮放、置中塞格不變形;不足一張的最後幾格留白。版面幾何抽成純函式 nupLayout.ts
  (A4/sheetLayout/cellBox 由左到右上到下、PDF 左下原點/fitInto 等比置中,無 pdf-lib、無 DOM 可 Node 測);
  lib.ts 新增 nUpPdf 用 pdf-lib embedPages + drawPage 把幾何畫成實體頁。限制:pdf-lib 嵌入頁不套來源
  /Rotate,旋轉頁建議先用「整理頁面」轉正(UI 已提示)。回歸測試 scripts/test-pdfnup.mjs(32 筆:
  各 preset 方向/格線/退回 2-up、格子位置與邊界、換列、fitInto 置中與維持寬高比/邊界不超出/零尺寸不爆,
  esbuild 打包後跑,併入 npm test)。零新相依(複用既有 pdf-lib);type-check + 全測試 + build 通過 — 2026-06-18

- PDF 工坊新增「簽名 / 蓋章」分頁(pdf-studio/SignStamp):把簽名檔或印章圖片直接蓋到 PDF 頁面上 ——
  在頁面預覽圖(pdfjs renderThumbnails maxEdge 1100)上拖曳定位、滑桿調大小,可只蓋當前頁或勾選「每一頁都蓋」
  (印章/騎縫)。閉合既有流程:用本站「手寫簽名製作」做透明背景 PNG → 在此蓋到合約,全程不上傳。
  與「PDF 浮水印」(整頁重複加註防盜)互補,這支是「在指定位置簽一次名/蓋一個章」。座標幾何抽成純函式
  signLayout.ts(clamp/heightFrac/clampBox/centerBox/imagePlacement:畫面左上原點比例 → pdf-lib 左下原點 pt,
  維持原圖長寬比、夾在頁內;無 pdf-lib、無 DOM 可 Node 測);lib.ts 新增 stampImageOnPdf(embedPng/Jpg + drawImage)
  與 getPageRotations(供 UI 提醒旋轉頁會偏移)。限制:pdf-lib 在 MediaBox(未套 /Rotate)作圖,旋轉頁位置會偏,
  偵測到即提示先用「整理頁面」轉正。回歸測試 scripts/test-signlayout.mjs(23 筆:clamp/heightFrac/左上與右下與
  置中座標/畫面往下對應 pdf y 變小/clampBox 夾邊界後不超出上下左右/寬度上下限,esbuild 打包後跑,併入 npm test)。
  零新相依(複用既有 pdf-lib + pdfjs-dist);type-check + 全測試 + build 通過 — 2026-06-18

- 影片轉 GIF(video-gif,category=workshop):把一小段影片(MP4/WebM/MOV…)轉成會動的 GIF ——
  用 <video> 逐點 seek + Canvas drawImage 取 RGBA + 既有 gifenc 編碼,全程在瀏覽器、影片不上傳、
  無廣告、無浮水印、不限時長。零新相依(複用 gifStudio.ts 的 encodeGif/planCanvasSize/fpsToDelay)。
  UI:內嵌 <video controls> 可拖到位置,一鍵「設為開始/結束」裁時間區間;寬度/fps/顏色數/循環可調;
  即時顯示預計影格數,超過 MAX_FRAMES=300 提示縮短區間。取樣規劃抽成純函式 planVideoFrameTimes
  (起點起以 1/fps 等間隔取樣到結束前、超上限截斷、四捨五入到毫秒;與 DOM 無關可 Node 測),
  併入 scripts/test-gifstudio.mjs +18 筆(影格數/起點偏移/遞增/截斷/極短至少 1 張/錯誤處理/fps 夾限)。
  seek 以 'seeked' 事件 + 1.5s 逾時保險;getContext willReadFrequently。與 gif-studio(多張圖片→GIF)
  互補。type-check + 全測試 + build 通過 — 2026-06-18

- IG 九宮格切圖(image-grid,category=workshop):把一張大圖切成 cols×rows 格,依序發到 Instagram
  主頁拼成一整張大圖牆。純 Canvas 裁切、圖片不上傳、無廣告、無浮水印。幾何抽成純函式 imageGrid.ts
  (computeCoverCrop 以中心 cover 裁切到 cols:rows 比例;planGridTiles 回每格來源矩形 + displayIndex +
  postOrder——IG 新貼文排最前故 postOrder=total−displayIndex+1,先貼右下、主頁才由左上拼起;無 DOM 可 Node 測)
  + 回歸測試 scripts/test-imagegrid.mjs(24 筆:寬/高圖裁切置中、3:1/3:2 比例、裁切不超界、格數/面積總和/
  相鄰無縫接續/postOrder 排列/錯誤處理,esbuild 打包後跑,併入 npm test)。預覽框即時顯示保留範圍與格線;
  JPG/PNG、品質可調;打包 ZIP 動態 import 既有 buildZip(STORE)。零新相依;type-check + 全測試 + build 通過 — 2026-06-18

- 表格拆分(table-split,category=workshop):把一份大 CSV/Excel 表格拆成多份 —— 兩種模式:
  (1)按列數平均切(每 N 列一份,表頭帶進每份),(2)按某欄的值分組(同值歸一份,檔名=該欄值,
  可選忽略大小寫、可選輸出時移除分組欄)。匯出可打包 ZIP(每份一個 CSV/JSON,複用 zipStudio.buildZip)
  或匯出單一多工作表 Excel(xlsx.ts 新增 sheetsToExcelBlob,工作表名清非法字元/夾 31 字/去重)。
  Excel 讀檔走既有 data-convert/xlsx 動態 import(sheet-vendor chunk,不預快取)。引擎
  src/features/tableSplit.ts(safeFileName/splitByRows/splitByColumn/uniqueFileNames 純函式無 DOM,
  Table 型別複用 tableClean;splitByColumn 以首見順序穩定分組、空值歸一組)+ 回歸測試
  scripts/test-tablesplit.mjs(40 筆:檔名清理/補零份號/不漏列/邊界、首見順序/空值/dropKeyColumn/
  大小寫/欄超界、唯一檔名加序號,esbuild 打包後跑,併入 npm test)。與 table-clean(清理)、
  data-convert(格式互轉)、list-compare(比對)互補,補上「一份拆多份」的缺口;不上傳。
  零新相依;type-check + 全測試 + build 通過 — 2026-06-18
- 批次檔案改名(batch-rename,category=workshop):一次替整批檔案改名 —— 尋找取代(字面比對、可忽略大小寫、
  取代全部出現)、主檔名大小寫轉換、加前/後綴、加流水號(起始/遞增/補零/前後位置/分隔字串)。即時預覽舊→新,
  打包成 ZIP 下載(瀏覽器無法直接改寫硬碟檔名,以 zipStudio.buildZip level 0 STORE 重新打包)。選檔時以
  localeCompare numeric 自然排序,讓流水號順序符合直覺;副檔名(最後一個點後)預設保留不被規則動到;算出同名
  自動加「(2)」不覆蓋(忽略大小寫比對對應 Win/mac 檔案系統)。規則順序:取代→大小寫→前後綴→流水號→補唯一。
  引擎 src/features/batchRename.ts(splitExtension/computeNewNames 純函式無 DOM,escapeRegExp 讓特殊字元字面比對)
  + 回歸測試 scripts/test-batchrename.mjs(30 筆:拆副檔名/前後綴/取代各情境/大小寫只動主檔名/流水號補零起始遞增
  前後綴負值 step0/組合/keepExtension/去重含大小寫與取代衝突/邊界空清單與空主檔名,esbuild 打包後跑,併入 npm test)。
  零新相依(複用既有 jszip);type-check + 全測試 + build 通過 — 2026-06-18

- 文件掃描美化(doc-scan,category=workshop):把手機拍的文件照片處理成像掃描機掃出來的乾淨檔 ——
  三種模式:彩色增強(自動對比拉伸 + 提亮背景,保留印章/螢光筆顏色)、灰階、黑白(自適應門檻二值化,
  用積分圖 O(1) 算局部平均對抗不均勻光照,把字變純黑、紙變純白、檔案最小)。可多張排序、合併成多頁 PDF
  或各頁匯出 JPG。CamScanner 等手機掃描 App 要付費訂閱、輸出加浮水印又夾廣告,且把私密合約/單據上傳;
  本工具全程在瀏覽器以 Canvas + 純像素演算法處理、不上傳、無浮水印、免註冊。引擎 src/features/docScan.ts
  (luma/toGray/percentileBounds/adaptiveThreshold/applyScan 純函式無 DOM,applyScan 不更動輸入像素以便反覆套用)
  + 回歸測試 scripts/test-docscan.mjs(24 筆:luma 權重/灰階/直方圖百分位界與裁切/全相同回退/積分圖自適應門檻
  均勻全白與暗點判黑/輸出僅 0-255/三模式輸出格式與不破壞原圖/對比拉伸/強度夾住,esbuild 打包後跑,併入 npm test)。
  PDF 匯出走既有 pdf-lib 動態 import(pdf-vendor chunk,不預快取),零新相依;type-check + 全測試(1017 筆)
  + build 通過 — 2026-06-18

- 批次 QR Code(qr-batch,category=workshop):一份清單(每行一筆)一次做成很多個 QR ——
  兩種輸出:(1)打包成 ZIP(每筆一張 512px PNG,檔名取自標籤或內容),(2)排成可直接列印的 A4 標籤頁 PDF
  (自訂每頁欄列數、QR 下方可印英數標籤)。可勾選「逗號/Tab 分標籤,內容」讓每筆帶名稱。活動桌號、座位、
  財產編號、商品/菜單/問卷連結用得上。全程在瀏覽器以 qrcode 函式庫產生,清單不上傳、直接編碼原始內容不轉址不追蹤
  (有別於會偷換短網址的線上產生器)。引擎 src/features/qrBatch.ts(parseEntries/safeName/planSheet 純函式無 DOM,
  planSheet 以左上原點算格子、呼叫端換成 pdf-lib 左下原點)+ 回歸測試 scripts/test-qrbatch.mjs(28 筆:
  多行解析/空行/逗號與 Tab 分隔/只切第一個分隔符/檔名清理去路徑字元收斂底線去前後點夾長度/版面數量與換頁
  不超界格寬計算/欄數 0 與邊界過大報錯,esbuild 打包後跑,併入 npm test)。複用既有 zipStudio.buildZip 打包、
  pdf-lib 動態 import,零新相依;PDF 內建字型不含中文,中文標籤在 PDF 上略過(QR 與 ZIP 檔名仍完整支援中文)。
  與單張「QR Code 產生器」互補。type-check + 全測試(1044 筆)+ build 通過 — 2026-06-18

- 色盲友善檢測(color-blind,category=workshop):上傳圖表/簡報/網頁截圖/地圖,左右並排顯示「原圖 vs 色覺障礙者看到的樣子」,
  檢查紅綠等配色是否仍分得出來(台灣約每 12 位男性 1 位紅綠色覺異常)。四型別:綠色盲(deuteranopia,最常見)、
  紅色盲(protanopia)、藍色盲(tritanopia)、全色盲(achromatopsia,灰階);程度 0–100 以「原色↔全模擬」線性混合模擬色弱。
  採 Machado, Oliveira & Fielding (2009) 廣用的 sRGB 色彩矩陣(severity=1.0),直接作用於 gamma 編碼 sRGB(實務近似);
  全色盲走 Rec.601 luma。線上模擬站(如 Coblis)要上傳圖片;本工具全程瀏覽器 Canvas + 純像素運算、不上傳、可下載模擬 PNG。
  引擎 src/features/colorBlind.ts(clamp255/luma/simulateColor/simulatePixels/colorDistance 純函式無 DOM,
  simulatePixels 不更動輸入、alpha 原樣保留)+ 回歸測試 scripts/test-colorblind.mjs(35 筆:夾值/luma 權重/severity 0 回原色/
  灰與黑白在各型別維持/全色盲三通道相等=luma/紅綠在綠盲紅盲下距離縮小/severity 中間值介於原色與全模擬/距離對稱/
  像素長度與 alpha 保留與不更動輸入,esbuild 打包後跑,併入 npm test)。零新相依;與 contrast-check 互補(對比 vs 色相);
  type-check + 全測試 + build 通過 — 2026-06-18

- JSON ↔ YAML 互轉(json-yaml,category=workshop):雙向轉換,k8s / docker-compose / GitHub Actions / 應用設定檔
  常含 API 金鑰、密碼、內部網址,線上轉換器要上傳;本工具全程瀏覽器轉換、不上傳,可選 2/4 空格縮排或 JSON 壓成一行、
  複製/下載、「拿結果反向驗證」(把結果搬回輸入並對調方向確認來回一致)。解析序列化交給成熟 js-yaml(避免自刻 parser
  把設定轉錯),薄包裝負責統一錯誤訊息(含行號)、擋多份文件(---)給清楚提示、空輸入提示。引擎 src/features/jsonYaml.ts
  (jsonToYaml/yamlToJson 純函式無 DOM,回 {ok,output,error} 不丟例外)+ 回歸測試 scripts/test-jsonyaml.mjs(27 筆:
  基本/巢狀/陣列/來回一致含中文與含冒號井號字串/縮排選項/空與註解 null/無效 JSON 與 YAML 不丟例外/多份文件提示/
  帶引號版本維持字串,esbuild 打包後跑,併入 npm test)。js-yaml 動態 import + yaml-vendor chunk 不預快取(已驗證未進
  precache);補足 data-convert/json-flatten/markdown-table 不含 YAML 的缺口;type-check + 全測試 + build 通過 — 2026-06-18

- 照片壓到指定大小(image-fit-size,category=workshop):台灣報名/考試/政府/公司上傳系統常規定「照片不得超過 ○○ KB」,
  一般工具只有品質滑桿要自己反覆試;本工具用二分搜尋自動找出「大小上限內、JPEG 畫質最高」的品質設定,
  可一併限制最長邊(px),支援多檔逐張壓到同一上限。若連最低品質都還超標,會逐步縮小尺寸(×0.82,最多 8 輪、不縮到 ≤200px)
  再試,並如實標示「已達標 / 已是最小仍略大」。透明背景填白(JPG 無透明)。搜尋演算法 src/features/imageFit.ts
  (fmtSize/fitScale/searchQuality 純函式無 DOM,searchQuality 以注入的 measure 回呼編碼、與瀏覽器無關;maxQ 已達標只量一次、
  連 minQ 都超標回 underTarget=false)+ 回歸測試 scripts/test-imagefit.mjs(21 筆:大小格式化/縮放比例/線性與非線性編碼器找最高達標品質/
  邊界相等視為達標/maxQ 早停只量一次/壓不下回 minQ/async measure,esbuild 打包後跑,併入 npm test)。
  與 image-studio(固定品質)、id-photo(固定沖洗尺寸)互補,補上「壓到指定 KB」缺口;零新相依;type-check + 全測試 + build 通過 — 2026-06-18

## 進行中 / 待辦(優先序)
- [x] 圖片去背評估:@imgly/background-removal 拉進 102 套件且 runtime 需從外部 CDN 下載 ~40MB 模型,
      與本專案「精簡 + 自包含」原則不符,**跳過**(未來若改自架模型再評估)
- [ ] 持續深化防詐騙:可疑賣家/電話查證引導
- [ ] 發票對獎接真實/半自動中獎號碼 —— ⚠️ 需可驗證的官方來源(財政部 open data),
      雲端沙盒 WebFetch 被擋無法驗證格式;寫入錯誤中獎號碼風險高,暫緩,待能驗證來源再做
- [ ] 汽機車牌照稅/燃料費試算 —— ⚠️ 需完整官方級距表,沙盒內無法逐項驗證高級距,暫緩
- [ ] og:image 改 PNG(部分平台不渲染 SVG 預覽圖)
- [ ] 下載中心:擴充更多軟體、更多 github 自動版本來源
- [ ] 品質:單元測試擴充、視覺與 RWD 持續打磨

## 注意:工具已 24 個,philosophy 是「窄而深、少而精」,新增前先確認非「網路隨手可得」且資料可驗證

## 注意
- 工具=資料+模組:新增工具只加 src/tools/<id>/Index.vue + tools.config 註冊
- 每檔 <300 行;計算類附依據與「僅供參考」;不上傳資料
- push 前先 `npm run build` 通過;sonnet/opus 雲端 routine 也在跑,push 前先 `git pull --rebase`
