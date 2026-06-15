# CLAUDE.md — ToolHub 個人實用工具站 開發規範

> 本文件為 Claude Code 開發此專案的規範與規劃。每次開始新工作前先讀一次。
> 名稱 `ToolHub` 為暫定,可隨時改。

---

## 一、專案目標與定位

做一個給**自己 + 家人 + 朋友**使用的線上實用工具站。

**核心信念(最重要):不做網路上隨手可得的東西。** JSON 格式化、Base64 那種一般人 google 就有的,做了對使用者沒價值。價值只來自三種「難」:難找、難算、或乾淨可信。

### 兩條價值主軸(窄而深)

1. **台灣在地化計算** —— 資訊存在但極度分散、難算,政府網站介面難用,國外工具站永遠不做。例:資遣費、特休天數、加班費、二代健保補充保費、勞健保級距、房貸/車貸試算、民國↔西元轉換、發票對獎。
2. **可信賴、防詐騙的下載中心** —— google「LINE 下載」「Zoom 下載」滿是假下載站、廣告農場、夾帶惡意程式的釣魚連結,長輩一裝就中招。提供「保證官方來源、無廣告、附校驗碼」的乾淨下載清單,對家裡長輩最有感。

### 不做什麼
- 不做資安/網管專業工具(原本給公司 IT 用,現已無此受眾)
- 第一階段不碰 PDF 轉檔等需後端/上傳的「重工具」(隱私、成本、複雜度問題,留後期)
- 不做「什麼都有的大雜燴」—— 寧可少而精

---

## 二、技術選型(走輕量靜態優先)

| 層級 | 技術 | 理由 |
|------|------|------|
| 前端框架 | Vue 3 + TypeScript + Vite | 沿用熟悉的 Composition API |
| UI | **Tailwind CSS v4 自刻**(無元件庫) | 計算機表單其實單純,自刻能做出明顯更好的質感與差異化,不像預設模板。設計系統在 `src/style.css` 的 `@theme` |
| 路由 | Vue Router(由工具設定檔動態產生) | 新增工具不改路由表 |
| 部署 | GitHub Pages / Netlify(純靜態) | 零後端、零成本、隱私最好 |
| 下載中心版本資料 | GitHub Actions 排程抓取 → 產生靜態 JSON | 抓失敗保留舊資料,不拖垮整站 |

> 第一階段**完全不需要後端**。所有工具在瀏覽器內運算,不上傳任何資料。
> 未來若要接 Claude API 做智慧 chatbot,才需要加一層極輕的 serverless proxy(見 §七)。

---

## 三、架構原則(核心,決定能否長期維護)

### 規則 1:工具是「資料 + 模組」,不是寫死在主程式
- 所有工具的 metadata(名稱、分類、關鍵字、圖示、路由)集中在一份 `tools.config.ts`(單一事實來源)。
- 導覽、搜尋、chatbot、分類頁全部讀這一份。
- **新增工具 = 加一個 `.vue` 元件 + 註冊一筆 config**,不改主程式、不改路由表。

### 規則 2:每個工具自我隔離
- 一個工具壞掉不能拖垮整站。
- 下載中心各軟體版本抓取各自容錯,某個失敗就顯示「資料暫缺」而非整頁壞掉。

### 規則 3:每個檔案不超過 ~300 行
- 超過就拆檔。一個檔案只做一件事。

### 規則 4:隱私優先
- 工具一律在瀏覽器端運算,不送任何資料到伺服器。
- 這是對家人朋友的賣點,也讓純靜態部署成立。

### 規則 5:長輩友善
- 字級夠大、操作步驟少、結果清楚、用語白話(不要工程師術語)。
- 台灣在地計算要附「依據」說明(例:依勞基法第幾條),讓使用者信任結果。

---

## 四、目錄結構(草案)

