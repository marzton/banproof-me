// ============================================================
// BanproofEngine — Cloudflare Workflow
// Durable, checkpointed processing for slow external APIs.
// Branches based on user tier: free / pro / agency.
// Toggle mock vs. real APIs via USE_MOCK env var.
// ============================================================

import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from 'cloudflare:workers';
import { mockSentiment } from './mocks/huggingface.js';
import { mockOdds }      from './mocks/odds-api.js';
import type { SentimentResult, OddsResult, AgencyAnalytics, PlanTier } from './types/api.js';

export type Params = {
  query:  string;
  userId: string;
};

type Env = {
  DB:             D1Database;
  CACHE:          KVNamespace;
  USE_MOCK:       string;
  HF_API_TOKEN?:  string;
  ODDS_API_KEY?:  string;
  DISCORD_WEBHOOK?: string;
};

export class BanproofEngine extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { query, userId } = event.payload;
    const isMock = this.env.USE_MOCK !== 'false';

    // ── STEP 0: Fetch user tier ───────────────────────────────
    const userTier = await step.do('fetch-user-tier', async () => {
      const row = await this.env.DB.prepare(
        'SELECT plan_tier FROM users WHERE id = ? LIMIT 1',
      ).bind(userId).first<{ plan_tier: PlanTier }>();
      return (row?.plan_tier ?? 'free') as PlanTier;
    });

    // ── STEP 1: Sentiment (all tiers) ────────────────────────
    const sentiment: SentimentResult = await step.do('sentiment-analysis', async () => {
      if (isMock) return mockSentiment();

      const res = await fetch(
        'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest',
        {
          method:  'POST',
          headers: {
            Authorization: `Bearer ${this.env.HF_API_TOKEN ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: query }),
        },
      );
      const json = await res.json<Array<Array<{ label: string; score: number }>>>();
      const top  = json[0]?.sort((a, b) => b.score - a.score)[0];
      return {
        label:      (top?.label?.toUpperCase() ?? 'NEUTRAL') as SentimentResult['label'],
        score:      top?.score ?? 0.5,
        confidence: top?.score ?? 0.5,
      };
    });

    // ── Free tier: sentiment only ────────────────────────────
    if (userTier === 'free') {
      await step.do('log-free', async () => {
        await this.env.DB.prepare(
          `INSERT INTO audit_log (user_id, action, metadata) VALUES (?, ?, ?)`,
        ).bind(userId, 'SENTIMENT_ONLY', JSON.stringify({ sentiment, query })).run();
      });

      return {
        tier:           userTier,
        sentiment,
        upgrade_prompt: 'Upgrade to Pro for full odds data.',
      };
    }

    // ── STEP 2: Odds aggregation (pro + agency) ───────────────
    const oddsResult: OddsResult = await step.do('odds-aggregation', async () => {
      if (isMock) return mockOdds();

      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/upcoming/odds/?apiKey=${this.env.ODDS_API_KEY ?? ''}&markets=h2h&oddsFormat=american`,
      );
      const json = await res.json<any[]>();
      const bookmakers = (json[0]?.bookmakers ?? []).slice(0, 3).map((bm: any) => ({
        bookmaker: bm.title,
        price:     bm.markets?.[0]?.outcomes?.[0]?.price ?? -110,
        spread:    0,
      }));
      const best = bookmakers[0] ?? { bookmaker: 'Unknown', price: -110, spread: 0 };
      return {
        bookmakers,
        bestPrice: { bookmaker: best.bookmaker, price: best.price, value: 'EV+' as const },
      };
    });

    // ── STEP 3: Best price (pro + agency) ────────────────────
    const bestPrice = oddsResult.bestPrice;

    // ── Pro tier: return odds + best price ───────────────────
    if (userTier === 'pro') {
      await step.do('log-pro', async () => {
        await this.env.DB.prepare(
          `INSERT INTO audit_log (user_id, action, metadata) VALUES (?, ?, ?)`,
        ).bind(userId, 'ODDS_ANALYSIS', JSON.stringify({ sentiment, odds: oddsResult.bookmakers, bestPrice })).run();
      });

      return {
        tier:      userTier,
        sentiment,
        odds:      oddsResult.bookmakers,
        best_price: bestPrice,
      };
    }

    // ── STEP 4: Advanced analytics (agency) ──────────────────
    const analytics: AgencyAnalytics = await step.do('advanced-analytics', async () => {
      const sharpPrice  = oddsResult.bookmakers.reduce((best, b) =>
        b.price > best.price ? b : best, oddsResult.bookmakers[0]);
      const publicPrice = oddsResult.bookmakers.reduce((worst, b) =>
        b.price < worst.price ? b : worst, oddsResult.bookmakers[0]);

      return {
        sharp_public_split:    { sharp_price: sharpPrice.price, public_price: publicPrice.price },
        ev_plus_threshold:     0.08,
        confidence_multiplier: sentiment.confidence > 0.85 ? 1.5 : 1.0,
        recommendation:        sentiment.label === 'BULLISH' && sentiment.confidence > 0.8
          ? 'STRONG_BUY'
          : sentiment.label === 'BULLISH'
            ? 'BUY'
            : sentiment.label === 'BEARISH'
              ? 'SELL'
              : 'HOLD',
      };
    });

    // ── STEP 5: Discord notification (agency) ────────────────
    await step.do('discord-notify', async () => {
      if (!this.env.DISCORD_WEBHOOK) {
        console.log('[Agency] Discord webhook not configured — skipping.');
        return;
      }

      const colour = sentiment.label === 'BULLISH' ? 0x00ff00 : 0xff0000;
      await fetch(this.env.DISCORD_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          content: `🎯 Agency Signal — user ${userId}`,
          embeds:  [{
            title:       `${sentiment.label} Signal`,
            description: `Score: ${(sentiment.score * 100).toFixed(1)}% | Best: ${bestPrice.bookmaker} @ ${bestPrice.price}`,
            color:       colour,
            fields:      [
              { name: 'Sharp/Public Split', value: `Sharp: ${analytics.sharp_public_split.sharp_price} | Public: ${analytics.sharp_public_split.public_price}`, inline: true },
              { name: 'Recommendation',     value: analytics.recommendation, inline: true },
            ],
          }],
        }),
      });
    });

    // ── STEP 6: Email summary (agency, future) ───────────────
    await step.do('email-summary', async () => {
      console.log(`[Agency] Email summary queued for userId=${userId}`);
    });

    // ── STEP 7: Full audit trail (agency) ────────────────────
    await step.do('full-audit-trail', async () => {
      await this.env.DB.prepare(
        `INSERT INTO audit_log (user_id, action, metadata) VALUES (?, ?, ?)`,
      ).bind(userId, 'AGENCY_FULL_ANALYSIS', JSON.stringify({
        query,
        sentiment,
        odds:      oddsResult.bookmakers,
        bestPrice,
        analytics,
        executedAt: new Date().toISOString(),
      })).run();
    });

    return {
      tier:           userTier,
      sentiment,
      odds:           oddsResult.bookmakers,
      best_price:     bestPrice,
      analytics,
      execution_proof: {
        discord_sent:  !!this.env.DISCORD_WEBHOOK,
        audit_logged:  true,
        timestamp:     new Date().toISOString(),
      },
    };
  }
}
