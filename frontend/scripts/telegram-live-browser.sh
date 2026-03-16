#!/usr/bin/env bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

DEFAULT_SERVER="rtmps://dc1-1.rtmp.t.me/s/"
DEFAULT_URL="https://clashofclaw.com/#stream"
DEFAULT_SIZE="1280x720"
DEFAULT_FPS="30"
DEFAULT_VIDEO_BITRATE="3500k"
DEFAULT_VIDEO_BUFSIZE="7000k"
DEFAULT_AUDIO_BITRATE="128k"
DEFAULT_KEYFRAME_SECONDS="2"
DEFAULT_DISPLAY_NUM="99"
DEFAULT_DRAW_MOUSE="0"
DEFAULT_STATE_DIR="${TMPDIR:-/tmp}/4626-telegram-live-browser"

STREAM_SERVER="${TELEGRAM_RTMP_SERVER:-$DEFAULT_SERVER}"
STREAM_KEY="${TELEGRAM_STREAM_KEY:-}"
TARGET_URL="${TELEGRAM_LIVE_URL:-$DEFAULT_URL}"
LIVE_SIZE="${TELEGRAM_LIVE_SIZE:-$DEFAULT_SIZE}"
LIVE_FPS="${TELEGRAM_LIVE_FPS:-$DEFAULT_FPS}"
VIDEO_BITRATE="${TELEGRAM_LIVE_VIDEO_BITRATE:-$DEFAULT_VIDEO_BITRATE}"
VIDEO_BUFSIZE="${TELEGRAM_LIVE_VIDEO_BUFSIZE:-$DEFAULT_VIDEO_BUFSIZE}"
AUDIO_BITRATE="${TELEGRAM_LIVE_AUDIO_BITRATE:-$DEFAULT_AUDIO_BITRATE}"
KEYFRAME_SECONDS="${TELEGRAM_LIVE_KEYFRAME_SECONDS:-$DEFAULT_KEYFRAME_SECONDS}"
DISPLAY_NUM="${TELEGRAM_LIVE_DISPLAY_NUM:-$DEFAULT_DISPLAY_NUM}"
DRAW_MOUSE="${TELEGRAM_LIVE_DRAW_MOUSE:-$DEFAULT_DRAW_MOUSE}"
STATE_DIR="${TELEGRAM_LIVE_BROWSER_STATE_DIR:-$DEFAULT_STATE_DIR}"
CHROME_BIN="${TELEGRAM_LIVE_CHROME_BIN:-}"

XVFB_PID_FILE="${STATE_DIR}/xvfb.pid"
CHROME_PID_FILE="${STATE_DIR}/chrome.pid"
FFMPEG_PID_FILE="${STATE_DIR}/ffmpeg.pid"
MODE_FILE="${STATE_DIR}/mode"
XVFB_LOG_FILE="${STATE_DIR}/xvfb.log"
CHROME_LOG_FILE="${STATE_DIR}/chrome.log"
FFMPEG_LOG_FILE="${STATE_DIR}/ffmpeg.log"

WIDTH=""
HEIGHT=""

