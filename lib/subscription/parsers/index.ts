import type { SubscriptionConfig, SubscriptionFormat } from '../types';
import { parseSurge } from './surge';
import { parseClash } from './clash';
import { parseV2ray } from './v2ray';

export { parseSurge, parseClash, parseV2ray };

export function parseSubscription(
  content: string,
  format: SubscriptionFormat
): SubscriptionConfig {
  switch (format) {
    case 'surge':
      return parseSurge(content);
    case 'clash':
      return parseClash(content);
    case 'v2ray':
      return parseV2ray(content);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
