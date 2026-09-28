import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateClash } from '@/lib/subscription/generators/clash';
import type { SubscriptionConfig } from '@/lib/subscription/types';

const sampleConfig: SubscriptionConfig = {
  general: {
    loglevel: 'notify',
    'dns-server': '8.8.8.8, 8.8.4.4',
    mode: 'Rule',
    'log-level': 'info',
    port: '7890',
    'socks-port': '7891',
    'allow-lan': 'false',
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

describe('generateClash', () => {
  const output = generateClash(sampleConfig);

  describe('valid YAML', () => {
    it('should produce valid YAML', () => {
      const parsed = yaml.load(output);
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });
  });

  describe('general settings', () => {
    it('should include mapped general settings', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      expect(parsed['port']).toBe(7890);
      expect(parsed['socks-port']).toBe(7891);
      expect(parsed['allow-lan']).toBe(false);
      expect(parsed['mode']).toBe('Rule');
      expect(parsed['log-level']).toBe('info');
    });
  });

  describe('proxies', () => {
    it('should include only actual proxy servers (not direct/reject)', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const proxies = parsed['proxies'] as Array<Record<string, unknown>>;
      expect(proxies).toHaveLength(2);
    });

    it('should format SS proxies with Clash key names', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const proxies = parsed['proxies'] as Array<Record<string, unknown>>;

      const hk = proxies.find((p) => p['name'] === '🇭🇰 HK');
      expect(hk).toBeDefined();
      expect(hk!['type']).toBe('ss');
      expect(hk!['server']).toBe('hk.example.com');
      expect(hk!['port']).toBe(443);
      // encrypt-method should be mapped to cipher
      expect(hk!['cipher']).toBe('aes-128-gcm');
      expect(hk!['password']).toBe('test123');
      // udp-relay should be mapped to udp
      expect(hk!['udp']).toBe(true);
    });
  });

  describe('proxy groups', () => {
    it('should include proxy groups', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const groups = parsed['proxy-groups'] as Array<Record<string, unknown>>;
      expect(groups).toHaveLength(2);
    });

    it('should format url-test group correctly', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const groups = parsed['proxy-groups'] as Array<Record<string, unknown>>;

      const auto = groups.find((g) => g['name'] === '♻️ Auto');
      expect(auto).toBeDefined();
      expect(auto!['type']).toBe('url-test');
      expect(auto!['proxies']).toEqual(['🇭🇰 HK', '🇺🇸 US']);
      expect(auto!['url']).toBe('http://www.gstatic.com/generate_204');
      expect(auto!['interval']).toBe(300);
    });

    it('should format select group correctly', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const groups = parsed['proxy-groups'] as Array<Record<string, unknown>>;

      const proxy = groups.find((g) => g['name'] === '🔰 Proxy');
      expect(proxy).toBeDefined();
      expect(proxy!['type']).toBe('select');
      expect(proxy!['proxies']).toEqual(['♻️ Auto', '🇭🇰 HK', '🇺🇸 US', 'DIRECT']);
    });
  });

  describe('rules', () => {
    it('should include rules', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const rules = parsed['rules'] as string[];
      expect(rules).toHaveLength(4);
    });

    it('should format DOMAIN-SUFFIX rules', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const rules = parsed['rules'] as string[];
      expect(rules).toContain('DOMAIN-SUFFIX,google.com,🔰 Proxy');
      expect(rules).toContain('DOMAIN-SUFFIX,apple.com,DIRECT');
    });

    it('should format GEOIP rule', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const rules = parsed['rules'] as string[];
      expect(rules).toContain('GEOIP,CN,DIRECT');
    });

    it('should convert FINAL to MATCH', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const rules = parsed['rules'] as string[];
      expect(rules).toContain('MATCH,🔰 Proxy');
      // Should NOT contain FINAL
      expect(rules.some((r) => r.startsWith('FINAL'))).toBe(false);
    });
  });

  describe('hosts', () => {
    it('should include hosts', () => {
      const parsed = yaml.load(output) as Record<string, unknown>;
      const hosts = parsed['hosts'] as Record<string, string>;
      expect(hosts).toBeDefined();
      expect(hosts['mtalk.google.com']).toBe('108.177.125.188');
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
      const result = generateClash(emptyConfig);
      const parsed = yaml.load(result);
      expect(parsed).toBeDefined();
    });

    it('should handle config with only servers', () => {
      const configWithServers: SubscriptionConfig = {
        general: {},
        servers: [
          {
            name: 'Test',
            type: 'ss',
            server: 'test.example.com',
            port: 443,
            settings: { 'encrypt-method': 'aes-128-gcm', password: 'pass' },
          },
        ],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };
      const result = generateClash(configWithServers);
      const parsed = yaml.load(result) as Record<string, unknown>;
      const proxies = parsed['proxies'] as Array<Record<string, unknown>>;
      expect(proxies).toHaveLength(1);
      expect(proxies[0]['name']).toBe('Test');
    });

    it('should coerce string numbers to actual numbers in YAML', () => {
      const configWithStringNumbers: SubscriptionConfig = {
        general: { port: '7890' },
        servers: [],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };
      const result = generateClash(configWithStringNumbers);
      const parsed = yaml.load(result) as Record<string, unknown>;
      expect(parsed['port']).toBe(7890);
    });

    it('should coerce string booleans in YAML', () => {
      const configWithStringBool: SubscriptionConfig = {
        general: { 'allow-lan': 'true' },
        servers: [],
        proxyGroups: [],
        rules: [],
        hosts: [],
      };
      const result = generateClash(configWithStringBool);
      const parsed = yaml.load(result) as Record<string, unknown>;
      expect(parsed['allow-lan']).toBe(true);
    });
  });
});

