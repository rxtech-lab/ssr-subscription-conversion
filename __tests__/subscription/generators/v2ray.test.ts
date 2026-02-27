import { describe, it, expect } from 'vitest';
import { generateV2ray } from '@/lib/subscription/generators/v2ray';
import type { SubscriptionConfig } from '@/lib/subscription/types';

describe('generateV2ray', () => {
  describe('base64 output', () => {
    it('should produce valid base64-encoded output', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'SS Server',
            type: 'ss',
            server: 'ss.example.com',
            port: 8388,
            settings: {
              'encrypt-method': 'aes-128-gcm',
              password: 'mypassword',
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);

      // Should be valid base64
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should produce ss:// links when decoded', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'SS Server',
            type: 'ss',
            server: 'ss.example.com',
            port: 8388,
            settings: {
              'encrypt-method': 'aes-128-gcm',
              password: 'mypassword',
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      const lines = decoded.split('\n').filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^ss:\/\//);
    });

    it('should encode SS link correctly with base64 userinfo', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'My SS',
            type: 'ss',
            server: 'ss.example.com',
            port: 443,
            settings: {
              'encrypt-method': 'chacha20-ietf-poly1305',
              password: 'testpass',
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');

      // ss://base64(method:password)@server:port#name
      expect(decoded).toContain('@ss.example.com:443');
      expect(decoded).toContain('#' + encodeURIComponent('My SS'));

      // Extract and verify the base64 userinfo
      const ssMatch = decoded.match(/^ss:\/\/([A-Za-z0-9+/=]+)@/);
      expect(ssMatch).toBeTruthy();
      const userInfo = Buffer.from(ssMatch![1], 'base64').toString('utf-8');
      expect(userInfo).toBe('chacha20-ietf-poly1305:testpass');
    });
  });

  describe('vmess:// links', () => {
    it('should produce vmess:// links when decoded', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'VMess Server',
            type: 'vmess',
            server: 'v.example.com',
            port: 443,
            settings: {
              uuid: 'abcd-1234-efgh-5678',
              alterId: 0,
              network: 'ws',
              host: 'ws.example.com',
              path: '/path',
              tls: true,
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      const lines = decoded.split('\n').filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^vmess:\/\//);

      // Decode the vmess JSON
      const vmessBase64 = lines[0].substring('vmess://'.length);
      const vmessJson = JSON.parse(Buffer.from(vmessBase64, 'base64').toString('utf-8'));
      expect(vmessJson.ps).toBe('VMess Server');
      expect(vmessJson.add).toBe('v.example.com');
      expect(vmessJson.port).toBe(443);
      expect(vmessJson.id).toBe('abcd-1234-efgh-5678');
      expect(vmessJson.net).toBe('ws');
      expect(vmessJson.host).toBe('ws.example.com');
      expect(vmessJson.path).toBe('/path');
    });
  });

  describe('trojan:// links', () => {
    it('should produce trojan:// links when decoded', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'Trojan Server',
            type: 'trojan',
            server: 'trojan.example.com',
            port: 443,
            settings: {
              password: 'trojan-pass',
              sni: 'sni.example.com',
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      const lines = decoded.split('\n').filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^trojan:\/\//);
      expect(lines[0]).toContain('trojan-pass@trojan.example.com:443');
      expect(lines[0]).toContain('sni=' + encodeURIComponent('sni.example.com'));
      expect(lines[0]).toContain('#' + encodeURIComponent('Trojan Server'));
    });
  });

  describe('mixed server types', () => {
    it('should produce links for all server types (excluding direct/reject)', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'SS',
            type: 'ss',
            server: 'ss.example.com',
            port: 8388,
            settings: { 'encrypt-method': 'aes-128-gcm', password: 'pass1' },
          },
          {
            name: 'VMess',
            type: 'vmess',
            server: 'v.example.com',
            port: 443,
            settings: { uuid: 'uuid-1', alterId: 0, network: 'tcp' },
          },
          {
            name: 'Trojan',
            type: 'trojan',
            server: 't.example.com',
            port: 443,
            settings: { password: 'tpass' },
          },
          {
            name: 'DIRECT',
            type: 'direct',
            settings: {},
          },
          {
            name: 'REJECT',
            type: 'reject',
            settings: {},
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      const lines = decoded.split('\n').filter((l) => l.trim());

      // direct and reject should be skipped
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^ss:\/\//);
      expect(lines[1]).toMatch(/^vmess:\/\//);
      expect(lines[2]).toMatch(/^trojan:\/\//);
    });
  });

  describe('edge cases', () => {
    it('should handle empty server list', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      expect(decoded).toBe('');
    });

    it('should handle config with only direct/reject servers', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          { name: 'DIRECT', type: 'direct', settings: {} },
          { name: 'REJECT', type: 'reject', settings: {} },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      expect(decoded).toBe('');
    });

    it('should handle server names with special characters', () => {
      const config: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: '🇭🇰 Hong Kong #1 (Premium)',
            type: 'ss',
            server: 'hk.example.com',
            port: 443,
            settings: { 'encrypt-method': 'aes-128-gcm', password: 'pass' },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };

      const output = generateV2ray(config);
      const decoded = Buffer.from(output, 'base64').toString('utf-8');
      expect(decoded).toContain(encodeURIComponent('🇭🇰 Hong Kong #1 (Premium)'));
    });
  });
});
