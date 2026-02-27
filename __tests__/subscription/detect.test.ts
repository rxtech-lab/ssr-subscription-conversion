import { describe, it, expect } from 'vitest';
import { detectFormat } from '@/lib/subscription/detect';

describe('detectFormat', () => {
  describe('Surge detection', () => {
    it('should detect Surge config with [Proxy] section', () => {
      const content = `[General]
loglevel = notify

[Proxy]
Server1 = ss, server.example.com, 443, encrypt-method=aes-128-gcm, password=test

[Proxy Group]
Auto = url-test, Server1

[Rule]
FINAL,Auto`;

      expect(detectFormat(content)).toBe('surge');
    });

    it('should detect Surge config with just [Proxy Group] section', () => {
      const content = `[Proxy Group]
Auto = url-test, Server1`;

      expect(detectFormat(content)).toBe('surge');
    });

    it('should detect Surge even with leading whitespace', () => {
      const content = `
[Proxy]
DIRECT = direct
`;

      expect(detectFormat(content)).toBe('surge');
    });
  });

  describe('Clash detection', () => {
    it('should detect Clash YAML with proxies key', () => {
      const content = `port: 7890
socks-port: 7891
allow-lan: false
mode: Rule
log-level: info

proxies:
  - name: "Server1"
    type: ss
    server: server.example.com
    port: 443
    cipher: aes-128-gcm
    password: "test"

rules:
  - MATCH,DIRECT`;

      expect(detectFormat(content)).toBe('clash');
    });

    it('should detect Clash config with empty proxies array', () => {
      const content = `proxies: []
rules:
  - MATCH,DIRECT`;

      expect(detectFormat(content)).toBe('clash');
    });
  });

  describe('V2Ray detection', () => {
    it('should detect base64-encoded vmess:// links', () => {
      const vmessLink = 'vmess://' + Buffer.from(JSON.stringify({
        v: '2',
        ps: 'Test',
        add: 'server.example.com',
        port: '443',
        id: 'test-uuid',
        aid: '0',
        net: 'ws',
        type: 'none',
        host: '',
        path: '',
        tls: 'tls',
      })).toString('base64');

      const base64Content = Buffer.from(vmessLink).toString('base64');

      expect(detectFormat(base64Content)).toBe('v2ray');
    });

    it('should detect base64-encoded ss:// links', () => {
      const ssLink = 'ss://' + Buffer.from('aes-128-gcm:password').toString('base64') + '@server.example.com:443#TestServer';
      const base64Content = Buffer.from(ssLink).toString('base64');

      expect(detectFormat(base64Content)).toBe('v2ray');
    });

    it('should detect base64-encoded mixed links', () => {
      const vmessLink = 'vmess://' + Buffer.from(JSON.stringify({
        v: '2', ps: 'VMess', add: 'v.example.com', port: '443',
        id: 'uuid', aid: '0', net: 'tcp', type: 'none', host: '', path: '', tls: '',
      })).toString('base64');
      const ssLink = 'ss://' + Buffer.from('aes-128-gcm:pass').toString('base64') + '@s.example.com:443#SS';

      const combined = vmessLink + '\n' + ssLink;
      const base64Content = Buffer.from(combined).toString('base64');

      expect(detectFormat(base64Content)).toBe('v2ray');
    });

    it('should detect raw vmess:// links (not base64-wrapped)', () => {
      const vmessLink = 'vmess://' + Buffer.from(JSON.stringify({
        v: '2', ps: 'Test', add: 'server.example.com', port: '443',
        id: 'test-uuid', aid: '0', net: 'ws', type: 'none', host: '', path: '', tls: 'tls',
      })).toString('base64');

      expect(detectFormat(vmessLink)).toBe('v2ray');
    });

    it('should detect raw ss:// links', () => {
      const content = 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ@server.example.com:443#Test';

      expect(detectFormat(content)).toBe('v2ray');
    });

    it('should detect raw trojan:// links', () => {
      const content = 'trojan://password@server.example.com:443?sni=sni.example.com#Test';

      expect(detectFormat(content)).toBe('v2ray');
    });
  });

  describe('Unknown format', () => {
    it('should return unknown for arbitrary text', () => {
      expect(detectFormat('hello world')).toBe('unknown');
    });

    it('should return unknown for empty string', () => {
      expect(detectFormat('')).toBe('unknown');
    });

    it('should return unknown for random JSON without outbounds', () => {
      expect(detectFormat('{"key": "value"}')).toBe('unknown');
    });

    it('should return unknown for HTML content', () => {
      expect(detectFormat('<html><body>Not a subscription</body></html>')).toBe('unknown');
    });
  });

  describe('V2Ray JSON detection', () => {
    it('should detect V2Ray JSON config with outbounds', () => {
      const content = JSON.stringify({
        outbounds: [
          { protocol: 'vmess', settings: {} },
        ],
      });

      expect(detectFormat(content)).toBe('v2ray');
    });
  });
});
