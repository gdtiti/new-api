#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
ELECTRON_DIR="$ROOT_DIR/electron"
BACKEND_BIN="$ROOT_DIR/new-api-dev"

wait_return() {
  read -r -p "Press Enter to return..." _
}

confirm_risk() {
  local label="$1"
  read -r -p "Confirm risky action '$label'? (y/N): " ans
  case "$ans" in
    y|Y|yes|YES) return 0 ;;
    *) echo "Cancelled"; return 1 ;;
  esac
}

show_exit_code() {
  local code="$1"
  echo "----- exit $code -----"
}

run_in_dir() {
  local dir="$1"
  shift
  (
    cd "$dir" || exit 1
    "$@"
  )
  return $?
}

electron_build_cmd() {
  case "$(uname -s)" in
    Darwin) echo "build:mac" ;;
    Linux) echo "build:linux" ;;
    *) echo "build" ;;
  esac
}

while true; do
  clear
  echo "=============================="
  echo "dev.sh menu"
  echo "Project: new-api"
  echo "=============================="
  echo "1. Environment check"
  echo "2. Install deps (web + electron)"
  echo "3. Start Go backend"
  echo "4. Start web frontend (Vite)"
  echo "5. Run service tests"
  echo "6. Build web frontend"
  echo "7. Build Go backend"
  echo "8. Start Docker Compose"
  echo "9. Build Electron (current platform)"
  echo "10. Clean build outputs"
  echo "0. Exit"
  read -r -p "Select: " choice

  case "$choice" in
    1)
      echo "=============================="
      echo "Environment check"
      echo "=============================="
      echo "Required tools:"
      echo "- Go 1.22+"
      echo "- Bun (for web/)"
      echo "- Node.js + npm (for electron/)"
      echo "- Docker (optional, for compose)"
      echo
      echo "Common local dev:"
      echo "- Backend: go run main.go"
      echo "- Frontend: cd web && bun run dev"
      echo "- Electron: cd electron && npm run dev-app"
      wait_return
      ;;
    2)
      echo "=============================="
      echo "Install deps"
      echo "=============================="
      run_in_dir "$WEB_DIR" bun install
      code=$?
      if [ "$code" -eq 0 ]; then
        run_in_dir "$ELECTRON_DIR" npm install
        code=$?
      fi
      show_exit_code "$code"
      wait_return
      ;;
    3)
      echo "=============================="
      echo "Start Go backend"
      echo "=============================="
      run_in_dir "$ROOT_DIR" go run main.go
      show_exit_code "$?"
      wait_return
      ;;
    4)
      echo "=============================="
      echo "Start web frontend"
      echo "=============================="
      run_in_dir "$WEB_DIR" bun run dev
      show_exit_code "$?"
      wait_return
      ;;
    5)
      echo "=============================="
      echo "Run service tests"
      echo "=============================="
      run_in_dir "$ROOT_DIR" go test ./service -count=1 -timeout 60s
      show_exit_code "$?"
      wait_return
      ;;
    6)
      echo "=============================="
      echo "Build web frontend"
      echo "=============================="
      run_in_dir "$WEB_DIR" bun run build
      show_exit_code "$?"
      wait_return
      ;;
    7)
      echo "=============================="
      echo "Build Go backend"
      echo "=============================="
      run_in_dir "$ROOT_DIR" go build -o "$BACKEND_BIN" .
      show_exit_code "$?"
      wait_return
      ;;
    8)
      confirm_risk "Start Docker Compose (creates or updates local containers)" || {
        wait_return
        continue
      }
      echo "=============================="
      echo "Start Docker Compose"
      echo "=============================="
      run_in_dir "$ROOT_DIR" docker compose up -d
      show_exit_code "$?"
      wait_return
      ;;
    9)
      confirm_risk "Build Electron package for current platform (writes to electron/dist)" || {
        wait_return
        continue
      }
      echo "=============================="
      echo "Build Electron"
      echo "=============================="
      run_in_dir "$ELECTRON_DIR" npm run "$(electron_build_cmd)"
      show_exit_code "$?"
      wait_return
      ;;
    10)
      confirm_risk "Clean build outputs (deletes new-api-dev, web/dist, electron/dist)" || {
        wait_return
        continue
      }
      echo "=============================="
      echo "Clean build outputs"
      echo "=============================="
      [ -f "$BACKEND_BIN" ] && rm -f "$BACKEND_BIN"
      [ -d "$WEB_DIR/dist" ] && rm -rf "$WEB_DIR/dist"
      [ -d "$ELECTRON_DIR/dist" ] && rm -rf "$ELECTRON_DIR/dist"
      show_exit_code 0
      wait_return
      ;;
    0)
      exit 0
      ;;
    *)
      echo "Invalid choice"
      wait_return
      ;;
  esac
done