usage() {
  cat <<EOF
Stream a web page to Telegram Live (no OBS) using Xvfb + Chromium + ffmpeg.

Usage:
  ${SCRIPT_NAME} start [options]
  ${SCRIPT_NAME} stop
  ${SCRIPT_NAME} status
  ${SCRIPT_NAME} logs
  ${SCRIPT_NAME} help

Start options:
  --key <value>             Telegram stream key (or TELEGRAM_STREAM_KEY)
  --server <value>          RTMPS server (default: ${DEFAULT_SERVER})
  --url <value>             URL to render (default: ${DEFAULT_URL})
  --size <WxH>              Output size (default: ${DEFAULT_SIZE})
  --fps <int>               Frame rate (default: ${DEFAULT_FPS})
  --video-bitrate <value>   Video bitrate (default: ${DEFAULT_VIDEO_BITRATE})
  --audio-bitrate <value>   Audio bitrate (default: ${DEFAULT_AUDIO_BITRATE})
  --display-num <int>       X display number (default: ${DEFAULT_DISPLAY_NUM})
  --draw-mouse <0|1>        Include cursor in capture (default: ${DEFAULT_DRAW_MOUSE})
  --chrome-bin <path>       Explicit browser binary path

Examples:
  TELEGRAM_STREAM_KEY='3595003982:...' ${SCRIPT_NAME} start
  ${SCRIPT_NAME} start --key '3595003982:...' --url 'https://clashofclaw.com/#stream'
  ${SCRIPT_NAME} status
  ${SCRIPT_NAME} stop

Notes:
  - Keep stream keys secret and rotate after testing if exposed.
  - If --url points to an .mp4 file, the script streams it directly with ffmpeg (no browser capture).
  - Cursor is hidden in capture by default (set --draw-mouse 1 to show it).
  - Logs are written to: ${DEFAULT_STATE_DIR} (override with TELEGRAM_LIVE_BROWSER_STATE_DIR)
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

is_pid_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(<"$pid_file")"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

parse_size() {
  if [[ "$LIVE_SIZE" =~ ^([0-9]+)x([0-9]+)$ ]]; then
    WIDTH="${BASH_REMATCH[1]}"
    HEIGHT="${BASH_REMATCH[2]}"
    return
  fi
  fail "--size must be in WxH format (received '${LIVE_SIZE}')."
}

require_integer() {
  local name="$1"
  local value="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    fail "${name} must be an integer (received '${value}')."
  fi
}

require_binary_flag() {
  local name="$1"
  local value="$2"
  if [[ "$value" != "0" && "$value" != "1" ]]; then
    fail "${name} must be 0 or 1 (received '${value}')."
  fi
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "missing dependency '${cmd}'. Please install it and retry."
  fi
}

is_mp4_url() {
  local url_lc
  url_lc="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$url_lc" =~ \.mp4($|[?#]) ]]
}

build_video_wrapper_page() {
  local video_url="$1"
  require_command base64
  local video_url_b64
  video_url_b64="$(printf '%s' "$video_url" | base64 | tr -d '\n')"
  local html
  html="$(cat <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Telegram Idle Stream</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      * {
        cursor: none !important;
      }
      video {
        width: 100vw;
        height: 100vh;
        object-fit: cover;
        display: block;
        background: #000;
      }
    </style>
  </head>
  <body>
    <video id="idleVideo" autoplay muted loop playsinline></video>
    <script>
      const v = document.getElementById('idleVideo')
      v.src = atob('${video_url_b64}')
      const keepPlaying = () => {
        if (v.paused) v.play().catch(() => {})
      }
      v.play().catch(() => {})
      document.addEventListener('visibilitychange', keepPlaying)
      setInterval(keepPlaying, 1000)
    </script>
  </body>
</html>
EOF
)"

  local html_b64
  html_b64="$(printf '%s' "$html" | base64 | tr -d '\n')"
  printf 'data:text/html;base64,%s' "$html_b64"
}

resolve_render_url() {
  local source_url="$1"
  if is_mp4_url "$source_url"; then
    build_video_wrapper_page "$source_url"
    return
  fi
  printf '%s' "$source_url"
}

resolve_chrome_bin() {
  if [[ -n "$CHROME_BIN" ]]; then
    if [[ -x "$CHROME_BIN" ]]; then
      printf '%s' "$CHROME_BIN"
      return
    fi
    fail "provided --chrome-bin path is not executable: ${CHROME_BIN}"
  fi

  local candidates=(
    chromium-browser
    chromium
    google-chrome-stable
    google-chrome
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return
    fi
  done
  fail "could not find Chromium/Chrome binary. Set TELEGRAM_LIVE_CHROME_BIN."
}

ensure_start_requirements() {
  require_command ffmpeg
  require_integer "--fps" "$LIVE_FPS"
  require_integer "--display-num" "$DISPLAY_NUM"
  require_integer "TELEGRAM_LIVE_KEYFRAME_SECONDS" "$KEYFRAME_SECONDS"
  require_binary_flag "--draw-mouse" "$DRAW_MOUSE"
  parse_size
  if [[ -z "$STREAM_KEY" ]]; then
    fail "missing stream key. Pass --key or set TELEGRAM_STREAM_KEY."
  fi
  if ! is_mp4_url "$TARGET_URL"; then
    require_command Xvfb
  fi
}

kill_from_pid_file() {
  local pid_file="$1"
  local name="$2"
  if ! is_pid_running "$pid_file"; then
    rm -f "$pid_file"
    return
  fi
  local pid
  pid="$(<"$pid_file")"
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
  rm -f "$pid_file"
  echo "Stopped ${name} (pid ${pid})."
}

stop_components() {
  kill_from_pid_file "$FFMPEG_PID_FILE" "ffmpeg"
  kill_from_pid_file "$CHROME_PID_FILE" "browser"
  kill_from_pid_file "$XVFB_PID_FILE" "Xvfb"
  rm -f "$MODE_FILE"
}

stop_stream() {
  local running=0
  if is_pid_running "$FFMPEG_PID_FILE" || is_pid_running "$CHROME_PID_FILE" || is_pid_running "$XVFB_PID_FILE"; then
    running=1
  fi
  stop_components
  if [[ "$running" -eq 0 ]]; then
    echo "No running stream components."
  fi
}

start_stream() {
  ensure_start_requirements

  if is_pid_running "$FFMPEG_PID_FILE"; then
    local pid
    pid="$(<"$FFMPEG_PID_FILE")"
    fail "stream appears active already (ffmpeg pid ${pid}). Run '${SCRIPT_NAME} stop' first."
  fi

  mkdir -p "$STATE_DIR"
  : >"$XVFB_LOG_FILE"
  : >"$CHROME_LOG_FILE"
  : >"$FFMPEG_LOG_FILE"

  local source_is_mp4="0"
  if is_mp4_url "$TARGET_URL"; then
    source_is_mp4="1"
  fi

  local gop="$((LIVE_FPS * KEYFRAME_SECONDS))"
  local output_url
  output_url="$(normalize_server_url "$STREAM_SERVER")${STREAM_KEY}"

  local mode_label=""
  local display="N/A"
  local render_url_log="$TARGET_URL"
  local xvfb_pid="n/a"
  local chrome_pid="n/a"
  local -a ffmpeg_cmd=()

  if [[ "$source_is_mp4" == "1" ]]; then
    mode_label="direct-mp4"
    echo "$mode_label" >"$MODE_FILE"
    ffmpeg_cmd=(
      ffmpeg
      -re
      -stream_loop -1
      -i "$TARGET_URL"
      -f lavfi
      -i "anullsrc=channel_layout=stereo:sample_rate=48000"
      -map 0:v:0
      -map 1:a:0
      -vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}"
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
  else
    mode_label="browser-capture"
    echo "$mode_label" >"$MODE_FILE"

    local render_url
    render_url="$(resolve_render_url "$TARGET_URL")"
    render_url_log="$render_url"
    if [[ "$render_url" == data:text/html* ]]; then
      render_url_log="data:text/html;base64,<inline-wrapper>"
    fi

    local local_display=":${DISPLAY_NUM}"
    local tcp_display="127.0.0.1:${DISPLAY_NUM}"
    display="$local_display"
    local display_socket="/tmp/.X11-unix/X${DISPLAY_NUM}"
    local chrome_exec
    chrome_exec="$(resolve_chrome_bin)"

    local -a chrome_args=(
      --no-first-run
      --no-default-browser-check
      --disable-infobars
      --disable-session-crashed-bubble
      --disable-features=Translate
      --autoplay-policy=no-user-gesture-required
      --window-position=0,0
      --window-size="${WIDTH},${HEIGHT}"
      --app="${render_url}"
    )
    if [[ "$(id -u)" -eq 0 ]]; then
      chrome_args+=(--no-sandbox --disable-setuid-sandbox)
    fi

    # Enable TCP listener as a fallback for environments where /tmp/.X11-unix
    # permissions are misconfigured and unix sockets are unavailable.
    Xvfb "$local_display" -screen 0 "${WIDTH}x${HEIGHT}x24" -listen tcp -ac >>"$XVFB_LOG_FILE" 2>&1 &
    xvfb_pid="$!"
    echo "$xvfb_pid" >"$XVFB_PID_FILE"

    local ready_mode=""
    for _ in $(seq 1 30); do
      if [[ -S "$display_socket" ]]; then
        ready_mode="unix_socket"
        display="$local_display"
        break
      fi
      if command -v xdpyinfo >/dev/null 2>&1; then
        if DISPLAY="$local_display" xdpyinfo >/dev/null 2>&1; then
          ready_mode="unix_probe"
          display="$local_display"
          break
        fi
        if DISPLAY="$tcp_display" xdpyinfo >/dev/null 2>&1; then
          ready_mode="tcp_probe"
          display="$tcp_display"
          break
        fi
      fi
      if ! kill -0 "$xvfb_pid" >/dev/null 2>&1; then
        stop_components >/dev/null 2>&1 || true
        fail "Xvfb failed to start. Check log: ${XVFB_LOG_FILE}"
      fi
      sleep 0.2
    done

    if [[ -z "$ready_mode" ]]; then
      if [[ -f "$XVFB_LOG_FILE" ]] && grep -q 'Mode of /tmp/.X11-unix should be set to 1777' "$XVFB_LOG_FILE"; then
        echo "Warning: /tmp/.X11-unix permissions are not 1777; unix X sockets are unavailable."
        echo "Warning: trying TCP DISPLAY fallback (${tcp_display})."
        display="$tcp_display"
      else
        # If probes are unavailable, proceed and let browser/ffmpeg startup act as
        # a practical readiness check.
        echo "Warning: timed out probing X display; proceeding with DISPLAY=${display}."
      fi
    fi

    DISPLAY="$display" nohup "$chrome_exec" "${chrome_args[@]}" >>"$CHROME_LOG_FILE" 2>&1 &
    chrome_pid="$!"
    echo "$chrome_pid" >"$CHROME_PID_FILE"
    sleep 2
    if ! kill -0 "$chrome_pid" >/dev/null 2>&1; then
      stop_components >/dev/null 2>&1 || true
      fail "browser exited immediately. Check log: ${CHROME_LOG_FILE}"
    fi

    ffmpeg_cmd=(
      ffmpeg
      -f x11grab
      -draw_mouse "$DRAW_MOUSE"
      -video_size "${WIDTH}x${HEIGHT}"
      -framerate "$LIVE_FPS"
      -i "${display}.0+0,0"
      -f lavfi
      -i "anullsrc=channel_layout=stereo:sample_rate=48000"
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
  fi

  nohup "${ffmpeg_cmd[@]}" >>"$FFMPEG_LOG_FILE" 2>&1 &
  local ffmpeg_pid="$!"
  echo "$ffmpeg_pid" >"$FFMPEG_PID_FILE"
  sleep 1
  if ! kill -0 "$ffmpeg_pid" >/dev/null 2>&1; then
    stop_components >/dev/null 2>&1 || true
    fail "ffmpeg exited immediately. Check log: ${FFMPEG_LOG_FILE}"
  fi
  wait_for_ffmpeg_frames 12
  local frame_wait_rc=$?
  if [[ "$frame_wait_rc" -eq 1 ]]; then
    stop_components >/dev/null 2>&1 || true
    fail "ffmpeg stopped before output frames were emitted. Check log: ${FFMPEG_LOG_FILE}"
  elif [[ "$frame_wait_rc" -eq 2 ]]; then
    stop_components >/dev/null 2>&1 || true
    fail "ffmpeg did not emit frames within startup window. Check log: ${FFMPEG_LOG_FILE}"
  fi

  echo "Started Telegram browser livestream."
  echo "Mode: ${mode_label}"
  echo "Source URL: ${TARGET_URL}"
  echo "Render URL: ${render_url_log}"
  echo "Display: ${display} (${WIDTH}x${HEIGHT} @ ${LIVE_FPS}fps)"
  echo "PIDs: xvfb=${xvfb_pid} browser=${chrome_pid} ffmpeg=${ffmpeg_pid}"
  echo "Logs:"
  echo "  ${XVFB_LOG_FILE}"
  echo "  ${CHROME_LOG_FILE}"
  echo "  ${FFMPEG_LOG_FILE}"
}

status_stream() {
  local mode="browser-capture"
  if [[ -f "$MODE_FILE" ]]; then
    mode="$(<"$MODE_FILE")"
  fi
  echo "Mode:    ${mode}"

  if [[ "$mode" == "direct-mp4" ]]; then
    if is_pid_running "$FFMPEG_PID_FILE"; then
      echo "ffmpeg:  running (pid $(<"$FFMPEG_PID_FILE"))"
      echo "Stream status: healthy"
    else
      echo "ffmpeg:  stopped"
      echo "Stream status: stopped"
    fi
    return
  fi

  local states=0
  if is_pid_running "$XVFB_PID_FILE"; then
    echo "Xvfb:    running (pid $(<"$XVFB_PID_FILE"))"
    states=$((states + 1))
  else
    echo "Xvfb:    stopped"
  fi
  if is_pid_running "$CHROME_PID_FILE"; then
    echo "Browser: running (pid $(<"$CHROME_PID_FILE"))"
    states=$((states + 1))
  else
    echo "Browser: stopped"
  fi
  if is_pid_running "$FFMPEG_PID_FILE"; then
    echo "ffmpeg:  running (pid $(<"$FFMPEG_PID_FILE"))"
    states=$((states + 1))
  else
    echo "ffmpeg:  stopped"
  fi

  if [[ "$states" -eq 3 ]]; then
    echo "Stream status: healthy"
  elif [[ "$states" -eq 0 ]]; then
    echo "Stream status: stopped"
  else
    echo "Stream status: partial (run '${SCRIPT_NAME} stop' then start again)"
  fi
}

show_logs() {
  local files=("$XVFB_LOG_FILE" "$CHROME_LOG_FILE" "$FFMPEG_LOG_FILE")
  local file
  for file in "${files[@]}"; do
    echo "===== ${file} ====="
    if [[ -f "$file" ]]; then
      sed -n '1,120p' "$file"
    else
      echo "(missing)"
    fi
  done
}

wait_for_ffmpeg_frames() {
  local timeout_seconds="$1"
  local start_ts
  start_ts="$(date +%s)"
  while true; do
    if ! is_pid_running "$FFMPEG_PID_FILE"; then
      return 1
    fi
    if [[ -f "$FFMPEG_LOG_FILE" ]] && rg -q "frame=\\s*[1-9][0-9]*" "$FFMPEG_LOG_FILE"; then
      return 0
    fi
    local now
    now="$(date +%s)"
    if (( now - start_ts >= timeout_seconds )); then
      return 2
    fi
    sleep 0.25
  done
}

main() {
  local cmd="${1:-help}"
  if [[ $# -gt 0 ]]; then
    shift
  fi

  case "$cmd" in
    start)
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
          --url)
            [[ $# -ge 2 ]] || fail "--url requires a value."
            TARGET_URL="$2"
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
          --display-num)
            [[ $# -ge 2 ]] || fail "--display-num requires a value."
            DISPLAY_NUM="$2"
            shift 2
            ;;
          --draw-mouse)
            [[ $# -ge 2 ]] || fail "--draw-mouse requires a value."
            DRAW_MOUSE="$2"
            shift 2
            ;;
          --chrome-bin)
            [[ $# -ge 2 ]] || fail "--chrome-bin requires a value."
            CHROME_BIN="$2"
            shift 2
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
      start_stream
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
