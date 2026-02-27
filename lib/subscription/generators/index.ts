import type { SubscriptionConfig, SubscriptionFormat } from '../types';
import { generateSurge } from './surge';
import { generateClash } from './clash';
import { generateV2ray } from './v2ray';

export { generateSurge, generateClash, generateV2ray };

export function generateSubscription(config: SubscriptionConfig, format: SubscriptionFormat): string {
  switch (format) {
    case 'surge': return generateSurge(config);
    case 'clash': return generateClash(config);
    case 'v2ray': return generateV2ray(config);
    default: throw new Error(`Unsupported format: ${format}`);
  }
}
