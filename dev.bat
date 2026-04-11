@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

set "ROOT_DIR=%~dp0"
set "WEB_DIR=%ROOT_DIR%web"
set "ELECTRON_DIR=%ROOT_DIR%electron"
set "BACKEND_BIN=%ROOT_DIR%new-api-dev.exe"

:menu
cls
echo ==============================
echo dev.bat menu
echo Project: new-api
echo ==============================
echo 1. Environment check
echo 2. Install deps ^(web + electron^)
echo 3. Start Go backend
echo 4. Start web frontend ^(Vite^)
echo 5. Run service tests
echo 6. Build web frontend
echo 7. Build Go backend
echo 8. Start Docker Compose
echo 9. Build Electron ^(Windows^)
echo 10. Clean build outputs
echo 0. Exit
set /p choice=Select: 

if "%choice%"=="0" goto :eof
if "%choice%"=="1" goto :env_check
if "%choice%"=="2" goto :deps_install
if "%choice%"=="3" goto :backend_dev
if "%choice%"=="4" goto :web_dev
if "%choice%"=="5" goto :service_test
if "%choice%"=="6" goto :web_build
if "%choice%"=="7" goto :backend_build
if "%choice%"=="8" goto :docker_up
if "%choice%"=="9" goto :electron_build
if "%choice%"=="10" goto :clean_outputs

echo [INFO] Invalid choice
call :wait_return
goto :menu

:env_check
echo ==============================
echo Environment check
echo ==============================
echo Required tools:
echo - Go 1.22+
echo - Bun ^(for web/^)
echo - Node.js + npm ^(for electron/^)
echo - Docker ^(optional, for compose/^)
echo.
echo Common local dev:
echo - Backend: go run main.go
echo - Frontend: cd web ^&^& bun run dev
echo - Electron: cd electron ^&^& npm run dev-app
call :wait_return
goto :menu

:deps_install
echo ==============================
echo Install deps
echo ==============================
pushd "%WEB_DIR%"
call bun install
if errorlevel 1 (
  popd
  call :show_exit
  call :wait_return
  goto :menu
)
popd
pushd "%ELECTRON_DIR%"
call npm install
if errorlevel 1 (
  popd
  call :show_exit
  call :wait_return
  goto :menu
)
popd
call :show_exit
call :wait_return
goto :menu

:backend_dev
echo ==============================
echo Start Go backend
echo ==============================
pushd "%ROOT_DIR%"
go run main.go
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:web_dev
echo ==============================
echo Start web frontend
echo ==============================
pushd "%WEB_DIR%"
call bun run dev
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:service_test
echo ==============================
echo Run service tests
echo ==============================
pushd "%ROOT_DIR%"
go test ./service -count=1 -timeout 60s
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:web_build
echo ==============================
echo Build web frontend
echo ==============================
pushd "%WEB_DIR%"
call bun run build
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:backend_build
echo ==============================
echo Build Go backend
echo ==============================
pushd "%ROOT_DIR%"
go build -o "%BACKEND_BIN%" .
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:docker_up
call :confirm_risk "Start Docker Compose (creates or updates local containers)"
if errorlevel 1 goto :menu
echo ==============================
echo Start Docker Compose
echo ==============================
pushd "%ROOT_DIR%"
docker compose up -d
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:electron_build
call :confirm_risk "Build Electron Windows package (writes to electron\\dist)"
if errorlevel 1 goto :menu
echo ==============================
echo Build Electron ^(Windows^)
echo ==============================
pushd "%ELECTRON_DIR%"
call npm run build:win
set "LAST_EXIT=%ERRORLEVEL%"
popd
call :show_exit_code %LAST_EXIT%
call :wait_return
goto :menu

:clean_outputs
call :confirm_risk "Clean build outputs (deletes new-api-dev.exe, web\\dist, electron\\dist)"
if errorlevel 1 goto :menu
echo ==============================
echo Clean build outputs
echo ==============================
if exist "%BACKEND_BIN%" del /q "%BACKEND_BIN%"
if exist "%WEB_DIR%\dist" rmdir /s /q "%WEB_DIR%\dist"
if exist "%ELECTRON_DIR%\dist" rmdir /s /q "%ELECTRON_DIR%\dist"
call :show_exit
call :wait_return
goto :menu

:confirm_risk
set /p confirm=Confirm risky action "%~1"? (y/N): 
if /i "%confirm%"=="y" exit /b 0
if /i "%confirm%"=="yes" exit /b 0
echo Cancelled
call :wait_return
exit /b 1

:show_exit
echo ----- exit %ERRORLEVEL% -----
exit /b 0

:show_exit_code
echo ----- exit %~1 -----
exit /b 0

:wait_return
set /p __devbat_wait=Press Enter to return...
exit /b 0
