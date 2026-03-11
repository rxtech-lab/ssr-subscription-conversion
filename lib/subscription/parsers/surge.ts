import type {
  SubscriptionConfig,
  ProxyServer,
  ProxyGroup,
  Rule,
  HostEntry,
} from '../types';

/**
 * Split Surge INI-like content into sections.
 * Returns a map of section name -> array of lines in that section.
 * Lines before any section header are stored under key "".
 */
function splitSections(content: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentSection = '';
  sections.set(currentSection, []);

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Match section headers like [Proxy], [Proxy Group], [Rule], [General], [Host]
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    // Skip empty lines and full-line comments
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    sections.get(currentSection)!.push(line);
  }

  return sections;
}

/**
 * Parse key=value pairs from a list of tokens.
 * Tokens like "key=value" are parsed into the record.
 * Returns the record and the list of tokens that are NOT key=value pairs.
 */
function extractKeyValueParams(
  tokens: string[]
): [Record<string, string | number | boolean>, string[]] {
  const settings: Record<string, string | number | boolean> = {};
  const nonKV: string[] = [];

  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx > 0) {
      const key = token.substring(0, eqIdx).trim();
      const rawVal = token.substring(eqIdx + 1).trim();
      settings[key] = coerceValue(rawVal);
    } else {
      nonKV.push(token);
    }
  }

  return [settings, nonKV];
}

/**
 * Coerce a string value to number or boolean if appropriate.
 */
function coerceValue(val: string): string | number | boolean {
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  if (!isNaN(num) && val !== '') return num;
  return val;
}

/**
 * Tokenize a Surge proxy/group line value, respecting quoted strings.
 * E.g. `select, "♻️ Name", Proxy1, url=http://test` ->
 *   ['select', '♻️ Name', 'Proxy1', 'url=http://test']
 */
function tokenize(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];

    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
        // Don't include the closing quote
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      // Don't include the opening quote
    } else if (ch === ',') {
      const trimmed = current.trim();
      if (trimmed !== '') {
        tokens.push(trimmed);
      }
      current = '';
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed !== '') {
    tokens.push(trimmed);
  }

  return tokens;
}

/**
 * Parse [General] section: simple key = value pairs.
 */
function parseGeneral(lines: string[]): Record<string, string> {
  const general: Record<string, string> = {};

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      general[key] = value;
    }
  }

  return general;
}

/**
 * Parse [Proxy] section.
 *
 * Format: `Name = type, server, port, key1=val1, key2=val2, ...`
 * Special cases:
 *   - `DIRECT = direct`
 *   - `REJECT = reject`
 *   - `Name = ss, server, port, encrypt-method=aes-128-gcm, password=xxx, ...`
 *   - `Name = vmess, server, port, username=uuid, ...`
 *   - `Name = trojan, server, port, password=xxx, ...`
 *   - `Name = custom, server, port, ..., module=url`
 */
function parseProxies(lines: string[]): ProxyServer[] {
  const servers: ProxyServer[] = [];

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const name = line.substring(0, eqIdx).trim();
    const valueStr = line.substring(eqIdx + 1).trim();
    const tokens = tokenize(valueStr);

    if (tokens.length === 0) continue;

    const rawType = tokens[0].toLowerCase();
    const restTokens = tokens.slice(1);

    // direct / reject: no server or port
    if (rawType === 'direct' || rawType === 'reject') {
      servers.push({
        name,
        type: rawType as 'direct' | 'reject',
        settings: {},
      });
      continue;
    }

    // For proxy types with server and port
    const type = normalizeProxyType(rawType);

    // Extract server and port from positional args
    // After the type token, we expect: server, port, then key=value pairs
    // But some tokens after server,port may also be positional before key=value starts
    const [kvSettings, positional] = extractKeyValueParams(restTokens);

    let server: string | undefined;
    let port: number | undefined;

    if (positional.length >= 2) {
      server = positional[0];
      port = Number(positional[1]);
      if (isNaN(port)) port = undefined;
    } else if (positional.length === 1) {
      server = positional[0];
    }

    servers.push({
      name,
      type,
      server,
      port,
      settings: kvSettings,
    });
  }

  return servers;
}

/**
 * Normalize proxy type string to our union type.
 */
