# IGS ACD Art Tools — Photoshop CEP Plugin Framework

公司內部美術工具箱 Photoshop 插件框架。

## 功能

- **工具箱面板** — 單一面板載入所有內部美術工具
- **iframe 隔離** — 每個工具獨立運行，互不干擾
- **約定式載入** — `tools/` 目錄下放工具資料夾 + `manifest.json`，自動掃描載入
- **Photoshop API 封裝** — 框架提供文件、圖層、畫布、色彩操作的統一 API
- **自訂 JSX 支援** — 工具可直接執行 ExtendScript 做進階操作
- **GitHub 自動更新** — 啟動時自動檢查 GitHub Releases，一鍵下載更新
- **一鍵安裝** — Windows `.exe` 安裝包，自動設定 CEP Debug Mode

## 目錄結構

```
├── .github/workflows/
│   └── release.yml           # GitHub Actions: 打 tag 自動發佈 Release
├── extension/                # CEP 插件本體
│   ├── CSXS/
│   │   └── manifest.xml      # CEP 配置（插件 ID、版本、PS 版本範圍）
│   ├── css/
│   │   └── style.css         # 框架樣式（Adobe 風格深色主題）
│   ├── icons/                # 插件圖示
│   ├── js/
│   │   ├── CSInterface.js    # Adobe CEP SDK（需替換為官方版本）
│   │   ├── main.js           # 框架核心
│   │   ├── ps-bridge.js      # Photoshop API 封裝層
│   │   └── updater.js        # GitHub 自動更新模組
│   ├── jsx/
│   │   └── host.jsx          # ExtendScript（PS DOM 操作函式）
│   ├── tools/                # 所有工具放這裡
│   │   ├── doc-info/         # 範例：文件資訊
│   │   └── color-picker/     # 範例：快速取色
│   ├── index.html            # 框架主頁面
│   └── .debug                # CEP 除錯設定
├── installer/
│   └── setup.nsi             # NSIS 安裝腳本
└── README.md
```

## 快速開始

### 開發環境設定

1. **開啟 CEP Debug Mode**（Windows）：

   執行 `installer/enable-debug.bat`，或手動在 Registry 設定：
   ```
   HKCU\Software\Adobe\CSXS.11\PlayerDebugMode = "1"
   ```

