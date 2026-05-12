import type { JobHandler, TierUpgradedPayload } from './types.js';

export const handleTierUpgraded: JobHandler<TierUpgradedPayload> = async (
  payload,
  env,
) => {
  if (env.DISCORD_WEBHOOK) {
    const response = await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚀 **Tier Upgrade** | User \`${payload.userId}\` is now **${payload.targetTier}**!`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed with status ${response.status}`);
    }
  }
};