```
toolhub/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── config/
│   │   ├── tools.config.ts        # ★ 工具註冊表(單一事實來源)
│   │   └── categories.ts          # 分類定義
│   ├── router/
│   │   └── index.ts               # 由 tools.config 動態產生路由
│   ├── tools/                     # 每個工具一個資料夾
│   │   ├── severance-pay/         # 資遣費試算
│   │   ├── annual-leave/          # 特休天數
│   │   ├── overtime-pay/          # 加班費
│   │   ├── nhi-supplement/        # 二代健保補充保費
│   │   ├── roc-year/              # 民國↔西元
│   │   └── invoice-lottery/       # 發票對獎
│   ├── features/
│   │   ├── search/                # 工具搜尋
│   │   ├── chatbot/               # ★ 關鍵字導引
│   │   └── downloads/             # 下載中心
│   ├── components/                # 共用元件(工具卡片、版面、結果框)
│   ├── views/
│   │   ├── Home.vue               # 總覽 + 搜尋 + chatbot 入口
│   │   ├── ToolPage.vue           # 工具外框(載入對應工具元件)
│   │   └── Downloads.vue          # 下載中心
│   └── utils/
├── public/
│   └── data/
│       └── software.json          # 軟體版本資料(Actions 排程更新)
├── scripts/
│   └── fetch-versions.ts          # 抓各軟體最新版
├── .github/workflows/
│   └── update-versions.yml        # 排程跑 fetch-versions
├── package.json
└── CLAUDE.md                       # 本文件
```

---

## 五、工具清單

### A. 台灣在地計算(第一批主力)
| 工具 | 說明 | 備註 |
|------|------|------|
| 資遣費試算 | 依勞基法/勞退新舊制計算 | 要標註計算依據 |
| 特休天數計算 | 依到職日算應有特休 | |
| 加班費計算 | 平日/假日 1.34、1.67 倍等 | |
| 二代健保補充保費 | 獎金、租金、股利等級距 | |
| 勞健保級距查詢 | 投保薪資對照 | 需維護級距表(資料,非程式) |
| 房貸/車貸試算 | 本息攤還、總利息 | |
| 民國 ↔ 西元 ↔ 日本年號 | 含農曆/節氣(評估) | |
| 發票對獎 | 輸入末幾碼比對中獎號碼 | 中獎號碼可手動或排程更新 |

### B. 下載中心
- 一張 `software.json`:每筆含「軟體名、官方下載連結、最新版號、更新日期、分類、圖示、SHA256(若可取得)」。
- 開源軟體(Telegram、Discord 等)用 GitHub Releases API 自動抓版本;閉源(LINE、Teams)手動維護版號 + 連結固定指向官方下載頁。
- GitHub Actions 每日排程更新,**抓失敗保留舊資料**。
- 賣點:乾淨、無廣告、保證官方來源、附校驗碼 —— 防詐騙。

### C. 日常實用小工具(視需要補,但只收「乾淨體驗有價值」的)
- 圖片壓縮/格式轉換(瀏覽器內,不上傳)、QR Code、單位換算等。
- 原則:這類網路上有,只在「無廣告 + 整合在一起 + 不上傳」有附加價值時才做。

---

## 六、關鍵字導引 Chatbot(第一版,免 LLM)

1. 使用者輸入「我想算特休」「LINE 在哪下載」。
2. 比對 `tools.config` 裡每個工具的 `keywords` 陣列(含同義詞)。
3. 用關鍵字命中數評分排序,回「我猜你要找:**特休天數計算** → [前往]」。
4. 找不到回最接近的前 3 名 + 提示。

> 關鍵字表本身就是 `tools.config` 的一部分(單一事實來源)。未來要升級成語意理解,只換比對引擎,資料不動。

---

## 七、未來:接 Claude API(後期,非必要)

若之後想讓 chatbot 聽得懂自然語言:

- **可用自己的 Claude API 帳號**(`ANTHROPIC_API_KEY`),個人/家人用量成本可忽略。
- **金鑰絕對不可放前端**(靜態網站的 JS 任何人都看得到 → 帳號被盜刷)。必須加一層 serverless proxy(Netlify / Cloudflare Workers / Vercel),金鑰只存後端環境變數。
  ```
  瀏覽器 → 你的 serverless proxy(持有金鑰) → Claude API
  ```
- 模型:預設 `claude-opus-4-8`(品質最好);若要更快更省可用 `claude-haiku-4-5`,tool-routing 綽綽有餘。

