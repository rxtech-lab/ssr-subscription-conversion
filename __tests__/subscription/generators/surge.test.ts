import { describe, it, expect } from 'vitest';
import { generateSurge } from '@/lib/subscription/generators/surge';
import type { SubscriptionConfig } from '@/lib/subscription/types';

const sampleConfig: SubscriptionConfig = {
  general: {
    loglevel: 'notify',
    'dns-server': '8.8.8.8, 8.8.4.4',
  },
  servers: [
    {
      name: '🇭🇰 HK',
      type: 'ss',
      server: 'hk.example.com',
      port: 443,
      settings: {
        'encrypt-method': 'aes-128-gcm',
        password: 'test123',
        'udp-relay': true,
      },
    },
    {
      name: '🇺🇸 US',
      type: 'ss',
      server: 'us.example.com',
      port: 443,
      settings: {
        'encrypt-method': 'chacha20-ietf-poly1305',
        password: 'abc456',
      },
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
  proxyGroups: [
    {
      name: '♻️ Auto',
      type: 'url-test',
      members: ['🇭🇰 HK', '🇺🇸 US'],
      settings: {
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
        timeout: 5,
      },
    },
    {
      name: '🔰 Proxy',
      type: 'select',
      members: ['♻️ Auto', '🇭🇰 HK', '🇺🇸 US', 'DIRECT'],
      settings: {},
    },
  ],
  rules: [
    { type: 'DOMAIN-SUFFIX', value: 'google.com', target: '🔰 Proxy' },
    { type: 'DOMAIN-SUFFIX', value: 'apple.com', target: 'DIRECT' },
    { type: 'GEOIP', value: 'CN', target: 'DIRECT' },
    { type: 'FINAL', target: '🔰 Proxy' },
  ],
  hosts: [
    { domain: 'mtalk.google.com', ip: '108.177.125.188' },
  ],
};

describe('generateSurge', () => {
  const output = generateSurge(sampleConfig);

  describe('section headers', () => {
    it('should contain [General] section', () => {
      expect(output).toContain('[General]');
    });

    it('should contain [Proxy] section', () => {
      expect(output).toContain('[Proxy]');
    });

    it('should contain [Proxy Group] section', () => {
      expect(output).toContain('[Proxy Group]');
    });

    it('should contain [Rule] section', () => {
      expect(output).toContain('[Rule]');
    });

    it('should contain [Host] section', () => {
      expect(output).toContain('[Host]');
    });
  });

  describe('general settings', () => {
    it('should output general key-value pairs', () => {
      expect(output).toContain('loglevel = notify');
      expect(output).toContain('dns-server = 8.8.8.8, 8.8.4.4');
    });
  });

  describe('proxy lines', () => {
    it('should format SS proxy with settings', () => {
      expect(output).toContain('🇭🇰 HK = ss, hk.example.com, 443, encrypt-method=aes-128-gcm, password=test123, udp-relay=true');
    });

    it('should format another SS proxy', () => {
      expect(output).toContain('🇺🇸 US = ss, us.example.com, 443, encrypt-method=chacha20-ietf-poly1305, password=abc456');
    });

    it('should output DIRECT as direct', () => {
      expect(output).toContain('DIRECT = direct');
    });

    it('should output REJECT as reject', () => {
      expect(output).toContain('REJECT = reject');
    });
  });

  describe('proxy group lines', () => {
    it('should format url-test group with members and settings', () => {
      expect(output).toContain('♻️ Auto = url-test, 🇭🇰 HK, 🇺🇸 US, url=http://www.gstatic.com/generate_204, interval=300, timeout=5');
    });

    it('should format select group with members', () => {
      expect(output).toContain('🔰 Proxy = select, ♻️ Auto, 🇭🇰 HK, 🇺🇸 US, DIRECT');
    });
  });

  describe('rule lines', () => {
    it('should format DOMAIN-SUFFIX rules', () => {
      expect(output).toContain('DOMAIN-SUFFIX,google.com,🔰 Proxy');
      expect(output).toContain('DOMAIN-SUFFIX,apple.com,DIRECT');
    });

    it('should format GEOIP rule', () => {
      expect(output).toContain('GEOIP,CN,DIRECT');
    });

    it('should format FINAL rule', () => {
      expect(output).toContain('FINAL,🔰 Proxy');
    });

    it('should format rule with comment', () => {
      const configWithComment: SubscriptionConfig = {
        ...sampleConfig,
        rules: [
          { type: 'DOMAIN-SUFFIX', value: 'google.com', target: 'Proxy', comment: 'Google' },
        ],
      };
      const result = generateSurge(configWithComment);
      expect(result).toContain('DOMAIN-SUFFIX,google.com,Proxy // Google');
    });
  });

  describe('host lines', () => {
    it('should format host entry', () => {
      expect(output).toContain('mtalk.google.com = 108.177.125.188');
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', () => {
      const emptyConfig: SubscriptionConfig = {
        general: {},
        servers: [],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };
      const result = generateSurge(emptyConfig);
      // Should produce minimal output (just a trailing newline)
      expect(result.trim()).toBe('');
    });

    it('should handle VMess server format', () => {
      const vmessConfig: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'VMess',
            type: 'vmess',
            server: 'v.example.com',
            port: 443,
            settings: {
              uuid: 'test-uuid-1234',
              alterId: 0,
              tls: true,
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };
      const result = generateSurge(vmessConfig);
      expect(result).toContain('VMess = vmess, v.example.com, 443, username=test-uuid-1234');
    });

    it('should handle Trojan server format', () => {
      const trojanConfig: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'Trojan',
            type: 'trojan',
            server: 't.example.com',
            port: 443,
            settings: {
              password: 'trojan-pass',
              sni: 't.example.com',
            },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };
      const result = generateSurge(trojanConfig);
      expect(result).toContain('Trojan = trojan, t.example.com, 443, password=trojan-pass');
      expect(result).toContain('sni=t.example.com');
    });
  });
});
