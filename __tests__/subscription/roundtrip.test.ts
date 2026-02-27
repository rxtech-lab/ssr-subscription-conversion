import { describe, it, expect } from 'vitest';
import { parseSurge } from '@/lib/subscription/parsers/surge';
import { parseClash } from '@/lib/subscription/parsers/clash';
import { parseV2ray } from '@/lib/subscription/parsers/v2ray';
import { generateSurge } from '@/lib/subscription/generators/surge';
import { generateClash } from '@/lib/subscription/generators/clash';
import { generateV2ray } from '@/lib/subscription/generators/v2ray';

const SURGE_CONFIG = `[General]
loglevel = notify
dns-server = 8.8.8.8, 8.8.4.4

[Proxy]
🇭🇰 HK = ss, hk.example.com, 443, encrypt-method=aes-128-gcm, password=test123, udp-relay=true
🇺🇸 US = ss, us.example.com, 443, encrypt-method=chacha20-ietf-poly1305, password=abc456
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

describe('roundtrip conversions', () => {
  describe('Surge -> Clash -> Surge', () => {
    it('should preserve server names, types, hosts, and ports through Surge -> Clash -> parse Clash', () => {
      const surgeConfig = parseSurge(SURGE_CONFIG);
      const clashOutput = generateClash(surgeConfig);
      const clashConfig = parseClash(clashOutput);

      // Clash cannot represent direct/reject as proxies, so filter those out
      const surgeProxies = surgeConfig.servers.filter(
        (s) => s.type !== 'direct' && s.type !== 'reject'
      );

      expect(clashConfig.servers).toHaveLength(surgeProxies.length);

      for (const surgeServer of surgeProxies) {
        const clashServer = clashConfig.servers.find(
          (s) => s.name === surgeServer.name
        );
        expect(clashServer).toBeDefined();
        expect(clashServer!.type).toBe(surgeServer.type);
        expect(clashServer!.server).toBe(surgeServer.server);
        expect(clashServer!.port).toBe(surgeServer.port);
      }
    });

    it('should preserve proxy groups through Surge -> Clash -> parse Clash', () => {
      const surgeConfig = parseSurge(SURGE_CONFIG);
      const clashOutput = generateClash(surgeConfig);
      const clashConfig = parseClash(clashOutput);

      expect(clashConfig.proxyGroups).toHaveLength(surgeConfig.proxyGroups.length);

      for (const surgeGroup of surgeConfig.proxyGroups) {
        const clashGroup = clashConfig.proxyGroups.find(
          (g) => g.name === surgeGroup.name
        );
        expect(clashGroup).toBeDefined();
        expect(clashGroup!.type).toBe(surgeGroup.type);
        expect(clashGroup!.members).toEqual(surgeGroup.members);
      }
    });

    it('should preserve rules through Surge -> Clash -> parse Clash', () => {
      const surgeConfig = parseSurge(SURGE_CONFIG);
      const clashOutput = generateClash(surgeConfig);
      const clashConfig = parseClash(clashOutput);

      expect(clashConfig.rules).toHaveLength(surgeConfig.rules.length);

      for (let i = 0; i < surgeConfig.rules.length; i++) {
        expect(clashConfig.rules[i].type).toBe(surgeConfig.rules[i].type);
        expect(clashConfig.rules[i].value).toBe(surgeConfig.rules[i].value);
        expect(clashConfig.rules[i].target).toBe(surgeConfig.rules[i].target);
      }
    });
  });

  describe('Surge -> V2Ray -> Surge (servers only)', () => {
    it('should preserve SS server names, hosts, and ports through Surge -> V2Ray -> parse V2Ray', () => {
      const surgeConfig = parseSurge(SURGE_CONFIG);
      const v2rayOutput = generateV2ray(surgeConfig);
      const v2rayConfig = parseV2ray(v2rayOutput);

      // V2Ray only carries actual proxy servers (not direct/reject)
      const surgeProxies = surgeConfig.servers.filter(
        (s) => s.type !== 'direct' && s.type !== 'reject'
      );

      expect(v2rayConfig.servers).toHaveLength(surgeProxies.length);

      for (const surgeServer of surgeProxies) {
        const v2rayServer = v2rayConfig.servers.find(
          (s) => s.name === surgeServer.name
        );
        expect(v2rayServer).toBeDefined();
        expect(v2rayServer!.type).toBe(surgeServer.type);
        expect(v2rayServer!.server).toBe(surgeServer.server);
        expect(v2rayServer!.port).toBe(surgeServer.port);
      }
    });

    it('should preserve SS encryption method and password through roundtrip', () => {
      const surgeConfig = parseSurge(SURGE_CONFIG);
      const v2rayOutput = generateV2ray(surgeConfig);
      const v2rayConfig = parseV2ray(v2rayOutput);

      const surgeHK = surgeConfig.servers.find((s) => s.name === '🇭🇰 HK')!;
      const v2rayHK = v2rayConfig.servers.find((s) => s.name === '🇭🇰 HK')!;

      expect(v2rayHK.settings['encrypt-method']).toBe(surgeHK.settings['encrypt-method']);
      expect(v2rayHK.settings['password']).toBe(surgeHK.settings['password']);
    });

    it('should lose groups, rules, and hosts through V2Ray roundtrip', () => {
      const surgeConfig = parseSurge(SURGE_CONFIG);
      const v2rayOutput = generateV2ray(surgeConfig);
      const v2rayConfig = parseV2ray(v2rayOutput);

      expect(v2rayConfig.proxyGroups).toEqual([]);
      expect(v2rayConfig.rules).toEqual([]);
      expect(v2rayConfig.hosts).toEqual([]);
    });
  });

  describe('Clash -> Surge -> Clash', () => {
    it('should preserve server names, types, hosts, and ports through Clash -> Surge -> parse Surge', () => {
      const clashConfig = parseClash(CLASH_CONFIG);
      const surgeOutput = generateSurge(clashConfig);
      const surgeConfig = parseSurge(surgeOutput);

      // Filter to only actual proxy servers for comparison
      const surgeProxies = surgeConfig.servers.filter(
        (s) => s.type !== 'direct' && s.type !== 'reject'
      );

      expect(surgeProxies).toHaveLength(clashConfig.servers.length);

      for (const clashServer of clashConfig.servers) {
        const surgeServer = surgeProxies.find(
          (s) => s.name === clashServer.name
        );
        expect(surgeServer).toBeDefined();
        expect(surgeServer!.type).toBe(clashServer.type);
        expect(surgeServer!.server).toBe(clashServer.server);
        expect(surgeServer!.port).toBe(clashServer.port);
      }
    });

    it('should preserve proxy groups through Clash -> Surge -> parse Surge', () => {
      const clashConfig = parseClash(CLASH_CONFIG);
      const surgeOutput = generateSurge(clashConfig);
      const surgeConfig = parseSurge(surgeOutput);

      expect(surgeConfig.proxyGroups).toHaveLength(clashConfig.proxyGroups.length);

      for (const clashGroup of clashConfig.proxyGroups) {
        const surgeGroup = surgeConfig.proxyGroups.find(
          (g) => g.name === clashGroup.name
        );
        expect(surgeGroup).toBeDefined();
        expect(surgeGroup!.type).toBe(clashGroup.type);
        expect(surgeGroup!.members).toEqual(clashGroup.members);
      }
    });

    it('should preserve rules through Clash -> Surge -> parse Surge', () => {
      const clashConfig = parseClash(CLASH_CONFIG);
      const surgeOutput = generateSurge(clashConfig);
      const surgeConfig = parseSurge(surgeOutput);

      expect(surgeConfig.rules).toHaveLength(clashConfig.rules.length);

      for (let i = 0; i < clashConfig.rules.length; i++) {
        expect(surgeConfig.rules[i].type).toBe(clashConfig.rules[i].type);
        expect(surgeConfig.rules[i].target).toBe(clashConfig.rules[i].target);
      }
    });
  });

  describe('Clash -> V2Ray -> Clash (servers only)', () => {
    it('should preserve server info through Clash -> V2Ray -> parse V2Ray', () => {
      const clashConfig = parseClash(CLASH_CONFIG);
      const v2rayOutput = generateV2ray(clashConfig);
      const v2rayConfig = parseV2ray(v2rayOutput);

      expect(v2rayConfig.servers).toHaveLength(clashConfig.servers.length);

      for (const clashServer of clashConfig.servers) {
        const v2rayServer = v2rayConfig.servers.find(
          (s) => s.name === clashServer.name
        );
        expect(v2rayServer).toBeDefined();
        expect(v2rayServer!.type).toBe(clashServer.type);
        expect(v2rayServer!.server).toBe(clashServer.server);
        expect(v2rayServer!.port).toBe(clashServer.port);
      }
    });
  });

  describe('V2Ray -> Surge -> V2Ray', () => {
    it('should preserve server info through V2Ray -> Surge -> V2Ray roundtrip', () => {
      // Create a V2Ray subscription with multiple server types
      const vmessLink = 'vmess://' + Buffer.from(JSON.stringify({
        v: '2', ps: 'VMess HK', add: 'hk.example.com', port: '443',
        id: 'test-uuid-hk', aid: '0', net: 'ws', type: 'none',
        host: 'ws.example.com', path: '/ws', tls: 'tls',
      })).toString('base64');

      const ssUserInfo = Buffer.from('aes-128-gcm:sspassword').toString('base64');
      const ssLink = `ss://${ssUserInfo}@ss.example.com:8388#${encodeURIComponent('SS Japan')}`;

      const combined = vmessLink + '\n' + ssLink;
      const base64Content = Buffer.from(combined).toString('base64');

      const v2rayConfig1 = parseV2ray(base64Content);
      const surgeOutput = generateSurge(v2rayConfig1);
      const surgeConfig = parseSurge(surgeOutput);
      const v2rayOutput2 = generateV2ray(surgeConfig);
      const v2rayConfig2 = parseV2ray(v2rayOutput2);

      expect(v2rayConfig2.servers).toHaveLength(v2rayConfig1.servers.length);

      for (const original of v2rayConfig1.servers) {
        const roundtripped = v2rayConfig2.servers.find(
          (s) => s.name === original.name
        );
        expect(roundtripped).toBeDefined();
        expect(roundtripped!.type).toBe(original.type);
        expect(roundtripped!.server).toBe(original.server);
        expect(roundtripped!.port).toBe(original.port);
      }
    });
  });
});