describe('generateClash - Surge-style VMess/Trojan settings', () => {
  const config: SubscriptionConfig = {
    general: {},
    servers: [
      {
        name: 'VMess',
        type: 'vmess',
        server: 'v.example.com',
        port: 443,
        settings: {
          username: '123e4567-e89b-12d3-a456-426614174000',
          ws: true,
          'ws-path': '/ray',
          'ws-headers': 'Host:cdn.example.com',
          tls: true,
          sni: 'cdn.example.com',
          'vmess-aead': true,
        },
      },
      {
        name: 'Trojan',
        type: 'trojan',
        server: 't.example.com',
        port: 443,
        settings: { password: '123456', sni: 't.example.com', 'udp-relay': true },
      },
    ],
    proxyGroups: [],
    rules: [],
    hosts: [],
  };
  const parsed = yaml.load(generateClash(config)) as { proxies: Record<string, unknown>[] };

  it('maps Surge username to uuid and fills required VMess fields', () => {
    const vmess = parsed.proxies[0];
    expect(vmess.uuid).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(vmess.username).toBeUndefined();
    expect(vmess['vmess-aead']).toBeUndefined();
    expect(vmess.alterId).toBe(0);
    expect(vmess.cipher).toBe('auto');
    expect(vmess.network).toBe('ws');
    expect(vmess['ws-opts']).toEqual({ path: '/ray', headers: { Host: 'cdn.example.com' } });
    expect(vmess.servername).toBe('cdn.example.com');
  });

  it('keeps trojan password a string and maps udp-relay', () => {
    const trojan = parsed.proxies[1];
    expect(trojan.password).toBe('123456');
    expect(trojan.sni).toBe('t.example.com');
    expect(trojan.udp).toBe(true);
  });
});

describe('generateClash - named direct/reject policies', () => {
  const config: SubscriptionConfig = {
    general: {},
    servers: [
      { name: 'HK', type: 'ss', server: 'hk.example.com', port: 443, settings: { 'encrypt-method': 'aes-128-gcm', password: 'x' } },
      { name: '🎯 全球直连', type: 'direct', settings: {} },
      { name: '⛔️ 拦截', type: 'reject', settings: {} },
    ],
    proxyGroups: [
      { name: '🔰 节点选择', type: 'select', members: ['HK', '🎯 全球直连', 'DIRECT'], settings: {} },
    ],
    rules: [
      { type: 'DOMAIN-SUFFIX', value: 'ads.com', target: '⛔️ 拦截' },
      { type: 'DOMAIN-SUFFIX', value: 'tracker.com', target: 'REJECT-TINYGIF' },
      { type: 'FINAL', target: '🎯 全球直连' },
    ],
    hosts: [],
  };
  const parsed = yaml.load(generateClash(config)) as {
    'proxy-groups': { proxies: string[] }[];
    rules: string[];
  };

  it('maps direct/reject server names to built-in policies in groups', () => {
    expect(parsed['proxy-groups'][0].proxies).toEqual(['HK', 'DIRECT']);
  });

  it('maps direct/reject server names to built-in policies in rules', () => {
    expect(parsed.rules).toEqual([
      'DOMAIN-SUFFIX,ads.com,REJECT',
      'DOMAIN-SUFFIX,tracker.com,REJECT',
      'MATCH,DIRECT',
    ]);
  });
});

describe('generateClash - quoted policy names', () => {
  it('strips quotes from rule targets and values', () => {
    const output = generateClash({
      general: {},
      servers: [],
      proxyGroups: [{ name: '🤖 人工智能', type: 'select', members: ['DIRECT'], settings: {} }],
      rules: [
        { type: 'PROCESS-NAME', value: '"/Applications/My App.app/Contents/MacOS/My App"', target: '"🤖 人工智能"' },
      ],
      hosts: [],
    });
    const parsed = yaml.load(output) as { rules: string[] };
    expect(parsed.rules).toEqual(['PROCESS-NAME,/Applications/My App.app/Contents/MacOS/My App,🤖 人工智能']);
  });
});
