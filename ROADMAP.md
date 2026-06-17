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
