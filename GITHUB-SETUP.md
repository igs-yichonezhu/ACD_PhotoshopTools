# IGS ACD Art Tools - GitHub Setup Guide

完整的 GitHub 建置與自動更新測試指南。

---

## Step 1: 建立 GitHub Repository

1. 開啟 https://github.com/new
2. 填寫：
   - **Repository name**: `igs-acd-tools`
   - **Description**: `IGS ACD Photoshop Art Tools Plugin`
   - **Visibility**: `Private`
   - **不要**勾選 "Add a README file"（我們會自己推）
3. 點 **Create repository**

---

## Step 2: 推送程式碼

在你的專案資料夾（包含 `extension/`, `installer/`, `.github/` 的那個）打開命令提示字元：

```cmd
cd "你的專案路徑"

git init
git add .
git commit -m "Initial commit: IGS ACD Art Tools v1.0.0"

git branch -M main
git remote add origin https://github.com/你的帳號/igs-acd-tools.git
git push -u origin main
```

> 如果 git push 要求登入，輸入你的 GitHub 帳號和 Personal Access Token（不是密碼）。

---

## Step 3: 建立 Personal Access Token (PAT)

這個 Token 用於兩件事：(1) 插件自動更新時存取 private repo releases (2) git push 認證。

1. 開啟 https://github.com/settings/tokens?type=beta
2. 點 **Generate new token**
3. 填寫：
   - **Token name**: `IGS ArtTools Plugin`
   - **Expiration**: 選擇你覺得合適的期限（建議 90 天或 1 年）
   - **Repository access**: 選 **Only select repositories** → 選 `igs-acd-tools`
   - **Permissions**:
     - **Contents**: `Read-only`（讀取 release 資產）
     - **Metadata**: `Read-only`（預設已勾選）
4. 點 **Generate token**
5. **複製 Token**（只會顯示一次！）

> 這個 Token 就是其他同事安裝插件時要輸入的東西。
> 如果要給整個部門用，建議用公用帳號建 Token，而不是個人帳號。

---

## Step 4: 在插件中設定 Token

1. 開啟 Photoshop → Window → Extensions → IGS ACD Art Tools
2. 如果跳出設定視窗，填入：
   - **GitHub Token**: 上一步複製的 Token
   - **Repository**: `你的帳號/igs-acd-tools`
3. 儲存

> Token 儲存在本機 `%APPDATA%\IGS-ArtTools\config.json`，不會上傳。

---

## Step 5: 測試 Release 自動打包 (CI/CD)

GitHub Actions 已經設定好了。每次你推送一個 version tag，就會自動打包並發佈到 Releases。

```cmd
:: 建立版本 tag
git tag v1.0.0

:: 推送 tag 到 GitHub
git push origin v1.0.0
```

等 1-2 分鐘，到 GitHub 頁面確認：
1. 開啟 https://github.com/你的帳號/igs-acd-tools/actions
2. 應該看到一個 "Release" workflow 正在執行或已完成
3. 開啟 https://github.com/你的帳號/igs-acd-tools/releases
4. 應該看到 `IGS ACD Art Tools v1.0.0` release，附帶一個 `.zip` 檔案

---

## Step 6: 測試自動更新

為了測試更新機制，我們需要讓本機版本低於 GitHub 的最新 release：

### 方法：推送一個新版 tag

```cmd
:: 先修改任意檔案（或什麼都不改也行）
git commit --allow-empty -m "Test release v1.0.1"
git tag v1.0.1
git push origin v1.0.1
```

然後在 Photoshop 插件面板：
1. 面板底部應該顯示 "新版本可用 v1.0.1"
2. 點擊 "更新" 按鈕
3. 等待下載、解壓、安裝
4. 看到 "更新完成！請重啟 Photoshop"
5. 重啟 PS，確認版本號更新了

---

## 日常開發流程

### 開發者設定（首次 clone 後）

```cmd
:: Clone repo
git clone https://github.com/你的帳號/igs-acd-tools.git
cd igs-acd-tools

:: 一鍵設定開發環境
:: (雙擊 dev-setup.bat 或右鍵以管理員身份執行)
dev-setup.bat
```

### 發佈新版本

```cmd
:: 1. 確認所有更改已 commit
git add .
git commit -m "Add new feature XYZ"
git push

:: 2. 建立版本 tag
git tag v1.1.0
git push origin v1.1.0

:: 3. GitHub Actions 自動打包發佈
:: 4. 所有已安裝插件的 PS 會在下次啟動時偵測到更新
```

### 版本號規則

建議使用 Semantic Versioning：
- `v1.0.x` — Bug 修復
- `v1.x.0` — 新功能
- `vX.0.0` — 重大變更

---

## 其他同事安裝方式

### 方式 A：NSIS 安裝包（推薦）

1. 在開發機上用 NSIS 編譯 `installer/setup.nsi` 產生 `.exe`
2. 把 `.exe` 分享給同事
3. 同事執行安裝包，輸入 Token 和 Repo
4. 重啟 Photoshop 就可以用了

### 方式 B：手動安裝

1. 從 GitHub Releases 下載最新的 `.zip`
2. 解壓到 `%APPDATA%\Adobe\CEP\extensions\com.igs.arttools\`
3. 執行 `installer\enable-debug.bat`
4. 在 `%APPDATA%\IGS-ArtTools\config.json` 填入 Token 和 Repo
5. 重啟 Photoshop

---

## Troubleshooting

| 問題 | 解決方式 |
|------|----------|
| PS 裡看不到插件面板 | 確認 CEP Debug Mode 已啟用 → 執行 `dev-setup.bat` 或 `enable-debug.bat` |
| 插件面板空白 | 按 F12 開 DevTools 看 console 錯誤 |
| 更新檢查失敗 | 確認 Token 有效且有 repo read 權限 |
| 下載更新失敗 | 檢查網路連線，確認 Token 沒過期 |
| Actions 沒有觸發 | 確認 tag 格式是 `v*.*.*`，例如 `v1.0.0` |
| mklink 失敗 | 需要管理員權限，用 `dev-setup.bat`（會自動提權） |
