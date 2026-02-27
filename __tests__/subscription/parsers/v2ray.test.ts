import { describe, it, expect } from 'vitest';
import { parseV2ray } from '@/lib/subscription/parsers/v2ray';

/**
 * Helper to create a base64-encoded vmess:// link from a config object.
 */
function makeVmessLink(config: Record<string, unknown>): string {
  return 'vmess://' + Buffer.from(JSON.stringify(config)).toString('base64');
}

/**
 * Helper to create an ss:// link in format: ss://base64(method:password)@server:port#name
 */
function makeSsLink(
  method: string,
  password: string,
  server: string,
  port: number,
  name: string
): string {
  const userInfo = Buffer.from(`${method}:${password}`).toString('base64');
  return `ss://${userInfo}@${server}:${port}#${encodeURIComponent(name)}`;
}

/**
 * Helper to create a trojan:// link.
 */
function makeTrojanLink(
  password: string,
  server: string,
  port: number,
  name: string,
  params?: Record<string, string>
): string {
  let uri = `trojan://${password}@${server}:${port}`;
  if (params && Object.keys(params).length > 0) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    uri += `?${qs}`;
  }
  uri += `#${encodeURIComponent(name)}`;
  return uri;
}

describe('parseV2ray', () => {
  describe('base64-encoded vmess:// link', () => {
    it('should parse a base64-encoded vmess subscription', () => {
      const vmessConfig = {
        v: '2',
        ps: 'HK Server',
        add: 'hk.example.com',
        port: '443',
        id: 'abcd-1234-efgh-5678',
        aid: '0',
        net: 'ws',
        type: 'none',
        host: 'ws.example.com',
        path: '/path',
        tls: 'tls',
      };

      const link = makeVmessLink(vmessConfig);
      const base64Content = Buffer.from(link).toString('base64');
      const config = parseV2ray(base64Content);

      expect(config.servers).toHaveLength(1);
      const server = config.servers[0];
      expect(server.name).toBe('HK Server');
      expect(server.type).toBe('vmess');
      expect(server.server).toBe('hk.example.com');
      expect(server.port).toBe(443);
      expect(server.settings['uuid']).toBe('abcd-1234-efgh-5678');
      expect(server.settings['alterId']).toBe(0);
      expect(server.settings['network']).toBe('ws');
      expect(server.settings['host']).toBe('ws.example.com');
      expect(server.settings['path']).toBe('/path');
      expect(server.settings['tls']).toBe(true);
    });
  });

  describe('base64-encoded ss:// link', () => {
    it('should parse a base64-encoded ss subscription', () => {
      const ssLink = makeSsLink('aes-128-gcm', 'mypassword', 'ss.example.com', 8388, 'SS Server');
      const base64Content = Buffer.from(ssLink).toString('base64');
      const config = parseV2ray(base64Content);

      expect(config.servers).toHaveLength(1);
      const server = config.servers[0];
      expect(server.name).toBe('SS Server');
      expect(server.type).toBe('ss');
      expect(server.server).toBe('ss.example.com');
      expect(server.port).toBe(8388);
      expect(server.settings['encrypt-method']).toBe('aes-128-gcm');
      expect(server.settings['password']).toBe('mypassword');
    });
  });

  describe('plain vmess:// and ss:// links (not base64-wrapped)', () => {
    it('should parse plain vmess:// link', () => {
      const vmessConfig = {
        v: '2',
        ps: 'US Server',
        add: 'us.example.com',
        port: '8080',
        id: 'uuid-test-1234',
        aid: '2',
        net: 'tcp',
        type: 'none',
        host: '',
        path: '',
        tls: '',
      };

      const link = makeVmessLink(vmessConfig);
      const config = parseV2ray(link);

      expect(config.servers).toHaveLength(1);
      const server = config.servers[0];
      expect(server.name).toBe('US Server');
      expect(server.type).toBe('vmess');
      expect(server.server).toBe('us.example.com');
      expect(server.port).toBe(8080);
      expect(server.settings['uuid']).toBe('uuid-test-1234');
      expect(server.settings['alterId']).toBe(2);
      expect(server.settings['network']).toBe('tcp');
    });

    it('should parse plain ss:// link', () => {
      const ssLink = makeSsLink('chacha20-ietf-poly1305', 'pass123', 'ss2.example.com', 443, 'SS Plain');
      const config = parseV2ray(ssLink);

      expect(config.servers).toHaveLength(1);
      const server = config.servers[0];
      expect(server.name).toBe('SS Plain');
      expect(server.type).toBe('ss');
      expect(server.server).toBe('ss2.example.com');
      expect(server.port).toBe(443);
      expect(server.settings['encrypt-method']).toBe('chacha20-ietf-poly1305');
      expect(server.settings['password']).toBe('pass123');
    });

    it('should parse multiple plain links', () => {
      const vmessLink = makeVmessLink({
        v: '2', ps: 'VMess1', add: 'v1.example.com', port: '443',
        id: 'uuid-1', aid: '0', net: 'ws', type: 'none', host: '', path: '', tls: 'tls',
      });
      const ssLink = makeSsLink('aes-256-gcm', 'pwd', 's1.example.com', 8388, 'SS1');

      const content = vmessLink + '\n' + ssLink;
      const config = parseV2ray(content);

      expect(config.servers).toHaveLength(2);
      expect(config.servers[0].type).toBe('vmess');
      expect(config.servers[0].name).toBe('VMess1');
      expect(config.servers[1].type).toBe('ss');
      expect(config.servers[1].name).toBe('SS1');
    });
  });

  describe('trojan:// link', () => {
    it('should parse a trojan:// link', () => {
      const trojanLink = makeTrojanLink('trojan-password', 'trojan.example.com', 443, 'Trojan Server', {
        sni: 'sni.example.com',
        type: 'tcp',
        security: 'tls',
      });

      const config = parseV2ray(trojanLink);

      expect(config.servers).toHaveLength(1);
      const server = config.servers[0];
      expect(server.name).toBe('Trojan Server');
      expect(server.type).toBe('trojan');
      expect(server.server).toBe('trojan.example.com');
      expect(server.port).toBe(443);
      expect(server.settings['password']).toBe('trojan-password');
      expect(server.settings['sni']).toBe('sni.example.com');
      expect(server.settings['network']).toBe('tcp');
      expect(server.settings['security']).toBe('tls');
    });

    it('should parse trojan link without query params', () => {
      const trojanLink = makeTrojanLink('simplepass', 'trojan2.example.com', 8443, 'Simple Trojan');
      const config = parseV2ray(trojanLink);

      expect(config.servers).toHaveLength(1);
      const server = config.servers[0];
      expect(server.name).toBe('Simple Trojan');
      expect(server.type).toBe('trojan');
      expect(server.server).toBe('trojan2.example.com');
      expect(server.port).toBe(8443);
      expect(server.settings['password']).toBe('simplepass');
    });
  });

  describe('mixed base64-encoded subscription', () => {
    it('should parse multiple links of different types in base64', () => {
      const vmessLink = makeVmessLink({
        v: '2', ps: 'VMess HK', add: 'hk.example.com', port: '443',
        id: 'uuid-hk', aid: '0', net: 'ws', type: 'none', host: '', path: '', tls: 'tls',
      });
      const ssLink = makeSsLink('aes-128-gcm', 'sspass', 'ss.example.com', 8388, 'SS Japan');
      const trojanLink = makeTrojanLink('tpass', 'trojan.example.com', 443, 'Trojan US', { sni: 'sni.com' });

      const combined = [vmessLink, ssLink, trojanLink].join('\n');
      const base64Content = Buffer.from(combined).toString('base64');
      const config = parseV2ray(base64Content);

      expect(config.servers).toHaveLength(3);
      expect(config.servers[0].type).toBe('vmess');
      expect(config.servers[0].name).toBe('VMess HK');
      expect(config.servers[1].type).toBe('ss');
      expect(config.servers[1].name).toBe('SS Japan');
      expect(config.servers[2].type).toBe('trojan');
      expect(config.servers[2].name).toBe('Trojan US');
    });
  });

  describe('v2ray config produces no groups, rules, or hosts', () => {
    it('should always have empty proxyGroups, rules, and hosts', () => {
      const link = makeVmessLink({
        v: '2', ps: 'Test', add: 'test.com', port: '443',
        id: 'uuid', aid: '0', net: 'tcp', type: 'none', host: '', path: '', tls: '',
      });
      const config = parseV2ray(link);

      expect(config.proxyGroups).toEqual([]);
      expect(config.rules).toEqual([]);
      expect(config.hosts).toEqual([]);
      expect(config.general).toEqual({});
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const config = parseV2ray('');
      expect(config.servers).toEqual([]);
    });

    it('should skip invalid links', () => {
      const content = 'vmess://invalidbase64\nhttp://not-a-proxy-link\n' +
        makeSsLink('aes-128-gcm', 'pass', 'valid.example.com', 443, 'Valid');
      const config = parseV2ray(content);

      // Only the valid SS link should be parsed
      expect(config.servers.length).toBeGreaterThanOrEqual(1);
      const valid = config.servers.find((s) => s.server === 'valid.example.com');
      expect(valid).toBeDefined();
    });

    it('should handle vmess link with remarks field instead of ps', () => {
      const link = makeVmessLink({
        v: '2', remarks: 'Remarks Name', add: 'rem.example.com', port: '443',
        id: 'uuid-rem', aid: '0', net: 'tcp', type: 'none', host: '', path: '', tls: '',
      });
      const config = parseV2ray(link);

      expect(config.servers[0].name).toBe('Remarks Name');
    });
  });
});
