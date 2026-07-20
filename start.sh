#!/bin/bash
# Start StoryBOARD GEN backend (detached)
cd "$(dirname "$0")/backend" || exit 1
PID_FILE="/tmp/storyboard-backend.pid"
LOG_FILE="/tmp/storyboard-backend.log"

# Kill old instance if any
if [ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
  echo "Already running (PID $(cat $PID_FILE))"
  exit 0
fi

setsid nohup node server.js > "$LOG_FILE" 2>&1 < /dev/null &
echo $! > "$PID_FILE"
sleep 1
echo "Started backend (PID $(cat $PID_FILE)) — http://localhost:3456"
