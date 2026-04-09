; ============================================
; IGS ACD Art Tools - NSIS Installer Script
; ============================================
;
; 建置方式：
; 1. 安裝 NSIS: https://nsis.sourceforge.io/Download
; 2. 在此資料夾執行: makensis setup.nsi
; 3. 產生 igs-arttools-setup.exe
;
; 安裝包行為：
; 1. 複製插件檔案到 CEP extensions 目錄
; 2. 設定所有 CSXS 版本的 PlayerDebugMode = 1
; 3. 提示輸入 GitHub PAT（存到 %APPDATA%\IGS-ArtTools\config.json）
; 4. 建立解除安裝項目
;

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ---- General ----
Name "IGS ACD Art Tools"
OutFile "igs-arttools-setup.exe"
Unicode True
InstallDir "$APPDATA\Adobe\CEP\extensions\com.igs.arttools"
RequestExecutionLevel user

; ---- Variables ----
Var GitHubToken
Var GitHubRepo
Var TokenDialog
Var TokenInput
Var RepoInput

; ---- Interface ----
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; ---- Pages ----
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom TokenPage TokenPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ---- Language ----
!insertmacro MUI_LANGUAGE "TradChinese"

; ============================================
; Token Input Page
; ============================================

Function TokenPage
    !insertmacro MUI_HEADER_TEXT "GitHub 設定" "請輸入用於自動更新的 GitHub 資訊"

    nsDialogs::Create 1018
    Pop $TokenDialog

    ${If} $TokenDialog == error
        Abort
    ${EndIf}

    ; Token label and input
    ${NSD_CreateLabel} 0 0 100% 12u "GitHub Personal Access Token (PAT):"
    Pop $0

    ${NSD_CreateText} 0 16u 100% 14u ""
    Pop $TokenInput

    ; Hint
    ${NSD_CreateLabel} 0 34u 100% 12u "（請向管理員取得唯讀 PAT）"
    Pop $0

    ; Repo label and input
    ${NSD_CreateLabel} 0 56u 100% 12u "GitHub Repository (owner/repo):"
    Pop $0

    ${NSD_CreateText} 0 72u 100% 14u "igs-yichonezhu/ACD_PhotoshopTools"
    Pop $RepoInput

    ; Hint
    ${NSD_CreateLabel} 0 90u 100% 12u "（例如：your-org/photoshop-plugin）"
    Pop $0

    ; Note
    ${NSD_CreateLabel} 0 120u 100% 24u "注意：此資訊僅儲存在本機，不會上傳到任何伺服器。$\r$\n您也可以稍後在插件設定中修改。"
    Pop $0

    nsDialogs::Show
FunctionEnd

Function TokenPageLeave
    ${NSD_GetText} $TokenInput $GitHubToken
    ${NSD_GetText} $RepoInput $GitHubRepo
FunctionEnd

; ============================================
; Install Section
; ============================================

Section "Install"
    SetOutPath "$INSTDIR"

    ; Copy all extension files
    File /r "..\extension\*.*"

    ; ---- Set CEP Debug Mode for all CSXS versions ----
    ; CSXS 7 (CC 2017), 8 (CC 2018), 9 (CC 2019-2020), 10 (2021), 11 (2022+), 12 (2024), 13 (2026)
    WriteRegStr HKCU "Software\Adobe\CSXS.7" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.8" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.9" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"

    ; ---- Save GitHub config ----
    CreateDirectory "$APPDATA\IGS-ArtTools"

    ; Write config.json
    FileOpen $0 "$APPDATA\IGS-ArtTools\config.json" w
    FileWrite $0 '{$\r$\n'
    FileWrite $0 '  "token": "$GitHubToken",$\r$\n'
    FileWrite $0 '  "repo": "$GitHubRepo",$\r$\n'
    FileWrite $0 '  "webhookUrl": "https://script.google.com/macros/s/AKfycbyNzhKUZkubhdP48XpmVVx55YmSszPJCmB_gKum0CHsxfmmWU4ppAzSdyot6g-SAEEFOw/exec"$\r$\n'
    FileWrite $0 '}$\r$\n'
    FileClose $0

    ; ---- Create Uninstaller ----
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Add to Windows "Add/Remove Programs"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IGSArtTools" \
        "DisplayName" "IGS ACD Art Tools (Photoshop Plugin)"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IGSArtTools" \
        "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IGSArtTools" \
        "Publisher" "IGS"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IGSArtTools" \
        "DisplayVersion" "1.0.0"

SectionEnd

; ============================================
; Uninstall Section
; ============================================

Section "Uninstall"
    ; Remove extension files
    RMDir /r "$INSTDIR"

    ; Remove config (optional - ask user?)
    MessageBox MB_YESNO "是否同時移除設定檔（GitHub Token 等）？" IDNO SkipConfigRemoval
        RMDir /r "$APPDATA\IGS-ArtTools"
    SkipConfigRemoval:

    ; Remove registry entries
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IGSArtTools"

    ; Note: We do NOT remove CSXS PlayerDebugMode, as other extensions might need it

SectionEnd
