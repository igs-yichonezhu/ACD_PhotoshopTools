# IGS ACD Art Tools — 開發歷程 PRD 結案報告

> 專案名稱：IGS ACD Art Tools（Photoshop CEP Plugin + Cocos Creator Extension）
> 版本：v1.0.0
> 開發期間：2024 ~ 2025.04
> 開發模式：AI-Assisted Development (Claude + Human)

---

## 1. 專案概述

### 目標

建立一套 **PSD → Cocos Creator** 的 UI 匯出工具鏈，讓美術人員能夠：
1. 在 Photoshop 中完成 UI 排版
2. 一鍵匯出圖層結構、圖片資源、文字參數
3. 在 Cocos Creator 中一鍵匯入為 Prefab，保留完整的節點層級、座標、文字樣式

### 產出物

| 產出 | 說明 |
|------|------|
| **Photoshop CEP Panel** | `com.igs.arttools` — 模組化工具框架 + 4 個內建工具 |
| **Cocos Creator Extension** | `igs-ui-importer` — layout.json → Prefab 生成器 |
| **操作文件** | 操作手冊.md |
| **本報告** | 開發歷程 PRD 結案報告.md |

---

## 2. 系統架構

```
┌──────────────────────────────────────────────────┐
│                  Photoshop CC                      │
│  ┌──────────────────────────────────────────────┐ │
│  │         IGS ACD Art Tools (CEP Panel)         │ │
│  │                                                │ │
│  │  index.html ──── main.js ──── ps-bridge.js    │ │
│  │       │              │              │          │ │
│  │  [Tool iframes]  [postMessage]  [evalScript]  │ │
│  │       │              │              │          │ │
│  │  ┌─────────┐   ┌──────────┐   ┌──────────┐   │ │
│  │  │Color    │   │Doc Info  │   │FX RemBG  │   │ │
│  │  │Picker   │   │          │   │          │   │ │
│  │  └─────────┘   └──────────┘   └──────────┘   │ │
│  │  ┌──────────────────────────┐                  │ │
│  │  │  UI to Cocos (主要工具)   │                  │ │
│  │  │  ├ 圖層樹 + 勾選         │                  │ │
│  │  │  ├ 文字/圖片模式切換     │                  │ │
│  │  │  ├ FX 偵測              │                  │ │
│  │  │  └ 匯出 layout.json     │                  │ │
│  │  └──────────────────────────┘                  │ │
│  │                    │                            │ │
│  │              host.jsx (ExtendScript)            │ │
│  │              ├ DOM API (textItem, bounds...)    │ │
│  │              └ Action Manager (textKey, FX...)  │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────┘
                         │ layout.json + images/
                         ▼
┌──────────────────────────────────────────────────┐
│               Cocos Creator 3.8.x                  │
│  ┌──────────────────────────────────────────────┐ │
│  │       igs-ui-importer Extension               │ │
│  │                                                │ │
│  │  main.js ─── 讀取 layout.json                 │ │
│  │     │        UUID 對映 (圖片 → SpriteFrame)   │ │
│  │     │        生成 .prefab JSON                 │ │
│  │     ▼                                          │ │
│  │  scene/build-node-tree.js                      │ │
│  │     └ cc.* API：Node, Sprite, Label,          │ │
│  │       UITransform, UIOpacity, Widget           │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 3. 開發歷程

### Phase 1：框架建構

**目標**：建立可擴充的 CEP Panel 框架

- 設計模組化工具載入機制（tools/ 目錄 + manifest.json 自動發現）
- 實作 postMessage 雙向通訊架構（主面板 ↔ 工具 iframe）
- 封裝 ps-bridge.js（Photoshop API 包裝層）
- 實作 host.jsx（ExtendScript 宿主函式庫）
- 建立自訂 JSON 序列化器（ExtendScript 無原生 JSON.stringify）
- 設計深色主題 UI（Adobe Clean 風格）
- 實作 GitHub Releases 自動更新機制

**產出**：主框架 + 3 個基礎工具（Color Picker、Doc Info、FX Remove BG）

### Phase 2：UI to Cocos 核心功能

**目標**：實現 PSD 圖層匯出為 Cocos Creator 資源

- 實作 `IGS_getLayerTree()`：遞迴掃描完整圖層樹
- 實作 `IGS_exportLayerByPath()`：單圖層 PNG 匯出
- 設計 layout.json 格式規範
- 建立 Cocos Creator 端 extension：layout.json → .prefab 轉換
- 處理圖層順序（PS top-first → Cocos bottom-first 反轉）

### Phase 3：文字圖層支援

**目標**：完整支援 PSD 文字圖層參數匯出

- 讀取 textItem 屬性：fontSize、fontName、color、justification
- 新增 lineHeight、letterSpacing、isBold、isItalic、isUnderline
- 實作 Cocos Label 元件生成（含 overflow、wrapText 設定）
- 處理文字內容讀取（DOM API + Action Manager 雙路徑）

**關鍵挑戰**：
- `textItem.contents` 對混合樣式文字會拋出例外
- `textItem.size` 對混合字型大小會失敗
- 解法：逐屬性 try-catch + Action Manager `textStyleRange` 備援

### Phase 4：進階文字處理與 FX 偵測

**目標**：實作「C 方案」— 文字/圖片混合匯出 + 圖層效果偵測

**新增功能**：
1. **圖層效果 (FX) 偵測**
   - 透過 Action Manager 讀取 `layerEffects` 描述子
   - 辨識 10 種效果類型（陰影、光暈、浮雕、覆蓋、描邊等）
   - UI 顯示紫色 FX 標籤 + tooltip

2. **文字/圖片模式切換 (C 方案)**
   - 每個文字圖層可切換 [T] 文字 / [🖼] 圖片模式
   - 預設為文字模式
   - 圖片模式時將文字連同效果匯出為 PNG

3. **直排文字偵測**
   - 自動判斷：bounds 高度 > 寬度 且 寬度 < 1.5 倍字體大小
   - 設定 Cocos Label overflow=RESIZE_HEIGHT + enableWrapText

4. **字型選擇**
   - 全域下拉選單：Arial (Cocos 預設) / 當前 PSD 字型

5. **DPI 檢查**
   - 開啟時檢查文件 DPI，非 72 顯示警告（不阻止匯出）

6. **圖層限制報告（檢查按鈕）**
   - 彈出 modal 列出所有不支援或需注意的圖層
   - 分類：調整圖層、FX 圖層、剪裁遮色片、智慧物件、混合模式、刪除線

7. **STOP 按鈕**
   - 匯出過程中可隨時中斷

8. **重複檔名處理**
   - 同名圖層自動加後綴（`Arrow_1.png`、`Arrow_1_2.png`）

### Phase 5：字體大小精確修正

**目標**：解決 PS 字元面板數值 ≠ 匯出數值的問題

**問題分析過程**：

| 階段 | 嘗試 | 結果 |
|------|------|------|
| 1 | 懷疑 DPI 轉換（.as('px') vs .as('pt')） | 數值仍不對 |
| 2 | 移除 AM fallback 的 `× docDPI/72` | 部分修正 |
| 3 | 加入 debug 資訊到 layout.json | 發現 `_debug_size` 被 flatLayers 過濾掉 |
| 4 | 改用 alert 顯示 debug | iframe 環境中 alert 不彈出 |
| 5 | 將 debug 嵌入圖層限制報告 modal | 成功看到原始數據 |
| 6 | 分析原始數據 | **發現真正原因：textKey.transform** |

**根本原因**：
`textItem.size` 回傳的是 Free Transform **之前**的 base size，而 PS 字元面板顯示的是 base × transform 的視覺大小。

**解法**：
透過 Action Manager 讀取 `textKey.transform.yy`（垂直縮放因子），將 base size 乘以 transform scale 得到正確的視覺字體大小。

```javascript
// host.jsx 核心邏輯
if (textDesc.hasKey(stringIDToTypeID('transform'))) {
    var txDesc = textDesc.getObjectValue(stringIDToTypeID('transform'));
    textTransformScale = txDesc.getDouble(stringIDToTypeID('yy'));
}
fontSize = Math.round(baseFontSize * textTransformScale);
lineHeight = Math.round(baseLineHeight * textTransformScale);
```

**驗證結果**：

| 圖層 | PS 面板 | 修正前 | 修正後 |
|------|--------|--------|--------|
| 狂歡派對 | 20pt | 18 | 20 ✅ |
| 墨西哥夢 | 20pt | 18 | 20 ✅ |
| 老虎機 | 24pt | 36 | 24 ✅ |
| 聯絡我們 | 14.67pt | 22 | 15 ✅ |
| 翻譯 | 14.67pt | 22 | 15 ✅ |
| 設定 | 14.67pt | 22 | 15 ✅ |

---

## 4. 關鍵技術決策

### 4.1 雙層 API 策略（DOM + Action Manager）

| API | 優點 | 缺點 | 使用場景 |
|-----|------|------|---------|
| DOM (`textItem.*`) | 語法簡單、直覺 | 混合樣式會拋例外 | 第一優先路徑 |
| Action Manager | 能讀取所有底層屬性 | 語法複雜、需要 TypeID | DOM 失敗時的備援 |

**結論**：兩者結合使用，DOM 優先 + AM 備援，可覆蓋所有文字圖層情境。

### 4.2 文字匯出策略選擇

開發過程中評估了三種方案：

| 方案 | 做法 | 優點 | 缺點 |
|------|------|------|------|
| A：全部轉圖片 | 所有文字 → PNG | 100% 還原 | 不可編輯、檔案大 |
| B：全部轉文字 | 所有文字 → Label | 可編輯、輕量 | FX 效果遺失 |
| **C：混合模式** | 使用者自選 T/🖼 | 兩全其美 | UI 較複雜 |

**最終選擇**：C 方案（混合模式），預設文字模式，可手動切換。

### 4.3 圖層順序處理

PS 圖層順序（layers[0] = 最上層）與 Cocos 節點順序（children[0] = 最底層）相反。

**解法**：在 `getLayerTree` 中反向遍歷 `for (i = layers.length - 1; i >= 0; i--)`。

### 4.4 Background Layer 特殊處理

PS 的鎖定背景圖層無法直接 duplicate。

**解法**：先在原文件中複製一份 → 轉為一般圖層 → duplicate 到新文件 → 刪除臨時複製（避免修改原始 PSD）。

---

## 5. 已知限制與未來規劃

### 現有限制

| 項目 | 說明 | 影響程度 |
|------|------|---------|
| 調整圖層 | 無法匯出效果，自動跳過 | 低（UI 設計少用） |
| 混合模式 | Cocos 僅支援 Normal | 中 |
| 圖層效果 | Label 不帶 FX，需手動切圖片或在 Cocos 補 | 中 |
| 剪裁遮色片 | 遮罩關係遺失 | 中 |
| 刪除線文字 | cc.Label 不支援 | 低 |
| 透明度合併 | 群組+子圖層透明度未相乘 | 低 |
| 圖層路徑反斜線 | Windows 路徑可能有 escape 問題 | 低 |

### 未來規劃

| 優先級 | 功能 | 說明 |
|--------|------|------|
| P1 | PS ↔ Cocos 即時同步 | HTTP POST 從 PS 推送變更到 Cocos，自動更新 Prefab |
| P2 | 九宮格 (Sliced Sprite) 支援 | 讀取 PS Slice 資訊，設定 SpriteFrame border |
| P2 | 動畫時間軸匯出 | 讀取 PS Timeline，轉為 Cocos Animation Clip |
| P3 | 批次匯出多個 PSD | 支援資料夾拖放批次處理 |
| P3 | Prefab 差異更新 | 僅更新變更的圖層，不重建整個 Prefab |

---

## 6. 檔案清單

### Photoshop CEP Extension

```
com.igs.arttools/
├── CSXS/
│   └── manifest.xml              ← CEP 設定檔
├── css/
│   └── style.css                 ← 全域樣式
├── icons/                        ← 面板圖示
├── js/
│   ├── CSInterface.js            ← Adobe CEP SDK
│   ├── main.js                   ← 主框架邏輯
│   ├── ps-bridge.js              ← PS API 封裝
│   └── updater.js                ← 自動更新
├── jsx/
│   └── host.jsx                  ← ExtendScript 宿主
├── tools/
│   ├── color-picker/             ← 快速取色
│   ├── doc-info/                 ← 文件資訊
│   ├── fx-remove-bg/             ← 特效去背
│   └── ui-to-cocos/              ← UI 匯出到 Cocos
├── index.html                    ← 主面板 HTML
└── .debug                        ← 開發用 debug 設定
```

### Cocos Creator Extension

```
igs-ui-importer/
├── package.json                  ← Extension 設定
└── dist/
    ├── main.js                   ← Editor 主邏輯 (Prefab 生成)
    └── scene/
        └── build-node-tree.js    ← Scene Script (節點樹建構)
```

---

## 7. 技術規格

| 項目 | 規格 |
|------|------|
| CEP 版本 | CSXS 9.0 |
| 支援 PS 版本 | CC 2019 (v20.0) ~ CC 2025+ |
| 支援 Cocos 版本 | 3.6.0+ (測試於 3.8.6) |
| 語言 | JavaScript (ES5) + ExtendScript + HTML/CSS |
| 面板尺寸 | 400×600 (min 300×400) |
| 設定存放 | %APPDATA%/IGS-ArtTools/config.json |
| 匯出格式 | layout.json (自訂) + PNG |
| Prefab 格式 | Cocos Creator 3.x JSON Prefab |

---

## 8. 結語

本專案從零建構了一套完整的 PSD → Cocos Creator UI 工作流程工具。開發過程中最大的技術挑戰在於 Photoshop ExtendScript 的文字屬性讀取——DOM API 在許多邊界情況下會拋出例外（混合樣式、Free Transform 後的字體大小），最終透過 Action Manager 深入底層描述子才徹底解決。

框架採用模組化設計，未來可透過新增 `tools/` 子資料夾輕鬆擴充新工具，無需修改框架核心程式碼。

---

*報告日期：2025.04.08*
*IGS ACD Art Tools © 2024-2025*
