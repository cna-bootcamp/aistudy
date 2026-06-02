#!/bin/bash
cd "$(dirname "$0")"

if [ -z "$1" ]; then
    echo "Usage: ./run.sh <path-to-jsx-file>"
    echo "Example: ./run.sh ./jsx/rag-architecture.jsx"
    exit 1
fi

JSX_PATH=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")

if [ ! -f "$JSX_PATH" ]; then
    echo "Error: File not found: $JSX_PATH"
    exit 1
fi

echo "📄 File: $JSX_PATH"

export JSX_FILE="$JSX_PATH"
docker compose up --build -d
sleep 2

CONTAINER_ID=$(docker compose ps -q jsx-viewer)
PORT=$(docker port $CONTAINER_ID 5173 | cut -d: -f2)
echo ""
echo "🚀 JSX Viewer: http://localhost:$PORT"
echo ""

docker logs -f $CONTAINER_ID 2>&1 | grep -v "Local:\|Network:"
