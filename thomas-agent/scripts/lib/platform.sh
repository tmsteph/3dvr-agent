#!/usr/bin/env bash

detect_platform() {
  case "$(uname -s)" in
    Linux*)
      if command -v termux-info >/dev/null 2>&1; then
        echo termux
      elif grep -qi microsoft /proc/version 2>/dev/null; then
        echo wsl
      else
        echo linux
      fi
      ;;
    Darwin*) echo mac ;;
    CYGWIN*|MINGW*|MSYS*) echo windows ;;
    *) echo unknown ;;
  esac
}

open_url() {
  url="$1"
  platform="$(detect_platform)"
  case "$platform" in
    termux) termux-open-url "$url" ;;
    linux) command -v xdg-open >/dev/null 2>&1 && xdg-open "$url" >/dev/null 2>&1 & ;;
    wsl) command -v wslview >/dev/null 2>&1 && wslview "$url" >/dev/null 2>&1 & ;;
    mac) open "$url" ;;
    windows) start "$url" ;;
    *) echo "Open manually: $url" ;;
  esac
}

get_location() {
  platform="$(detect_platform)"
  case "$platform" in
    termux)
      if command -v termux-location >/dev/null 2>&1; then
        termux-location
      else
        echo ""
      fi
      ;;
    *)
      echo ""
      ;;
  esac
}