function normalizeProxyType(
  raw: string
): 'ss' | 'vmess' | 'trojan' | 'direct' | 'reject' {
  switch (raw) {
    case 'ss':
    case 'shadowsocks':
      return 'ss';
    case 'vmess':
      return 'vmess';
    case 'trojan':
      return 'trojan';
    case 'direct':
      return 'direct';
    case 'reject':
    case 'reject-tinygif':
      return 'reject';
    case 'custom':
      // Custom is typically SS with a module; treat as SS
      return 'ss';
    default:
      // Fallback: treat unknown as ss
      return 'ss';
  }
}

/**
 * Parse [Proxy Group] section.
 *
 * Format: `Name = type, member1, member2, ..., key=val, key=val`
 * Members can be quoted: `"♻️ 自动选择"`
 * key=value params (url=, interval=, timeout=, tolerance=) come at the end.
 */
function parseProxyGroups(lines: string[]): ProxyGroup[] {
  const groups: ProxyGroup[] = [];

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const name = line.substring(0, eqIdx).trim();
    const valueStr = line.substring(eqIdx + 1).trim();
    const tokens = tokenize(valueStr);

    if (tokens.length === 0) continue;

    const rawType = tokens[0].toLowerCase();
    const restTokens = tokens.slice(1);

    const type = normalizeGroupType(rawType);

    // Separate members from key=value settings
    const members: string[] = [];
    const settings: Record<string, string | number | boolean> = {};

    for (const token of restTokens) {
      const eqPosition = token.indexOf('=');
      if (eqPosition > 0) {
        const key = token.substring(0, eqPosition).trim();
        const rawVal = token.substring(eqPosition + 1).trim();
        settings[key] = coerceValue(rawVal);
      } else {
        // It's a member name
        members.push(token);
      }
    }

    groups.push({ name, type, members, settings });
  }

  return groups;
}

/**
 * Normalize group type string.
 */
function normalizeGroupType(
  raw: string
): 'select' | 'url-test' | 'fallback' | 'load-balance' {
  switch (raw) {
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
 * Parse [Rule] section.
 *
 * Formats:
 *   - `TYPE,value,target`
 *   - `TYPE,value,target // comment`
 *   - `FINAL,target`
 *   - `FINAL,target // comment`
 */
function parseRules(lines: string[]): Rule[] {
  const rules: Rule[] = [];

  for (const line of lines) {
    // Extract comment (after //)
    let comment: string | undefined;
    let mainPart = line;

    const commentIdx = line.indexOf(' //');
    if (commentIdx >= 0) {
      comment = line.substring(commentIdx + 3).trim();
      mainPart = line.substring(0, commentIdx).trim();
    }

    // Remove trailing comma if any
    mainPart = mainPart.replace(/,\s*$/, '');

    const parts = mainPart.split(',').map((s) => s.trim());

    if (parts.length < 2) continue;

    const ruleType = parts[0].toUpperCase();

    if (ruleType === 'FINAL') {
      // FINAL,target
      const rule: Rule = {
        type: 'FINAL',
        target: parts[1],
      };
      if (comment) rule.comment = comment;
      rules.push(rule);
    } else if (parts.length >= 3) {
      // TYPE,value,target
      const rule: Rule = {
        type: ruleType,
        value: parts[1],
        target: parts[2],
      };
      if (comment) rule.comment = comment;
      rules.push(rule);
    } else if (parts.length === 2) {
      // Could be a two-part rule like AND/OR or just TYPE,target
      const rule: Rule = {
        type: ruleType,
        target: parts[1],
      };
      if (comment) rule.comment = comment;
      rules.push(rule);
    }
  }

  return rules;
}

/**
 * Parse [Host] section.
 *
 * Format: `domain = ip`
 */
function parseHosts(lines: string[]): HostEntry[] {
  const hosts: HostEntry[] = [];

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const domain = line.substring(0, eqIdx).trim();
    const ip = line.substring(eqIdx + 1).trim();

    if (domain && ip) {
      hosts.push({ domain, ip });
    }
  }

  return hosts;
}

/**
 * Parse a complete Surge configuration file into a SubscriptionConfig.
 */
export function parseSurge(content: string): SubscriptionConfig {
  const sections = splitSections(content);

  const general = parseGeneral(sections.get('General') ?? []);
  const servers = parseProxies(sections.get('Proxy') ?? []);
  const proxyGroups = parseProxyGroups(sections.get('Proxy Group') ?? []);
  const rules = parseRules(sections.get('Rule') ?? []);
  const hosts = parseHosts(sections.get('Host') ?? []);

  return { general, servers, proxyGroups, rules, hosts };
}
