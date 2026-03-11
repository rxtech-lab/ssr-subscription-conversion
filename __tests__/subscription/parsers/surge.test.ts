import { describe, it, expect } from 'vitest';
import { parseSurge } from '@/lib/subscription/parsers/surge';

const SURGE_CONFIG = `[General]
loglevel = notify
dns-server = 8.8.8.8, 8.8.4.4

[Proxy]
🇭🇰 HK = ss, hk.example.com, 443, encrypt-method=aes-128-gcm, password=test123, udp-relay=true
🇺🇸 US = ss, us.example.com, 443, encrypt-method=chacha20-ietf-poly1305, password=abc456, obfs=tls, obfs-host=www.bing.com
DIRECT = direct
REJECT = reject

[Proxy Group]
♻️ Auto = url-test, 🇭🇰 HK, 🇺🇸 US, url=http://www.gstatic.com/generate_204, interval=300, timeout=5
🔰 Proxy = select, ♻️ Auto, 🇭🇰 HK, 🇺🇸 US, DIRECT

[Rule]
DOMAIN-SUFFIX,google.com,🔰 Proxy
DOMAIN-SUFFIX,apple.com,DIRECT
GEOIP,CN,DIRECT
FINAL,🔰 Proxy

[Host]
mtalk.google.com = 108.177.125.188`;

