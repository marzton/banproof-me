// ============================================================
// Mock HuggingFace Sentiment — randomised BULLISH / BEARISH
// ============================================================

import type { SentimentResult } from '../types/api.js';

const LABELS = ['BULLISH', 'BEARISH', 'NEUTRAL'] as const;

export function mockSentiment(): SentimentResult {
  const roll = Math.random();

  // Skew towards BULLISH (50 %) > BEARISH (35 %) > NEUTRAL (15 %)
  let label: (typeof LABELS)[number];
  if (roll < 0.50) {
    label = 'BULLISH';
  } else if (roll < 0.85) {
    label = 'BEARISH';
  } else {
    label = 'NEUTRAL';
  }

  const score      = parseFloat((0.55 + Math.random() * 0.40).toFixed(3)); // 0.55–0.95
  const confidence = parseFloat((0.70 + Math.random() * 0.28).toFixed(3)); // 0.70–0.98

  return { label, score, confidence };
}
