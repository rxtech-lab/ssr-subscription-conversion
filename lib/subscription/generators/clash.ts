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

/**
 * Copy settings onto a VMess/Trojan Clash proxy, translating Surge-style keys
 * (ws, ws-path, ws-headers, sni, udp-relay) into their Clash equivalents.
 */
function applySurgeTransportSettings(
  base: Record<string, unknown>,
  settings: ProxyServer['settings'],
  sniKey: 'servername' | 'sni'
): void {
  const wsOpts: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(settings)) {
    switch (key) {
      case 'ws':
        if (coerceValue(value) === true) base['network'] = 'ws';
        break;
      case 'ws-path':
        wsOpts['path'] = String(value);
        break;
      case 'ws-headers': {
        // Surge format: "Host:example.com|User-Agent:foo"
        const headers: Record<string, string> = {};
        for (const pair of String(value).split('|')) {
          const idx = pair.indexOf(':');
          if (idx > 0) headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
        }
        if (Object.keys(headers).length > 0) wsOpts['headers'] = headers;
        break;
      }
      case 'sni':
        base[sniKey] = String(value);
        break;
      case 'udp-relay':
        base['udp'] = coerceValue(value);
        break;
      default:
        base[key] = coerceValue(value);
    }
  }

  if (Object.keys(wsOpts).length > 0) {
    base['network'] = 'ws';
    base['ws-opts'] = { ...(base['ws-opts'] as Record<string, unknown> | undefined), ...wsOpts };
  }
}

function buildClashProxy(server: ProxyServer): Record<string, unknown> | null {
  if (server.type === 'direct' || server.type === 'reject') {
    return null;
  }

  const base: Record<string, unknown> = {
    name: unquote(server.name),
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
      if (base['password'] !== undefined) base['password'] = String(base['password']);
      break;
    }

    case 'vmess': {
      applySurgeTransportSettings(base, server.settings, 'servername');
      // Surge stores the VMess UUID as `username`
      if (base['uuid'] === undefined && base['username'] !== undefined) {
        base['uuid'] = String(base['username']);
      }
      delete base['username'];
      if (base['uuid'] !== undefined) base['uuid'] = String(base['uuid']);
      // Surge's vmess-aead=true means alterId 0; Clash requires both fields
      delete base['vmess-aead'];
      if (base['alterId'] === undefined) base['alterId'] = 0;
      if (base['cipher'] === undefined) base['cipher'] = 'auto';
      break;
    }

    case 'trojan': {
      applySurgeTransportSettings(base, server.settings, 'sni');
      if (base['password'] !== undefined) base['password'] = String(base['password']);
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

/**
 * Clash has no named direct/reject proxies (they are dropped from `proxies`),
 * so references to them must point at the built-in DIRECT/REJECT policies.
 */
/** Strip surrounding quotes that Surge allows around names and values. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const match = /^(["'])(.*)\1$/.exec(trimmed);
  return match ? match[2] : trimmed;
}

function buildPolicyResolver(servers: ProxyServer[]): (name: string) => string {
  const builtins = new Map<string, string>();
  for (const server of servers) {
    if (server.type === 'direct') builtins.set(unquote(server.name), 'DIRECT');
    if (server.type === 'reject') builtins.set(unquote(server.name), 'REJECT');
  }
  return (rawName) => {
    const name = unquote(rawName);
    const upper = name.toUpperCase();
    if (upper === 'DIRECT') return 'DIRECT';
    if (upper === 'REJECT' || upper.startsWith('REJECT-')) return 'REJECT';
    return builtins.get(name) ?? name;
  };
}

function buildClashProxyGroup(
  group: ProxyGroup,
  resolve: (name: string) => string
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: unquote(group.name),
    type: group.type,
    proxies: [...new Set(group.members.map(resolve))],
  };

  for (const [key, value] of Object.entries(group.settings)) {
    result[key] = coerceValue(value);
  }

  return result;
}

function buildClashRule(rule: Rule, resolve: (name: string) => string): string {
  const target = resolve(rule.target);
  // Surge's FINAL maps to Clash's MATCH
  if (rule.type === 'FINAL') {
    return `MATCH,${target}`;
  }
  if (rule.value === undefined || rule.value === null) {
    return `${rule.type},${target}`;
  }
  return `${rule.type},${unquote(String(rule.value))},${target}`;
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

  const resolvePolicy = buildPolicyResolver(config.servers);

  // Proxies
  const proxies = config.servers
    .map(buildClashProxy)
    .filter((p): p is Record<string, unknown> => p !== null);

  if (proxies.length > 0) {
    doc['proxies'] = proxies;
  }

  // Proxy Groups
  if (config.proxyGroups.length > 0) {
    doc['proxy-groups'] = config.proxyGroups.map((g) => buildClashProxyGroup(g, resolvePolicy));
  }

  // Rules
  if (config.rules.length > 0) {
    doc['rules'] = config.rules.map((r) => buildClashRule(r, resolvePolicy));
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
