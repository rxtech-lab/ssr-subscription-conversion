export interface ProxyServer {
  name: string;
  type: 'ss' | 'vmess' | 'trojan' | 'direct' | 'reject';
  server?: string;
  port?: number;
  settings: Record<string, string | number | boolean>;
  // For SS: encrypt-method, password, udp-relay, obfs, obfs-host, etc.
  // For VMess: uuid, alterId, cipher, tls, etc.
  // For Trojan: password, sni, skip-cert-verify, etc.
}

export interface ProxyGroup {
  name: string;
  type: 'select' | 'url-test' | 'fallback' | 'load-balance';
  members: string[]; // proxy/group names
  settings: Record<string, string | number | boolean>;
  // url, interval, timeout, tolerance, etc.
}

export interface Rule {
  type: string; // DOMAIN-SUFFIX, DOMAIN, DOMAIN-KEYWORD, IP-CIDR, GEOIP, FINAL, USER-AGENT, URL-REGEX, etc.
  value?: string; // the match value (not present for FINAL)
  target: string; // proxy group name
  comment?: string;
}

export interface HostEntry {
  domain: string;
  ip: string;
}

export interface SubscriptionConfig {
  general: Record<string, string>;
  servers: ProxyServer[];
  proxyGroups: ProxyGroup[];
  rules: Rule[];
  hosts: HostEntry[];
}

export type SubscriptionFormat = 'surge' | 'clash' | 'v2ray' | 'unknown';

export interface ServerWithId extends ProxyServer {
  id: string;
}

export interface ProxyGroupWithId extends ProxyGroup {
  id: string;
}

export interface SubscriptionConfigWithIds {
  general: Record<string, string>;
  servers: ServerWithId[];
  proxyGroups: ProxyGroupWithId[];
  rules: Rule[];
  hosts: HostEntry[];
}