describe('parseSurge', () => {
  const config = parseSurge(SURGE_CONFIG);

  describe('general settings', () => {
    it('should parse loglevel', () => {
      expect(config.general['loglevel']).toBe('notify');
    });

    it('should parse dns-server', () => {
      expect(config.general['dns-server']).toBe('8.8.8.8, 8.8.4.4');
    });

    it('should have exactly 2 general settings', () => {
      expect(Object.keys(config.general)).toHaveLength(2);
    });
  });

  describe('servers', () => {
    it('should parse all 4 servers', () => {
      expect(config.servers).toHaveLength(4);
    });

    it('should parse the HK SS server correctly', () => {
      const hk = config.servers.find((s) => s.name === '🇭🇰 HK');
      expect(hk).toBeDefined();
      expect(hk!.type).toBe('ss');
      expect(hk!.server).toBe('hk.example.com');
      expect(hk!.port).toBe(443);
    });

    it('should parse SS server settings (encrypt-method, password, udp-relay)', () => {
      const hk = config.servers.find((s) => s.name === '🇭🇰 HK');
      expect(hk!.settings['encrypt-method']).toBe('aes-128-gcm');
      expect(hk!.settings['password']).toBe('test123');
      expect(hk!.settings['udp-relay']).toBe(true);
    });

    it('should parse the US SS server with obfs settings', () => {
      const us = config.servers.find((s) => s.name === '🇺🇸 US');
      expect(us).toBeDefined();
      expect(us!.type).toBe('ss');
      expect(us!.server).toBe('us.example.com');
      expect(us!.port).toBe(443);
      expect(us!.settings['encrypt-method']).toBe('chacha20-ietf-poly1305');
      expect(us!.settings['password']).toBe('abc456');
      expect(us!.settings['obfs']).toBe('tls');
      expect(us!.settings['obfs-host']).toBe('www.bing.com');
    });

    it('should parse DIRECT server', () => {
      const direct = config.servers.find((s) => s.name === 'DIRECT');
      expect(direct).toBeDefined();
      expect(direct!.type).toBe('direct');
      expect(direct!.server).toBeUndefined();
      expect(direct!.port).toBeUndefined();
      expect(direct!.settings).toEqual({});
    });

    it('should parse REJECT server', () => {
      const reject = config.servers.find((s) => s.name === 'REJECT');
      expect(reject).toBeDefined();
      expect(reject!.type).toBe('reject');
      expect(reject!.server).toBeUndefined();
      expect(reject!.port).toBeUndefined();
      expect(reject!.settings).toEqual({});
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

    it('should parse Auto group settings (url, interval, timeout)', () => {
      const auto = config.proxyGroups.find((g) => g.name === '♻️ Auto');
      expect(auto!.settings['url']).toBe('http://www.gstatic.com/generate_204');
      expect(auto!.settings['interval']).toBe(300);
      expect(auto!.settings['timeout']).toBe(5);
    });

    it('should parse Proxy group as select with correct members', () => {
      const proxy = config.proxyGroups.find((g) => g.name === '🔰 Proxy');
      expect(proxy).toBeDefined();
      expect(proxy!.type).toBe('select');
      expect(proxy!.members).toEqual(['♻️ Auto', '🇭🇰 HK', '🇺🇸 US', 'DIRECT']);
    });

    it('should have no settings on the select group', () => {
      const proxy = config.proxyGroups.find((g) => g.name === '🔰 Proxy');
      expect(Object.keys(proxy!.settings)).toHaveLength(0);
    });
  });

  describe('rules', () => {
    it('should parse 4 rules', () => {
      expect(config.rules).toHaveLength(4);
    });

    it('should parse DOMAIN-SUFFIX rule for google.com', () => {
      const rule = config.rules[0];
      expect(rule.type).toBe('DOMAIN-SUFFIX');
      expect(rule.value).toBe('google.com');
      expect(rule.target).toBe('🔰 Proxy');
    });

    it('should parse DOMAIN-SUFFIX rule for apple.com', () => {
      const rule = config.rules[1];
      expect(rule.type).toBe('DOMAIN-SUFFIX');
      expect(rule.value).toBe('apple.com');
      expect(rule.target).toBe('DIRECT');
    });

    it('should parse GEOIP rule', () => {
      const rule = config.rules[2];
      expect(rule.type).toBe('GEOIP');
      expect(rule.value).toBe('CN');
      expect(rule.target).toBe('DIRECT');
    });

    it('should parse FINAL rule with no value', () => {
      const rule = config.rules[3];
      expect(rule.type).toBe('FINAL');
      expect(rule.value).toBeUndefined();
      expect(rule.target).toBe('🔰 Proxy');
    });
  });

  describe('hosts', () => {
    it('should parse 1 host entry', () => {
      expect(config.hosts).toHaveLength(1);
    });

    it('should parse host domain and ip correctly', () => {
      expect(config.hosts[0].domain).toBe('mtalk.google.com');
      expect(config.hosts[0].ip).toBe('108.177.125.188');
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', () => {
      const result = parseSurge('');
      expect(result.general).toEqual({});
      expect(result.servers).toEqual([]);
      expect(result.proxyGroups).toEqual([]);
      expect(result.rules).toEqual([]);
      expect(result.hosts).toEqual([]);
    });

    it('should handle config with comments', () => {
      const result = parseSurge(`[General]
# This is a comment
loglevel = notify

[Proxy]
; Another comment
DIRECT = direct`);

      expect(result.general['loglevel']).toBe('notify');
      expect(result.servers).toHaveLength(1);
    });

    it('should handle rules with comments', () => {
      const result = parseSurge(`[Rule]
DOMAIN-SUFFIX,google.com,Proxy // Google services`);

      expect(result.rules[0].type).toBe('DOMAIN-SUFFIX');
      expect(result.rules[0].value).toBe('google.com');
      expect(result.rules[0].target).toBe('Proxy');
      expect(result.rules[0].comment).toBe('Google services');
    });

    it('should parse DOMAIN-SET rules with URL values correctly', () => {
      const result = parseSurge(`[Rule]
DOMAIN-SET,https://example.com/domains.txt,Proxy
DOMAIN-SET,https://cdn.example.com/list.txt,DIRECT`);

      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].type).toBe('DOMAIN-SET');
      expect(result.rules[0].value).toBe('https://example.com/domains.txt');
      expect(result.rules[0].target).toBe('Proxy');
      expect(result.rules[1].type).toBe('DOMAIN-SET');
      expect(result.rules[1].value).toBe('https://cdn.example.com/list.txt');
      expect(result.rules[1].target).toBe('DIRECT');
    });

    it('should parse RULE-SET rules with URL values correctly', () => {
      const result = parseSurge(`[Rule]
RULE-SET,https://example.com/rules.list,Proxy`);

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].type).toBe('RULE-SET');
      expect(result.rules[0].value).toBe('https://example.com/rules.list');
      expect(result.rules[0].target).toBe('Proxy');
    });

    it('should parse rules with URL values and comments correctly', () => {
      const result = parseSurge(`[Rule]
DOMAIN-SET,https://example.com/domains.txt,Proxy // External domain list`);

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].type).toBe('DOMAIN-SET');
      expect(result.rules[0].value).toBe('https://example.com/domains.txt');
      expect(result.rules[0].target).toBe('Proxy');
      expect(result.rules[0].comment).toBe('External domain list');
    });
  });
});
