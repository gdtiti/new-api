$ErrorActionPreference = 'Continue'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $RootDir 'web'
$ElectronDir = Join-Path $RootDir 'electron'
$BackendBin = Join-Path $RootDir 'new-api-dev.exe'

function Wait-Return {
    [void](Read-Host 'Press Enter to return')
}

function Confirm-DevbatRisk {
    param([string]$Label)
    $ans = Read-Host "Confirm risky action '$Label'? (y/N)"
    return @('y', 'yes', 'Y', 'YES') -contains $ans
}

function Show-ExitCode {
    param([int]$Code)
    Write-Host ("----- exit {0} -----" -f $Code)
}

function Invoke-InDirectory {
    param(
        [string]$Path,
        [scriptblock]$Action
    )

    Push-Location $Path
    try {
        & $Action
        if ($null -ne $LASTEXITCODE) {
            return [int]$LASTEXITCODE
        }
        return 0
    } finally {
        Pop-Location
    }
}

while ($true) {
    Clear-Host
    Write-Host '=============================='
    Write-Host 'dev.ps1 menu'
    Write-Host 'Project: new-api'
    Write-Host '=============================='
    Write-Host '1. Environment check'
    Write-Host '2. Install deps (web + electron)'
    Write-Host '3. Start Go backend'
    Write-Host '4. Start web frontend (Vite)'
    Write-Host '5. Run service tests'
    Write-Host '6. Build web frontend'
    Write-Host '7. Build Go backend'
    Write-Host '8. Start Docker Compose'
    Write-Host '9. Build Electron (Windows)'
    Write-Host '10. Clean build outputs'
    Write-Host '0. Exit'
    $choice = Read-Host 'Select'

    switch ($choice) {
        '1' {
            Write-Host '=============================='
            Write-Host 'Environment check'
            Write-Host '=============================='
            Write-Host 'Required tools:'
            Write-Host '- Go 1.22+'
            Write-Host '- Bun (for web/)'
            Write-Host '- Node.js + npm (for electron/)'
            Write-Host '- Docker (optional, for compose)'
            Write-Host ''
            Write-Host 'Common local dev:'
            Write-Host '- Backend: go run main.go'
            Write-Host '- Frontend: cd web; bun run dev'
            Write-Host '- Electron: cd electron; npm run dev-app'
            Wait-Return
        }
        '2' {
            Write-Host '=============================='
            Write-Host 'Install deps'
            Write-Host '=============================='
            $code = Invoke-InDirectory $WebDir { bun install }
            if ($code -eq 0) {
                $code = Invoke-InDirectory $ElectronDir { npm install }
            }
            Show-ExitCode $code
            Wait-Return
        }
        '3' {
            Write-Host '=============================='
            Write-Host 'Start Go backend'
            Write-Host '=============================='
            $code = Invoke-InDirectory $RootDir { go run main.go }
            Show-ExitCode $code
            Wait-Return
        }
        '4' {
            Write-Host '=============================='
            Write-Host 'Start web frontend'
            Write-Host '=============================='
            $code = Invoke-InDirectory $WebDir { bun run dev }
            Show-ExitCode $code
            Wait-Return
        }
        '5' {
            Write-Host '=============================='
            Write-Host 'Run service tests'
            Write-Host '=============================='
            $code = Invoke-InDirectory $RootDir { go test ./service -count=1 -timeout 60s }
            Show-ExitCode $code
            Wait-Return
        }
        '6' {
            Write-Host '=============================='
            Write-Host 'Build web frontend'
            Write-Host '=============================='
            $code = Invoke-InDirectory $WebDir { bun run build }
            Show-ExitCode $code
            Wait-Return
        }
        '7' {
            Write-Host '=============================='
            Write-Host 'Build Go backend'
            Write-Host '=============================='
            $code = Invoke-InDirectory $RootDir { go build -o $BackendBin . }
            Show-ExitCode $code
            Wait-Return
        }
        '8' {
            if (-not (Confirm-DevbatRisk 'Start Docker Compose (creates or updates local containers)')) {
                Write-Host 'Cancelled'
                Wait-Return
                continue
            }
            Write-Host '=============================='
            Write-Host 'Start Docker Compose'
            Write-Host '=============================='
            $code = Invoke-InDirectory $RootDir { docker compose up -d }
            Show-ExitCode $code
            Wait-Return
        }
        '9' {
            if (-not (Confirm-DevbatRisk 'Build Electron Windows package (writes to electron\dist)')) {
                Write-Host 'Cancelled'
                Wait-Return
                continue
            }
            Write-Host '=============================='
            Write-Host 'Build Electron (Windows)'
            Write-Host '=============================='
            $code = Invoke-InDirectory $ElectronDir { npm run build:win }
            Show-ExitCode $code
            Wait-Return
        }
        '10' {
            if (-not (Confirm-DevbatRisk 'Clean build outputs (deletes new-api-dev.exe, web\dist, electron\dist)')) {
                Write-Host 'Cancelled'
                Wait-Return
                continue
            }
            Write-Host '=============================='
            Write-Host 'Clean build outputs'
            Write-Host '=============================='
            if (Test-Path $BackendBin) { Remove-Item $BackendBin -Force }
            $webDist = Join-Path $WebDir 'dist'
            if (Test-Path $webDist) { Remove-Item $webDist -Recurse -Force }
            $electronDist = Join-Path $ElectronDir 'dist'
            if (Test-Path $electronDist) { Remove-Item $electronDist -Recurse -Force }
            Show-ExitCode 0
            Wait-Return
        }
        '0' {
            exit 0
        }
        default {
            Write-Host 'Invalid choice'
            Wait-Return
        }
    }
}
