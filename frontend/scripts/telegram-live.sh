#!/usr/bin/env bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
DEFAULT_SERVER="rtmps://dc1-1.rtmp.t.me/s/"
DEFAULT_SIZE="1280x720"
DEFAULT_FPS="30"
DEFAULT_VIDEO_BITRATE="3000k"
DEFAULT_VIDEO_BUFSIZE="6000k"
DEFAULT_AUDIO_BITRATE="128k"
DEFAULT_KEYFRAME_SECONDS="2"
DEFAULT_STATE_DIR="${TMPDIR:-/tmp}/4626-telegram-live"

STREAM_SERVER="${TELEGRAM_RTMP_SERVER:-$DEFAULT_SERVER}"
STREAM_KEY="${TELEGRAM_STREAM_KEY:-}"
LIVE_SIZE="${TELEGRAM_LIVE_SIZE:-$DEFAULT_SIZE}"
LIVE_FPS="${TELEGRAM_LIVE_FPS:-$DEFAULT_FPS}"
VIDEO_BITRATE="${TELEGRAM_LIVE_VIDEO_BITRATE:-$DEFAULT_VIDEO_BITRATE}"
VIDEO_BUFSIZE="${TELEGRAM_LIVE_VIDEO_BUFSIZE:-$DEFAULT_VIDEO_BUFSIZE}"
AUDIO_BITRATE="${TELEGRAM_LIVE_AUDIO_BITRATE:-$DEFAULT_AUDIO_BITRATE}"
KEYFRAME_SECONDS="${TELEGRAM_LIVE_KEYFRAME_SECONDS:-$DEFAULT_KEYFRAME_SECONDS}"
STATE_DIR="${TELEGRAM_LIVE_STATE_DIR:-$DEFAULT_STATE_DIR}"
PID_FILE="${STATE_DIR}/ffmpeg.pid"
LOG_FILE="${STATE_DIR}/ffmpeg.log"

