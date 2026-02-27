import yaml from 'js-yaml';
import type {
  SubscriptionConfig,
  ProxyServer,
  ProxyGroup,
  Rule,
  HostEntry,
} from '../types';

interface ClashProxy {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: unknown;
}

interface ClashProxyGroup {
  name: string;
  type: string;
  proxies?: string[];
  url?: string;
  interval?: number;
  timeout?: number;
  tolerance?: number;
  [key: string]: unknown;
}

interface ClashConfig {
  port?: number;
  'socks-port'?: number;
  'allow-lan'?: boolean;
  mode?: string;
  'log-level'?: string;
  proxies?: ClashProxy[];
  'proxy-groups'?: ClashProxyGroup[];
  rules?: string[];
  hosts?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Normalize a Clash proxy type string to our union type.
 */
function normalizeProxyType(
  raw: string
): 'ss' | 'vmess' | 'trojan' | 'direct' | 'reject' {
  switch (raw.toLowerCase()) {
    case 'ss':
    case 'shadowsocks':
      return 'ss';
    case 'vmess':
      return 'vmess';
    case 'trojan':
      return 'trojan';
    default:
      return 'ss';
  }
}

/**
 * Normalize a Clash proxy group type string.
 */
function normalizeGroupType(
  raw: string
): 'select' | 'url-test' | 'fallback' | 'load-balance' {
  switch (raw.toLowerCase()) {
    case 'select':
      return 'select';
    case 'url-test':
      return 'url-test';
    case 'fallback':
      return 'fallback';
    case 'load-balance':
      return 'load-balance';
    default:
      return 'select';
  }
}

/**
 * Convert a Clash proxy entry to our ProxyServer.
 * All properties except name, type, server, port go into settings.
 */
function convertProxy(clashProxy: ClashProxy): ProxyServer {
  const { name, type, server, port, ...rest } = clashProxy;
  const settings: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      settings[key] = value;
    } else if (value !== null && value !== undefined) {
      // Stringify complex values (e.g. ws-opts object)
      settings[key] = JSON.stringify(value);
    }
  }

  return {
    name,
    type: normalizeProxyType(type),
    server,
    port,
    settings,
  };
}

/**
 * Convert a Clash proxy group entry to our ProxyGroup.
 */
function convertProxyGroup(clashGroup: ClashProxyGroup): ProxyGroup {
  const { name, type, proxies, ...rest } = clashGroup;
  const settings: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      settings[key] = value;
    }
  }

  return {
    name,
    type: normalizeGroupType(type),
    members: proxies ?? [],
    settings,
  };
}

/**
 * Parse a Clash rule string into a Rule.
 *
 * Formats:
 *   - `TYPE,value,target`
 *   - `MATCH,target` (Clash equivalent of FINAL)
 *   - `GEOIP,CN,DIRECT,no-resolve`
 */
function parseRule(ruleStr: string): Rule | null {
  const parts = ruleStr.split(',').map((s) => s.trim());
  if (parts.length < 2) return null;

  const ruleType = parts[0].toUpperCase();

  // MATCH is Clash's equivalent of FINAL
  if (ruleType === 'MATCH') {
    return {
      type: 'FINAL',
      target: parts[1],
    };
  }

  if (parts.length >= 3) {
    const rule: Rule = {
      type: ruleType,
      value: parts[1],
      target: parts[2],
    };

    // Handle extra options like "no-resolve" as a comment/note
    if (parts.length > 3) {
      rule.comment = parts.slice(3).join(',');
    }

    return rule;
  }

  // Two-part rule: TYPE,target
  return {
    type: ruleType,
    target: parts[1],
  };
}

/**
 * Extract general settings from top-level Clash config keys.
 */
function extractGeneral(config: ClashConfig): Record<string, string> {
  const general: Record<string, string> = {};

  const generalKeys = [
    'port',
    'socks-port',
    'redir-port',
    'tproxy-port',
    'mixed-port',
    'allow-lan',
    'bind-address',
    'mode',
    'log-level',
    'ipv6',
    'external-controller',
    'external-ui',
    'interface-name',
    'dns',
  ];

  for (const key of generalKeys) {
    if (key in config) {
      const value = config[key];
      if (typeof value === 'object' && value !== null) {
        general[key] = JSON.stringify(value);
      } else if (value !== undefined && value !== null) {
        general[key] = String(value);
      }
    }
  }

  return general;
}

/**
 * Parse a complete Clash (YAML) configuration into a SubscriptionConfig.
 */
export function parseClash(content: string): SubscriptionConfig {
  const config = yaml.load(content.trim()) as ClashConfig;

  if (!config || typeof config !== 'object') {
    return {
      general: {},
      servers: [],
      proxyGroups: [],
      rules: [],
      hosts: [],
    };
  }

  const general = extractGeneral(config);

  const servers: ProxyServer[] = (config.proxies ?? []).map(convertProxy);

  const proxyGroups: ProxyGroup[] = (config['proxy-groups'] ?? []).map(
    convertProxyGroup
  );

  const rules: Rule[] = (config.rules ?? [])
    .map(parseRule)
    .filter((r): r is Rule => r !== null);

  const hosts: HostEntry[] = [];
  if (config.hosts && typeof config.hosts === 'object') {
    for (const [domain, ip] of Object.entries(config.hosts)) {
      if (typeof ip === 'string') {
        hosts.push({ domain, ip });
      }
    }
  }

  return { general, servers, proxyGroups, rules, hosts };
}
