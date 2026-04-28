@echo off
REM ============================================================
REM IGS ACD Art Tools - Sync deployed -> source
REM ------------------------------------------------------------
REM 把部署版本（PS 實際載入的位置）同步回原始碼資料夾
REM 之後就可以 git status / git commit / git push
REM
REM 排除：
REM   - .debug             (開發旗標)
REM   - uninstall.exe       (installer 產物)
REM   - cocos-importer/     (installer 產物)
REM   - .git/               (預設不會碰)
REM ============================================================

setlocal

set "DEPLOYED=%APPDATA%\Adobe\CEP\extensions\com.igs.arttools"
set "SOURCE=%~dp0extension"

echo.
echo ============================================================
echo  Source   : %SOURCE%
echo  Deployed : %DEPLOYED%
echo ============================================================
echo.

if not exist "%DEPLOYED%" (
    echo [ERROR] Deployed extension not found at:
    echo         %DEPLOYED%
    echo.
    pause
    exit /b 1
)

if not exist "%SOURCE%" (
    echo [ERROR] Source extension folder not found at:
    echo         %SOURCE%
    echo.
    pause
    exit /b 1
)

echo Syncing files...
echo.

REM /MIR  = Mirror (含刪除目標多餘檔案)
REM /XD   = Exclude directories
REM /XF   = Exclude files
REM /R:1  = Retry once on failure
REM /W:1  = Wait 1s between retries
REM /NFL  = No file list (less verbose)
REM /NDL  = No dir list

robocopy "%DEPLOYED%" "%SOURCE%" /MIR ^
    /XD "cocos-importer" ".git" ^
    /XF "uninstall.exe" ".debug" ^
    /R:1 /W:1 /NFL /NDL

set RC=%ERRORLEVEL%

echo.
echo ============================================================
if %RC% LSS 8 (
    echo  Sync complete. Now run:
    echo.
    echo    cd "%~dp0"
    echo    git status
    echo    git diff
    echo    git add ...
    echo    git commit -m "..."
    echo    git push
) else (
    echo  [ERROR] Robocopy returned code %RC%
)
echo ============================================================
echo.

pause
endlocal
