import { describe, it, expect } from 'vitest';
import { parseClash } from '@/lib/subscription/parsers/clash';

const CLASH_CONFIG = `port: 7890
socks-port: 7891
allow-lan: false
mode: Rule
log-level: info

proxies:
  - name: "🇭🇰 HK"
    type: ss
    server: hk.example.com
    port: 443
    cipher: aes-128-gcm
    password: "test123"
    udp: true
  - name: "🇺🇸 US"
    type: ss
    server: us.example.com
    port: 443
    cipher: chacha20-ietf-poly1305
    password: "abc456"

proxy-groups:
  - name: "♻️ Auto"
    type: url-test
    proxies:
      - "🇭🇰 HK"
      - "🇺🇸 US"
    url: http://www.gstatic.com/generate_204
    interval: 300
  - name: "🔰 Proxy"
    type: select
    proxies:
      - "♻️ Auto"
      - "🇭🇰 HK"
      - "🇺🇸 US"
      - DIRECT

rules:
  - DOMAIN-SUFFIX,google.com,🔰 Proxy
  - DOMAIN-SUFFIX,apple.com,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🔰 Proxy`;

describe('parseClash', () => {
  const config = parseClash(CLASH_CONFIG);

  describe('general settings', () => {
    it('should extract port', () => {
      expect(config.general['port']).toBe('7890');
    });

    it('should extract socks-port', () => {
      expect(config.general['socks-port']).toBe('7891');
    });

    it('should extract allow-lan', () => {
      expect(config.general['allow-lan']).toBe('false');
    });

    it('should extract mode', () => {
      expect(config.general['mode']).toBe('Rule');
    });

    it('should extract log-level', () => {
      expect(config.general['log-level']).toBe('info');
    });
  });

  describe('proxies', () => {
    it('should parse 2 proxies', () => {
      expect(config.servers).toHaveLength(2);
    });

    it('should parse HK SS proxy correctly', () => {
      const hk = config.servers.find((s) => s.name === '🇭🇰 HK');
      expect(hk).toBeDefined();
      expect(hk!.type).toBe('ss');
      expect(hk!.server).toBe('hk.example.com');
      expect(hk!.port).toBe(443);
    });

    it('should parse HK proxy settings', () => {
      const hk = config.servers.find((s) => s.name === '🇭🇰 HK');
      expect(hk!.settings['cipher']).toBe('aes-128-gcm');
      expect(hk!.settings['password']).toBe('test123');
      expect(hk!.settings['udp']).toBe(true);
    });

    it('should parse US SS proxy correctly', () => {
      const us = config.servers.find((s) => s.name === '🇺🇸 US');
      expect(us).toBeDefined();
      expect(us!.type).toBe('ss');
      expect(us!.server).toBe('us.example.com');
      expect(us!.port).toBe(443);
      expect(us!.settings['cipher']).toBe('chacha20-ietf-poly1305');
      expect(us!.settings['password']).toBe('abc456');
    });
  });

  describe('proxy groups', () => {
    it('should parse 2 proxy groups', () => {
      expect(config.proxyGroups).toHaveLength(2);
    });

    it('should parse Auto group as url-test with correct members', () => {
      const auto = config.proxyGroups.find((g) => g.name === '♻️ Auto');
      expect(auto).toBeDefined();
      expect(auto!.type).toBe('url-test');
      expect(auto!.members).toEqual(['🇭🇰 HK', '🇺🇸 US']);
    });

    it('should parse Auto group settings (url, interval)', () => {
      const auto = config.proxyGroups.find((g) => g.name === '♻️ Auto');
      expect(auto!.settings['url']).toBe('http://www.gstatic.com/generate_204');
      expect(auto!.settings['interval']).toBe(300);
    });

    it('should parse Proxy group as select with correct members', () => {
      const proxy = config.proxyGroups.find((g) => g.name === '🔰 Proxy');
      expect(proxy).toBeDefined();
      expect(proxy!.type).toBe('select');
      expect(proxy!.members).toEqual(['♻️ Auto', '🇭🇰 HK', '🇺🇸 US', 'DIRECT']);
    });
  });

  describe('rules', () => {
    it('should parse 4 rules', () => {
      expect(config.rules).toHaveLength(4);
    });

    it('should parse DOMAIN-SUFFIX rules', () => {
      expect(config.rules[0].type).toBe('DOMAIN-SUFFIX');
      expect(config.rules[0].value).toBe('google.com');
      expect(config.rules[0].target).toBe('🔰 Proxy');

      expect(config.rules[1].type).toBe('DOMAIN-SUFFIX');
      expect(config.rules[1].value).toBe('apple.com');
      expect(config.rules[1].target).toBe('DIRECT');
    });

    it('should parse GEOIP rule', () => {
      expect(config.rules[2].type).toBe('GEOIP');
      expect(config.rules[2].value).toBe('CN');
      expect(config.rules[2].target).toBe('DIRECT');
    });

    it('should convert MATCH to FINAL', () => {
      const finalRule = config.rules[3];
      expect(finalRule.type).toBe('FINAL');
      expect(finalRule.value).toBeUndefined();
      expect(finalRule.target).toBe('🔰 Proxy');
    });
  });

  describe('hosts', () => {
    it('should have no hosts (not in this config)', () => {
      expect(config.hosts).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty YAML', () => {
      const result = parseClash('');
      expect(result.servers).toEqual([]);
      expect(result.proxyGroups).toEqual([]);
      expect(result.rules).toEqual([]);
    });

    it('should handle YAML without proxies key', () => {
      const result = parseClash('port: 7890\nmode: Rule');
      expect(result.servers).toEqual([]);
    });

    it('should handle Clash config with hosts', () => {
      const configWithHosts = `proxies: []
hosts:
  mtalk.google.com: "108.177.125.188"
  dl.google.com: "203.208.50.55"`;

      const result = parseClash(configWithHosts);
      expect(result.hosts).toHaveLength(2);
      expect(result.hosts[0].domain).toBe('mtalk.google.com');
      expect(result.hosts[0].ip).toBe('108.177.125.188');
      expect(result.hosts[1].domain).toBe('dl.google.com');
      expect(result.hosts[1].ip).toBe('203.208.50.55');
    });

    it('should handle VMess proxy type', () => {
      const vmessConfig = `proxies:
  - name: "VMess Server"
    type: vmess
    server: vmess.example.com
    port: 443
    uuid: "test-uuid-1234"
    alterId: 0
    cipher: auto
    tls: true`;

      const result = parseClash(vmessConfig);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].type).toBe('vmess');
      expect(result.servers[0].server).toBe('vmess.example.com');
      expect(result.servers[0].settings['uuid']).toBe('test-uuid-1234');
    });

    it('should handle Trojan proxy type', () => {
      const trojanConfig = `proxies:
  - name: "Trojan Server"
    type: trojan
    server: trojan.example.com
    port: 443
    password: "trojan-pass"
    sni: trojan.example.com`;

      const result = parseClash(trojanConfig);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].type).toBe('trojan');
      expect(result.servers[0].settings['password']).toBe('trojan-pass');
      expect(result.servers[0].settings['sni']).toBe('trojan.example.com');
    });
  });
});
