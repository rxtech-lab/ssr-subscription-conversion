import type { SubscriptionConfig, ProxyServer } from '../types';

/**
 * Try to base64-decode a string. Returns null if decoding fails
 * or produces non-UTF8 output.
 */
function tryBase64Decode(input: string): string | null {
  try {
    const decoded = Buffer.from(input, 'base64').toString('utf-8');
    // Verify it decoded to something reasonable (not garbage)
    if (decoded.length > 0 && !decoded.includes('\ufffd')) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a vmess:// link.
 *
 * Format: vmess:// + base64({
 *   "v": "2",
 *   "ps": "name",
 *   "add": "server",
 *   "port": "443",
 *   "id": "uuid",
 *   "aid": "0",
 *   "net": "ws",
 *   "type": "none",
 *   "host": "",
 *   "path": "",
 *   "tls": "tls"
 * })
 */
function parseVmessLink(link: string): ProxyServer | null {
  const encoded = link.substring('vmess://'.length).trim();
  const decoded = tryBase64Decode(encoded);
  if (!decoded) return null;

  try {
    const config = JSON.parse(decoded);

    const name = config.ps || config.remarks || 'Unnamed VMess';
    const server = config.add || config.addr || '';
    const port = Number(config.port) || 0;

    const settings: Record<string, string | number | boolean> = {};

    if (config.id) settings['uuid'] = config.id;
    if (config.aid !== undefined) settings['alterId'] = Number(config.aid) || 0;
    if (config.net) settings['network'] = config.net;
    if (config.type && config.type !== 'none') settings['type'] = config.type;
    if (config.host) settings['host'] = config.host;
    if (config.path) settings['path'] = config.path;
    if (config.tls) settings['tls'] = config.tls === 'tls';
    if (config.scy) settings['cipher'] = config.scy;
    if (config.sni) settings['sni'] = config.sni;

    return { name, type: 'vmess', server, port, settings };
  } catch {
    return null;
  }
}

/**
 * Parse an ss:// link.
 *
 * Format variants:
 *   1. ss://base64(method:password)@server:port#name
 *   2. ss://base64(method:password@server:port)#name
 *   3. ss://base64(method:password@server:port#name)
 *
 * Some also include plugin info after the port with /?plugin=...
 */
function parseSsLink(link: string): ProxyServer | null {
  const afterScheme = link.substring('ss://'.length).trim();

  // Extract fragment (name) from the end
  let mainPart = afterScheme;
  let name = '';

  const hashIdx = mainPart.lastIndexOf('#');
  if (hashIdx >= 0) {
    name = decodeURIComponent(mainPart.substring(hashIdx + 1));
    mainPart = mainPart.substring(0, hashIdx);
  }

  // Extract query parameters (plugin info etc.)
  let queryParams: Record<string, string> = {};
  const queryIdx = mainPart.indexOf('?');
  if (queryIdx >= 0) {
    const queryStr = mainPart.substring(queryIdx + 1);
    mainPart = mainPart.substring(0, queryIdx);
    queryParams = parseQueryString(queryStr);
  }

  let method = '';
  let password = '';
  let server = '';
  let port = 0;

  // Format 1: base64(method:password)@server:port
  const atIdx = mainPart.lastIndexOf('@');
  if (atIdx >= 0) {
    const userInfoPart = mainPart.substring(0, atIdx);
    const serverPart = mainPart.substring(atIdx + 1);

    // Try to decode the userinfo part
    const decodedUserInfo = tryBase64Decode(userInfoPart);
    const userInfo = decodedUserInfo ?? userInfoPart;

    const colonIdx = userInfo.indexOf(':');
    if (colonIdx >= 0) {
      method = userInfo.substring(0, colonIdx);
      password = userInfo.substring(colonIdx + 1);
    }

    // Parse server:port
    const serverColonIdx = serverPart.lastIndexOf(':');
    if (serverColonIdx >= 0) {
      server = serverPart.substring(0, serverColonIdx);
      port = Number(serverPart.substring(serverColonIdx + 1)) || 0;
    } else {
      server = serverPart;
    }
  } else {
    // Format 2: entire part is base64-encoded
    const decoded = tryBase64Decode(mainPart);
    if (decoded) {
      // decoded might be: method:password@server:port
      const decodedAtIdx = decoded.lastIndexOf('@');
      if (decodedAtIdx >= 0) {
        const userInfo = decoded.substring(0, decodedAtIdx);
        const serverPart = decoded.substring(decodedAtIdx + 1);

        const colonIdx = userInfo.indexOf(':');
        if (colonIdx >= 0) {
          method = userInfo.substring(0, colonIdx);
          password = userInfo.substring(colonIdx + 1);
        }

        const serverColonIdx = serverPart.lastIndexOf(':');
        if (serverColonIdx >= 0) {
          server = serverPart.substring(0, serverColonIdx);
          port = Number(serverPart.substring(serverColonIdx + 1)) || 0;
        } else {
          server = serverPart;
        }

        // Check if name was inside the base64
        if (!name) {
          const innerHash = serverPart.indexOf('#');
          if (innerHash >= 0) {
            name = decodeURIComponent(serverPart.substring(innerHash + 1));
            const cleanServerPart = serverPart.substring(0, innerHash);
            const sColonIdx = cleanServerPart.lastIndexOf(':');
            if (sColonIdx >= 0) {
              server = cleanServerPart.substring(0, sColonIdx);
              port = Number(cleanServerPart.substring(sColonIdx + 1)) || 0;
            }
          }
        }
      }
    }
  }

  if (!server) return null;

  if (!name) {
    name = `SS ${server}:${port}`;
  }

  const settings: Record<string, string | number | boolean> = {};
  if (method) settings['encrypt-method'] = method;
  if (password) settings['password'] = password;

  // Add plugin info from query params
  if (queryParams['plugin']) {
    const pluginInfo = decodeURIComponent(queryParams['plugin']);
    // Plugin string format: plugin-name;key=val;key=val
    const pluginParts = pluginInfo.split(';');
    if (pluginParts.length > 0) {
      settings['obfs'] = pluginParts[0];
      for (let i = 1; i < pluginParts.length; i++) {
        const eqIdx = pluginParts[i].indexOf('=');
        if (eqIdx > 0) {
          const key = pluginParts[i].substring(0, eqIdx);
          const val = pluginParts[i].substring(eqIdx + 1);
          settings[key] = val;
        }
      }
    }
  }

  return { name, type: 'ss', server, port, settings };
}

