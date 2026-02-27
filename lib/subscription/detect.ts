import yaml from 'js-yaml';
import type { SubscriptionFormat } from './types';

export function detectFormat(content: string): SubscriptionFormat {
  const trimmed = content.trim();

  // Surge: has [Proxy] or [Proxy Group] sections
  if (/^\[Proxy\]/m.test(trimmed) || /^\[Proxy Group\]/m.test(trimmed)) {
    return 'surge';
  }

  // Clash: valid YAML with 'proxies' key
  try {
    const parsed = yaml.load(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'proxies' in (parsed as object)
    ) {
      return 'clash';
    }
  } catch {}

  // V2Ray: base64-decodable to vmess:// or ss:// links, or JSON with 'outbounds'
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (/^(vmess|ss|trojan):\/\//m.test(decoded)) {
      return 'v2ray';
    }
  } catch {}

  // Also check if it's directly vmess:// links (not base64 wrapped)
  if (/^(vmess|ss|trojan):\/\//m.test(trimmed)) {
    return 'v2ray';
  }

  // JSON with outbounds (V2Ray JSON config)
  try {
    const json = JSON.parse(trimmed);
    if (json && json.outbounds) {
      return 'v2ray';
    }
  } catch {}

  return 'unknown';
}
