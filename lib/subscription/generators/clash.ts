import * as yaml from 'js-yaml';
import type { SubscriptionConfig, ProxyServer, ProxyGroup, Rule } from '../types';

/** Map of Surge general keys to their Clash equivalents */
const GENERAL_KEY_MAP: Record<string, string> = {
  'loglevel': 'log-level',
  'http-listen': 'port',
  'socks5-listen': 'socks-port',
};

/** Known Clash top-level general keys */
const CLASH_GENERAL_KEYS = new Set([
  'port',
  'socks-port',
  'allow-lan',
  'mode',
  'log-level',
  'external-controller',
  'secret',
  'bind-address',
  'ipv6',
]);

/** SS settings that map to specific Clash proxy keys */
const SS_KEY_MAP: Record<string, string> = {
  'encrypt-method': 'cipher',
  'udp-relay': 'udp',
};

function buildClashProxy(server: ProxyServer): Record<string, unknown> | null {
  if (server.type === 'direct' || server.type === 'reject') {
    return null;
  }

  const base: Record<string, unknown> = {
    name: server.name,
    type: server.type,
    server: server.server,
    port: server.port,
  };

  switch (server.type) {
    case 'ss': {
      for (const [key, value] of Object.entries(server.settings)) {
        const clashKey = SS_KEY_MAP[key] || key;
        base[clashKey] = coerceValue(value);
      }
      break;
    }

    case 'vmess': {
      for (const [key, value] of Object.entries(server.settings)) {
        base[key] = coerceValue(value);
      }
      break;
    }

    case 'trojan': {
      for (const [key, value] of Object.entries(server.settings)) {
        base[key] = coerceValue(value);
      }
      break;
    }

    default: {
      for (const [key, value] of Object.entries(server.settings)) {
        base[key] = coerceValue(value);
      }
    }
  }

  return base;
}

function buildClashProxyGroup(
  group: ProxyGroup
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: group.name,
    type: group.type,
    proxies: group.members,
  };

  for (const [key, value] of Object.entries(group.settings)) {
    result[key] = coerceValue(value);
  }

  return result;
}

function buildClashRule(rule: Rule): string {
  // Surge's FINAL maps to Clash's MATCH
  if (rule.type === 'FINAL') {
    return `MATCH,${rule.target}`;
  }
  if (rule.value === undefined || rule.value === null) {
    return `${rule.type},${rule.target}`;
  }
  return `${rule.type},${rule.value},${rule.target}`;
}

/**
 * Coerce string representations of booleans and numbers to their native types
 * so the YAML output is clean (true instead of "true", 300 instead of "300").
 */
function coerceValue(value: string | number | boolean): string | number | boolean {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  return value;
}

export function generateClash(config: SubscriptionConfig): string {
  const doc: Record<string, unknown> = {};

  // Map general settings to Clash top-level keys
  for (const [key, value] of Object.entries(config.general)) {
    const clashKey = GENERAL_KEY_MAP[key] || key;
    if (CLASH_GENERAL_KEYS.has(clashKey)) {
      doc[clashKey] = coerceValue(value);
    }
  }

  // Proxies
  const proxies = config.servers
    .map(buildClashProxy)
    .filter((p): p is Record<string, unknown> => p !== null);

  if (proxies.length > 0) {
    doc['proxies'] = proxies;
  }

  // Proxy Groups
  if (config.proxyGroups.length > 0) {
    doc['proxy-groups'] = config.proxyGroups.map(buildClashProxyGroup);
  }

  // Rules
  if (config.rules.length > 0) {
    doc['rules'] = config.rules.map(buildClashRule);
  }

  // Hosts
  if (config.hosts.length > 0) {
    const hosts: Record<string, string> = {};
    for (const entry of config.hosts) {
      hosts[entry.domain] = entry.ip;
    }
    doc['hosts'] = hosts;
  }

  return yaml.dump(doc, {
    lineWidth: -1,       // Disable line wrapping
    noRefs: true,        // Disable YAML anchors/aliases
    sortKeys: false,     // Preserve insertion order
    quotingType: '"',    // Use double quotes where needed
  });
}