/**
 * Parse a trojan:// link.
 *
 * Format: trojan://password@server:port?sni=xxx&type=tcp&security=tls#name
 */
function parseTrojanLink(link: string): ProxyServer | null {
  const afterScheme = link.substring('trojan://'.length).trim();

  // Extract fragment (name)
  let mainPart = afterScheme;
  let name = '';

  const hashIdx = mainPart.lastIndexOf('#');
  if (hashIdx >= 0) {
    name = decodeURIComponent(mainPart.substring(hashIdx + 1));
    mainPart = mainPart.substring(0, hashIdx);
  }

  // Extract query parameters
  let queryParams: Record<string, string> = {};
  const queryIdx = mainPart.indexOf('?');
  if (queryIdx >= 0) {
    const queryStr = mainPart.substring(queryIdx + 1);
    mainPart = mainPart.substring(0, queryIdx);
    queryParams = parseQueryString(queryStr);
  }

  // Parse password@server:port
  const atIdx = mainPart.lastIndexOf('@');
  if (atIdx < 0) return null;

  const password = mainPart.substring(0, atIdx);
  const serverPart = mainPart.substring(atIdx + 1);

  let server = '';
  let port = 0;

  const colonIdx = serverPart.lastIndexOf(':');
  if (colonIdx >= 0) {
    server = serverPart.substring(0, colonIdx);
    port = Number(serverPart.substring(colonIdx + 1)) || 0;
  } else {
    server = serverPart;
  }

  if (!server) return null;

  if (!name) {
    name = `Trojan ${server}:${port}`;
  }

  const settings: Record<string, string | number | boolean> = {};
  settings['password'] = password;

  if (queryParams['sni']) settings['sni'] = queryParams['sni'];
  if (queryParams['type']) settings['network'] = queryParams['type'];
  if (queryParams['security']) settings['security'] = queryParams['security'];
  if (queryParams['path']) settings['path'] = queryParams['path'];
  if (queryParams['host']) settings['host'] = queryParams['host'];
  if (queryParams['alpn']) settings['alpn'] = queryParams['alpn'];
  if (queryParams['allowInsecure'])
    settings['skip-cert-verify'] = queryParams['allowInsecure'] === '1';
  if (queryParams['fp']) settings['fingerprint'] = queryParams['fp'];

  return { name, type: 'trojan', server, port, settings };
}

/**
 * Parse a simple query string into key-value pairs.
 */
function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = qs.split('&');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = decodeURIComponent(pair.substring(0, eqIdx));
      const val = decodeURIComponent(pair.substring(eqIdx + 1));
      result[key] = val;
    }
  }
  return result;
}

/**
 * Parse a single proxy link (vmess://, ss://, trojan://).
 */
function parseProxyLink(link: string): ProxyServer | null {
  const trimmed = link.trim();
  if (trimmed.startsWith('vmess://')) return parseVmessLink(trimmed);
  if (trimmed.startsWith('ss://')) return parseSsLink(trimmed);
  if (trimmed.startsWith('trojan://')) return parseTrojanLink(trimmed);
  return null;
}

/**
 * Parse V2Ray subscription content into a SubscriptionConfig.
 *
 * V2Ray subscriptions are typically base64-encoded lists of proxy links,
 * one per line. They can also be plain-text lists of links.
 *
 * V2Ray subscriptions only contain server definitions -- no groups, rules,
 * hosts, or general settings.
 */
export function parseV2ray(content: string): SubscriptionConfig {
  const trimmed = content.trim();

  // Try to base64-decode the entire content first
  let lines: string[];
  const decoded = tryBase64Decode(trimmed);
  if (decoded && /^(vmess|ss|trojan):\/\//m.test(decoded)) {
    lines = decoded.split('\n');
  } else {
    // Treat as plain text (one link per line)
    lines = trimmed.split('\n');
  }

  const servers: ProxyServer[] = [];

  for (const line of lines) {
    const cleaned = line.trim();
    if (!cleaned) continue;

    const server = parseProxyLink(cleaned);
    if (server) {
      servers.push(server);
    }
  }

  return {
    general: {},
    servers,
    proxyGroups: [],
    rules: [],
    hosts: [],
  };
}