2. **取得官方 CSInterface.js**：

   從 [Adobe CEP Resources](https://github.com/Adobe-CEP/CEP-Resources) 下載對應版本的 `CSInterface.js`，
   替換 `extension/js/CSInterface.js`。

3. **安裝插件**（開發模式）：

   建立 symbolic link 到 CEP extensions 目錄：
   ```cmd
   mklink /D "%APPDATA%\Adobe\CEP\extensions\com.igs.arttools" "完整路徑\extension"
   ```

4. **重啟 Photoshop**，在 `視窗 > 延伸功能 > IGS ACD Art Tools` 開啟面板。

### 建置安裝包

1. 安裝 [NSIS](https://nsis.sourceforge.io/Download)
2. 在 `installer/` 目錄執行：
   ```cmd
   makensis setup.nsi
   ```
3. 產生 `igs-arttools-setup.exe`

## 新增工具

### 1. 建立工具資料夾

在 `extension/tools/` 下建立資料夾：

```
extension/tools/my-tool/
├── manifest.json
├── icon.png        (48x48, 選填)
└── index.html      (工具主頁面)
```

### 2. 編寫 manifest.json

```json
{
    "name": "我的工具",
    "icon": "icon.png",
    "entry": "index.html",
    "version": "1.0.0",
    "description": "工具說明文字",
    "category": ["image", "workflow"],
    "minPsVersion": "20.0"
}
```

**欄位說明：**

| 欄位 | 必填 | 說明 |
|------|------|------|
| name | ✓ | 工具名稱，顯示在卡片上 |
| entry | ✓ | 入口 HTML 檔案路徑 |
| icon | | 工具圖示（48x48 PNG），沒有則顯示名稱首字 |
| version | | 工具版本號 |
| description | | 工具說明，hover 卡片時顯示 |
| category | | 分類標籤，字串或陣列 |
| minPsVersion | | 最低 Photoshop 版本，不符合則不載入 |

**可用分類：**

`image`（圖片處理）、`text`（文字工具）、`color`（色彩工具）、`export`（匯出工具）、`workflow`（工作流程）、`layer`（圖層工具）、`ui`（UI 工具）。也可自訂分類。

### 3. 使用框架 API

在工具的 HTML 頁面中，透過 `postMessage` 呼叫 Photoshop API：

```javascript
// 通用呼叫函式
var callCounter = 0;
var pendingCalls = {};

function callPsApi(action, params) {
    return new Promise(function (resolve, reject) {
        var callId = 'call_' + (++callCounter);
        pendingCalls[callId] = { resolve: resolve, reject: reject };

        window.parent.postMessage({
            type: 'ps-api',
            action: action,
            params: params || {},
            callId: callId
        }, '*');

        setTimeout(function () {
            if (pendingCalls[callId]) {
                delete pendingCalls[callId];
                reject('Request timeout');
            }
        }, 10000);
    });
}

// 監聽回應
window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'ps-api-response') return;
    var pending = pendingCalls[data.callId];
    if (!pending) return;
    delete pendingCalls[data.callId];
    if (data.error) pending.reject(data.error);
    else pending.resolve(data.result);
});
```

**使用內建 API：**

```javascript
// 取得目前文件資訊
callPsApi('getActiveDocument').then(function (result) {
    var data = JSON.parse(result);
    console.log(data.data.name, data.data.width, data.data.height);
});

// 設定前景色
callPsApi('setForegroundColor', { r: 255, g: 0, b: 128 });

// 取得所有圖層
callPsApi('getLayers').then(function (result) {
    var layers = JSON.parse(result).data;
    layers.forEach(function (layer) {
        console.log(layer.name, layer.opacity);
    });
});
```

**使用自訂 ExtendScript：**

```javascript
window.parent.postMessage({
    type: 'ps-jsx',
    script: 'app.activeDocument.resizeImage(1024, 1024)',
    callId: 'custom_1'
}, '*');
```

### 可用 API 列表

| Action | 說明 | 參數 |
|--------|------|------|
| **文件操作** | | |
| getActiveDocument | 取得文件資訊 | — |
| openFile | 開啟檔案 | filePath |
| saveDocument | 儲存文件 | — |
| saveDocumentAs | 另存 PSD | filePath |
| exportPNG | 匯出 PNG | filePath, quality |
| exportJPG | 匯出 JPG | filePath, quality |
| closeDocument | 關閉文件 | save (boolean) |
| **圖層操作** | | |
| getLayers | 取得所有圖層 | — |
| getActiveLayer | 取得作用中圖層 | — |
| selectLayer | 選取圖層 | name |
| createLayer | 新增圖層 | name |
| deleteLayer | 刪除作用中圖層 | — |
| renameLayer | 重新命名圖層 | name |
| setLayerVisibility | 設定圖層可見性 | name, visible |
| setLayerOpacity | 設定圖層透明度 | opacity (0-100) |
| **畫布操作** | | |
| getCanvasSize | 取得畫布尺寸 | — |
| resizeCanvas | 調整畫布 | width, height |
| resizeImage | 調整影像大小 | width, height |
| cropToSelection | 裁切至選取範圍 | — |
| rotateCanvas | 旋轉畫布 | angle |
| **色彩操作** | | |
| getForegroundColor | 取得前景色 | — |
| setForegroundColor | 設定前景色 | r, g, b |
| getBackgroundColor | 取得背景色 | — |
| setBackgroundColor | 設定背景色 | r, g, b |
| swapColors | 交換前景/背景色 | — |
| resetColors | 重設為黑白 | — |

## 發佈新版本

1. 確認所有變更已 commit
2. 打 version tag：
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
3. GitHub Actions 自動打包 `extension/` 為 zip 並發佈到 Releases
4. 用戶端插件啟動時會自動偵測到新版本

## 設定

設定檔位置：`%APPDATA%\IGS-ArtTools\config.json`

```json
{
    "token": "ghp_xxxxxxxxxxxx",
    "repo": "your-org/photoshop-plugin"
}
```

- **token** — GitHub PAT（唯讀權限），用於存取 private repo 的 releases
- **repo** — GitHub repository，格式為 `owner/repo`

可在插件面板右上角齒輪圖示修改。
