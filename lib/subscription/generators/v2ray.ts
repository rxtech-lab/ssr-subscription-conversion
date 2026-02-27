import type { SubscriptionConfig, ProxyServer } from '../types';

function toBase64(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64');
}

function buildSSUri(server: ProxyServer): string {
  const method = server.settings['encrypt-method'] ?? server.settings['cipher'] ?? 'aes-256-gcm';
  const password = server.settings['password'] ?? '';
  const userInfo = toBase64(`${method}:${password}`);
  const fragment = encodeURIComponent(server.name);
  return `ss://${userInfo}@${server.server}:${server.port}#${fragment}`;
}

function buildVMessUri(server: ProxyServer): string {
  const vmessConfig = {
    v: '2',
    ps: server.name,
    add: server.server,
    port: server.port,
    id: server.settings['uuid'] ?? '',
    aid: String(server.settings['alterId'] ?? '0'),
    net: String(server.settings['network'] ?? 'tcp'),
    type: 'none',
    host: String(server.settings['host'] ?? ''),
    path: String(server.settings['path'] ?? ''),
    tls: String(server.settings['tls'] ?? ''),
  };
  return `vmess://${toBase64(JSON.stringify(vmessConfig))}`;
}

function buildTrojanUri(server: ProxyServer): string {
  const password = server.settings['password'] ?? '';
  const sni = server.settings['sni'] ?? '';
  const fragment = encodeURIComponent(server.name);

  let uri = `trojan://${password}@${server.server}:${server.port}`;

  const params: string[] = [];
  if (sni) {
    params.push(`sni=${encodeURIComponent(String(sni))}`);
  }

  // Include other relevant query parameters
  for (const [key, value] of Object.entries(server.settings)) {
    if (key === 'password' || key === 'sni') continue;
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  if (params.length > 0) {
    uri += `?${params.join('&')}`;
  }

  uri += `#${fragment}`;
  return uri;
}

function buildProxyUri(server: ProxyServer): string | null {
  switch (server.type) {
    case 'ss':
      return buildSSUri(server);
    case 'vmess':
      return buildVMessUri(server);
    case 'trojan':
      return buildTrojanUri(server);
    case 'direct':
    case 'reject':
      return null;
    default:
      return null;
  }
}

export function generateV2ray(config: SubscriptionConfig): string {
  const links = config.servers
    .map(buildProxyUri)
    .filter((link): link is string => link !== null);

  const combined = links.join('\n');
  return toBase64(combined);
}
