#!/bin/bash
# Polygon Sentiment Analysis Cron
# Scheduled every 5 mins during market hours
curl -X POST "https://api.goldshore.ai/signals/polygon" \
  -H "Authorization: Bearer $POLYGON_API_KEY" \
  -d '{"action": "analyze"}'