usage() {
  cat <<EOF
Native Telegram livestream smoke-test helper (ffmpeg + RTMPS).

Usage:
  ${SCRIPT_NAME} start [--key <stream_key>] [--server <rtmps://.../s/>]
                      [--size <WxH>] [--fps <int>] [--video-bitrate <k>]
                      [--audio-bitrate <k>] [--foreground]
  ${SCRIPT_NAME} stop
  ${SCRIPT_NAME} status
  ${SCRIPT_NAME} logs
  ${SCRIPT_NAME} help

Examples:
  TELEGRAM_STREAM_KEY='3595003982:...' ${SCRIPT_NAME} start
  ${SCRIPT_NAME} start --key '3595003982:...' --foreground
  ${SCRIPT_NAME} stop

Notes:
  - 'start' runs ffmpeg test bars + silent audio (quick connectivity test).
  - For real browser/window capture, use OBS with the same RTMPS server/key.
  - Rotate stream keys after testing if they are ever shared.
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

normalize_server_url() {
  if [[ "$1" == */ ]]; then
    printf '%s' "$1"
  else
    printf '%s/' "$1"
  fi
}

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(<"$PID_FILE")"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

require_ffmpeg() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    fail "ffmpeg is required. Install ffmpeg and try again."
  fi
}

ensure_key_present() {
  if [[ -z "$STREAM_KEY" ]]; then
    fail "missing stream key. Pass --key or set TELEGRAM_STREAM_KEY."
  fi
}

start_stream() {
  local foreground="$1"

  require_ffmpeg
  ensure_key_present

  if is_running; then
    local running_pid
    running_pid="$(<"$PID_FILE")"
    fail "stream already running (pid ${running_pid}). Use '${SCRIPT_NAME} stop' first."
  fi

  mkdir -p "$STATE_DIR"
  : >"$LOG_FILE"

  local output_url
  output_url="$(normalize_server_url "$STREAM_SERVER")${STREAM_KEY}"

  if ! [[ "$LIVE_FPS" =~ ^[0-9]+$ ]]; then
    fail "--fps must be an integer (got '${LIVE_FPS}')."
  fi
  if ! [[ "$KEYFRAME_SECONDS" =~ ^[0-9]+$ ]]; then
    fail "TELEGRAM_LIVE_KEYFRAME_SECONDS must be an integer (got '${KEYFRAME_SECONDS}')."
  fi
  local gop
  gop="$((LIVE_FPS * KEYFRAME_SECONDS))"

  local -a ffmpeg_cmd=(
    ffmpeg
    -re
    -f lavfi -i "testsrc=size=${LIVE_SIZE}:rate=${LIVE_FPS}"
    -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000"
    -c:v libx264
    -preset veryfast
    -pix_fmt yuv420p
    -r "$LIVE_FPS"
    -g "$gop"
    -b:v "$VIDEO_BITRATE"
    -maxrate "$VIDEO_BITRATE"
    -bufsize "$VIDEO_BUFSIZE"
    -c:a aac
    -b:a "$AUDIO_BITRATE"
    -ar 48000
    -f flv
    "$output_url"
  )

  if [[ "$foreground" == "1" ]]; then
    echo "Starting Telegram livestream test in foreground..."
    echo "Server: ${STREAM_SERVER}"
    echo "Size/FPS: ${LIVE_SIZE} @ ${LIVE_FPS}"
    echo "Video/AAC: ${VIDEO_BITRATE} / ${AUDIO_BITRATE}"
    "${ffmpeg_cmd[@]}"
    return
  fi

  nohup "${ffmpeg_cmd[@]}" >>"$LOG_FILE" 2>&1 &
  local pid="$!"
  echo "$pid" >"$PID_FILE"
  echo "Started Telegram livestream test (pid ${pid})."
  echo "Logs: ${LOG_FILE}"
  echo "Stop: ${SCRIPT_NAME} stop"
}

stop_stream() {
  if ! is_running; then
    rm -f "$PID_FILE"
    echo "No running Telegram livestream process."
    return
  fi

  local pid
  pid="$(<"$PID_FILE")"
  kill "$pid" >/dev/null 2>&1 || true

  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$PID_FILE"
  echo "Stopped Telegram livestream process (pid ${pid})."
}

status_stream() {
  if is_running; then
    local pid
    pid="$(<"$PID_FILE")"
    echo "Telegram livestream is running (pid ${pid})."
    echo "Logs: ${LOG_FILE}"
    return
  fi
  echo "Telegram livestream is not running."
}

show_logs() {
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "No log file found at ${LOG_FILE}."
    return
  fi
  sed -n '1,200p' "$LOG_FILE"
}

main() {
  local cmd="${1:-help}"
  if [[ $# -gt 0 ]]; then
    shift
  fi

  case "$cmd" in
    start)
      local foreground="0"
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --key)
            [[ $# -ge 2 ]] || fail "--key requires a value."
            STREAM_KEY="$2"
            shift 2
            ;;
          --server)
            [[ $# -ge 2 ]] || fail "--server requires a value."
            STREAM_SERVER="$2"
            shift 2
            ;;
          --size)
            [[ $# -ge 2 ]] || fail "--size requires a value."
            LIVE_SIZE="$2"
            shift 2
            ;;
          --fps)
            [[ $# -ge 2 ]] || fail "--fps requires a value."
            LIVE_FPS="$2"
            shift 2
            ;;
          --video-bitrate)
            [[ $# -ge 2 ]] || fail "--video-bitrate requires a value."
            VIDEO_BITRATE="$2"
            shift 2
            ;;
          --audio-bitrate)
            [[ $# -ge 2 ]] || fail "--audio-bitrate requires a value."
            AUDIO_BITRATE="$2"
            shift 2
            ;;
          --foreground)
            foreground="1"
            shift
            ;;
          -h|--help)
            usage
            exit 0
            ;;
          *)
            fail "unknown option '$1'. Run '${SCRIPT_NAME} help' for usage."
            ;;
        esac
      done
      start_stream "$foreground"
      ;;
    stop)
      stop_stream
      ;;
    status)
      status_stream
      ;;
    logs)
      show_logs
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      fail "unknown command '${cmd}'. Run '${SCRIPT_NAME} help' for usage."
      ;;
  esac
}

main "$@"
