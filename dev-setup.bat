@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

echo ============================================
echo   IGS ACD Art Tools - Developer Setup
echo ============================================
echo.

:: ============================================
:: 1. Check admin rights, auto-elevate if needed
:: ============================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo [OK] Running as Administrator
echo.

:: ============================================
:: 2. Detect project paths
:: ============================================
set "PROJECT_DIR=%~dp0"
:: Remove trailing backslash
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "EXTENSION_DIR=%PROJECT_DIR%\extension"
set "CEP_DIR=%APPDATA%\Adobe\CEP\extensions"
set "LINK_DIR=%CEP_DIR%\com.igs.arttools"

echo [INFO] Project directory: %PROJECT_DIR%
echo [INFO] Extension source:  %EXTENSION_DIR%

:: Verify extension directory exists
if not exist "%EXTENSION_DIR%" (
    echo.
    echo [ERROR] extension\ directory not found!
    echo         Expected: %EXTENSION_DIR%
    echo         Make sure you run this bat from the project root.
    echo.
    goto :error
)

echo [OK] Extension directory found
echo.

:: ============================================
:: 3. Enable CEP Debug Mode (CSXS 7-13)
:: ============================================
echo [STEP 1/4] Setting CEP Debug Mode...

reg add "HKCU\Software\Adobe\CSXS.7"  /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.8"  /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.9"  /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.13" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.14" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.15" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1

echo [OK] CEP Debug Mode enabled for CSXS 7-13
echo.

:: ============================================
:: 4. Create CEP extensions directory
:: ============================================
echo [STEP 2/4] Setting up CEP extensions directory...

if not exist "%CEP_DIR%" (
    mkdir "%CEP_DIR%"
    echo [OK] Created: %CEP_DIR%
) else (
    echo [OK] Directory exists: %CEP_DIR%
)

:: ============================================
:: 5. Create symbolic link
:: ============================================
echo [STEP 3/4] Creating symbolic link...

:: Check if link already exists
if exist "%LINK_DIR%" (
    :: Check if it's already a symlink pointing to the right place
    dir "%CEP_DIR%" | findstr /C:"com.igs.arttools" | findstr /C:"SYMLINK" >nul 2>&1
    if !errorLevel! equ 0 (
        echo [OK] Symbolic link already exists: %LINK_DIR%
        echo      Removing old link and recreating...
        rmdir "%LINK_DIR%" >nul 2>&1
    ) else (
        echo [WARN] %LINK_DIR% exists but is not a symlink.
        echo        Removing it to create a fresh symlink...
        rmdir /s /q "%LINK_DIR%" >nul 2>&1
    )
)

mklink /D "%LINK_DIR%" "%EXTENSION_DIR%"
if !errorLevel! equ 0 (
    echo [OK] Symbolic link created
    echo      %LINK_DIR%
    echo      -^> %EXTENSION_DIR%
) else (
    echo [ERROR] Failed to create symbolic link!
    echo         Try running this script as Administrator.
    goto :error
)
echo.

:: ============================================
:: 6. Download CSInterface.js (pinned version)
:: ============================================
echo [STEP 4/4] Checking CSInterface.js...

set "CSINTERFACE_PATH=%EXTENSION_DIR%\js\CSInterface.js"
set "CSINTERFACE_VERSION=v12.0.0"
set "CSINTERFACE_URL=https://raw.githubusercontent.com/niceandfun/niceandfun.github.io/refs/heads/main/niceandfun/CSInterface.js"

:: Check if CSInterface.js already exists and is not the stub
if exist "%CSINTERFACE_PATH%" (
    findstr /C:"STUB" "%CSINTERFACE_PATH%" >nul 2>&1
    if !errorLevel! equ 0 (
        echo [INFO] CSInterface.js is a stub file, downloading real version...
        goto :download_csinterface
    )
    :: Check file size (stub is tiny, real file is ~60KB+)
    for %%A in ("%CSINTERFACE_PATH%") do set FILESIZE=%%~zA
    if !FILESIZE! LSS 10000 (
        echo [INFO] CSInterface.js seems too small, downloading real version...
        goto :download_csinterface
    )
    echo [OK] CSInterface.js already exists (size: !FILESIZE! bytes)
    goto :skip_download
)

:download_csinterface
echo [INFO] Downloading CSInterface.js %CSINTERFACE_VERSION%...

:: Try PowerShell download
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%CSINTERFACE_URL%' -OutFile '%CSINTERFACE_PATH%' -UseBasicParsing; Write-Host 'Download OK' } catch { Write-Host 'Download FAILED:' $_.Exception.Message; exit 1 }"

if !errorLevel! equ 0 (
    for %%A in ("%CSINTERFACE_PATH%") do set FILESIZE=%%~zA
    echo [OK] CSInterface.js downloaded (!FILESIZE! bytes)
) else (
    echo [WARN] Failed to download CSInterface.js automatically.
    echo        Please download it manually from:
    echo        https://github.com/niceandfun/niceandfun.github.io/blob/main/niceandfun/CSInterface.js
    echo        Save it to: %CSINTERFACE_PATH%
    echo.
    echo        The plugin will NOT work without this file.
)

:skip_download
echo.

:: ============================================
:: 7. Create config directory
:: ============================================
if not exist "%APPDATA%\IGS-ArtTools" (
    mkdir "%APPDATA%\IGS-ArtTools"
    echo [OK] Created config directory: %APPDATA%\IGS-ArtTools
)

:: ============================================
:: Done!
:: ============================================
echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo   CEP Debug Mode:  CSXS 7-13 enabled
echo   Symbolic Link:   %LINK_DIR%
echo   CSInterface.js:  Checked
echo.
echo   Next steps:
echo   1. Restart Photoshop
echo   2. Open Window ^> Extensions ^> IGS ACD Art Tools
echo   3. If prompted, enter your GitHub Token in settings
echo.
echo ============================================
echo.
pause
exit /b 0

:error
echo.
echo ============================================
echo   Setup Failed! Check the errors above.
echo ============================================
echo.
pause
exit /b 1