---

## 八、開發階段

| 階段 | 內容 | 檢查點 |
|------|------|--------|
| 0 | Vite + Vue 骨架、`tools.config` + 動態路由機制 | 首頁列出工具卡片(空殼) |
| 1 | 做 2-3 個在地計算工具(資遣費、特休、加班費),驗證「新增工具」流程 | 加工具只改 config + 加元件 |
| 2 | 補滿台灣在地計算 + 搜尋 + 分類 | 計算工具站可用 |
| 3 | 下載中心 + Actions 排程抓版本 | 軟體版號每日自動更新,附校驗碼 |
| 4 | 關鍵字導引 chatbot | 打白話能找到工具 |
| 5(之後) | 視覺打磨、PWA 離線、行動裝置優化 | 長輩在手機上好用 |
| 6(未來) | 升級 Claude API chatbot(+ proxy);評估重工具(PDF 轉檔) | — |

---

## 九、命名規則
- 元件:PascalCase(`SeverancePayCalculator.vue`)
- 變數/函式:camelCase
- 工具 config key:kebab-case(`severance-pay`),與資料夾名一致
- 路由:`/tools/severance-pay`

## 十、安全與品質
- 不上傳任何使用者輸入(隱私)。
- 接 API 時金鑰只放後端,不進前端、不進 Git。
- 在地計算務必標註法規依據與適用前提,避免使用者誤用。
- 視覺要持續打磨,維持「不像預設模板」的質感。

---

## 十一、目前進度(2026-06-15 自主開發,全部完成並線上驗證)

**已上線:https://loses5201-alt.github.io/toolhub/**(GitHub repo: loses5201-alt/toolhub,公開)

- 階段 0:Vite + Vue3 + TS + Tailwind v4、`tools.config` 單一事實來源、動態路由 ✅
- **16 個**工具,皆附依據/說明 ✅
  - 防詐騙:**可疑網址檢查器**(`src/features/linkcheck.ts` 啟發式引擎)、**詐騙簡訊檢查**(`src/tools/sms-check`,話術辨識 + 複用 linkcheck 分析連結)
  - 勞動:資遣費(新/舊制)、特休(§38)、加班費(§24)
  - 財務:貸款試算(本息/本金均攤+寬限期)、定存複利、勞退自提節稅
  - 稅健:綜所稅速算(113 年度級距)、二代健保補充保費(2.11%)
  - 生活:BMI、旅費分帳、單位換算(坪/台斤/台尺)、預產期、發票對獎(範例值待更新)
  - 日期:民國/西元/日本年號
  - 長輩友善:字級切換 A−/A+(`src/features/fontScale.ts`,localStorage)
  - 接力進度看 `ROADMAP.md`
- 防詐騙下載中心:**30 個**常用軟體官方連結(10 分類:通訊/視訊/瀏覽器/影音/辦公/壓縮/遠端雲端/安全/開發/台灣政府服務);資料 `public/data/software.json` 執行時 fetch;**版本自動更新**腳本 `scripts/fetch-versions.mjs` + 每日 Action(GitHub Releases 容錯抓取,實測抓到 Telegram/OBS/VSCode/Node 版本)✅
  - 坑:PWA 不可預快取資料 JSON(會卡舊資料),已改 NetworkFirst(`vite.config.ts` workbox runtimeCaching)
- 階段 4:關鍵字導引(首頁搜尋框,免 LLM)✅
- PWA:`vite-plugin-pwa`,可加到主畫面 + 離線(圖示 `public/icon.svg`)✅
- 部署:`deploy.yml`(push main 自動建置部署到 Pages);base 設為 `/toolhub/` ✅

啟動:`npm run dev`。建置:`npm run build`。部署:push 到 main 自動觸發。
坑/注意:GH Pages 用 `/toolhub/` base,改部署位置要改 vite.config 的 base;hash router 免 rewrite;資料用執行時 fetch(`${BASE_URL}data/...`)所以排程更新免重建。
下一步候選:接 Claude API 智慧 chatbot(需 serverless proxy,金鑰不進前端)、更多工具、發票中獎號碼自動更新、自訂網域。
