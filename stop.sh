#!/bin/bash
PID_FILE="/tmp/storyboard-backend.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Stopped backend (PID $PID)"
  else
    echo "Not running"
  fi
  rm -f "$PID_FILE"
else
  pkill -f "node server.js" 2>/dev/null && echo "Killed via pkill" || echo "Not running"
fi
