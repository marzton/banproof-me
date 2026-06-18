#!/bin/bash
# Polygon Sentiment Analysis Cron
# Scheduled every 5 mins during market hours
set -euo pipefail

curl --fail-with-body -X POST "https://api.goldshore.ai/signals/polygon" \
  -H "Authorization: Bearer $POLYGON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "analyze"}'
