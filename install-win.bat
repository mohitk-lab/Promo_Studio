@echo off
echo ============================================
echo  Promo Studio - Premiere Pro Extension
echo  Windows Installation Script
echo ============================================
echo.

:: Check if source folder exists
if not exist "%~dp0com.promostudio.panel" (
    echo  ERROR: com.promostudio.panel folder not found!
    echo  Make sure you run this script from the Promo_Studio folder.
    echo.
    pause
    exit /b 1
)

:: Step 1: Enable unsigned extensions (PlayerDebugMode)
echo [1/3] Enabling unsigned extensions...

:: Try CSXS.12 first, then CSXS.11, then CSXS.10
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo    PlayerDebugMode set for CSXS 9-12

:: Step 2: Create extensions directory if needed
set EXTENSIONS_DIR=%APPDATA%\Adobe\CEP\extensions
set TARGET_DIR=%EXTENSIONS_DIR%\com.promostudio.panel
set SOURCE_DIR=%~dp0com.promostudio.panel
echo.
echo [2/3] Installing to: %TARGET_DIR%

:: Create parent directories if they don't exist
if not exist "%APPDATA%\Adobe" mkdir "%APPDATA%\Adobe"
if not exist "%APPDATA%\Adobe\CEP" mkdir "%APPDATA%\Adobe\CEP"
if not exist "%EXTENSIONS_DIR%" mkdir "%EXTENSIONS_DIR%"

:: Remove old installation (file or symlink)
if exist "%TARGET_DIR%" (
    echo    Removing old installation...
    :: Check if it's a symlink (junction)
    fsutil reparsepoint query "%TARGET_DIR%" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        rmdir "%TARGET_DIR%"
    ) else (
        rmdir /s /q "%TARGET_DIR%"
    )
)

:: Step 3: Create symlink (junction) so changes reflect instantly
echo    Creating symlink for live development...
mklink /J "%TARGET_DIR%" "%SOURCE_DIR%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [3/3] Installation complete! (SYMLINK mode)
    echo.
    echo ============================================
    echo  SYMLINK ACTIVE - All file changes in this
    echo  repo will reflect instantly in Premiere Pro.
    echo.
    echo  To see changes:
    echo    - CSS/HTML: Close ^& reopen the panel
    echo      (Window ^> Extensions ^> Promo Studio)
    echo    - Or right-click panel ^> Reload
    echo.
    echo  Next steps:
    echo  1. Restart Premiere Pro (first time only)
    echo  2. Go to: Window ^> Extensions ^> Promo Studio
    echo  3. Debug at: http://localhost:8088
    echo ============================================
) else (
    echo.
    echo  Symlink failed, falling back to copy...
    xcopy /s /i /q "%SOURCE_DIR%" "%TARGET_DIR%\"
    echo.
    echo  NOTE: Copy mode - you must re-run install
    echo  after each change. Try running as Administrator
    echo  for symlink mode.
)

echo.
pause
