import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { parseSurge } from '@/lib/subscription/parsers/surge';
import { generateClash } from '@/lib/subscription/generators/clash';

/**
 * Validates generated Clash configs with the real mihomo core (`mihomo -t`).
 * Set MIHOMO_BIN to one or more comma-separated binaries, e.g.
 *   MIHOMO_BIN=$(scripts/download-mihomo.sh) bun run test
 */
const binaries = (process.env.MIHOMO_BIN ?? '').split(',').filter(Boolean);

// Persistent home dir so mihomo downloads GeoIP data once, not on every run
const MIHOMO_HOME = path.resolve('.mihomo/home');

const SURGE_CONFIG = `[General]
loglevel = notify

[Proxy]
🎯 全球直连 = direct
⛔️ 拦截 = reject
🇭🇰 HK SS = ss, hk.example.com, 443, encrypt-method=aes-128-gcm, password=123456, udp-relay=true
🇯🇵 JP VMess = vmess, jp.example.com, 443, username=123e4567-e89b-12d3-a456-426614174000, ws=true, ws-path=/ray, ws-headers=Host:cdn.example.com, tls=true, sni=cdn.example.com, vmess-aead=true
🇸🇬 AWS-LightSail-SG = trojan, sg.example.com, 443, password=secret, sni=sg.example.com, skip-cert-verify=true

[Proxy Group]
🔰 节点选择 = select, 🇭🇰 HK SS, 🇯🇵 JP VMess, 🇸🇬 AWS-LightSail-SG, 🎯 全球直连
🤖 人工智能 = select, 🔰 节点选择, 🇸🇬 AWS-LightSail-SG
♻️ 自动选择 = url-test, 🇭🇰 HK SS, 🇯🇵 JP VMess, url=http://www.gstatic.com/generate_204, interval=300

[Rule]
PROCESS-NAME,/Applications/My App.app/Contents/MacOS/My App,"🤖 人工智能"
PROCESS-NAME,Telegram,🔰 节点选择
DOMAIN-WILDCARD,*.binance.*,🇸🇬 AWS-LightSail-SG
DOMAIN-SUFFIX,openai.com,"🤖 人工智能"
DOMAIN-KEYWORD,google,🔰 节点选择
DOMAIN,ads.example.com,⛔️ 拦截
DOMAIN,tracker.example.com,REJECT-TINYGIF
USER-AGENT,Instagram*,🔰 节点选择
URL-REGEX,^http://example\\.com/ad,REJECT
PROTOCOL,QUIC,REJECT
DEST-PORT,25,REJECT
SRC-IP,192.168.1.100,DIRECT
IP-ASN,13335,🔰 节点选择
AND,((DOMAIN-SUFFIX,example.org),(DEST-PORT,443)),♻️ 自动选择
RULE-SET,https://example.com/rules/proxy.list,🔰 节点选择
DOMAIN-SET,https://example.com/rules/reject.txt,REJECT
RULE-SET,LAN,DIRECT
RULE-SET,SYSTEM,DIRECT
IP-CIDR,10.0.0.0/8,DIRECT
GEOIP,CN,🎯 全球直连
FINAL,🔰 节点选择
`;

describe.skipIf(binaries.length === 0)('generated Clash config passes mihomo -t', () => {
  it.each(binaries)('%s', (bin) => {
    mkdirSync(MIHOMO_HOME, { recursive: true });
    const dir = mkdtempSync(path.join(tmpdir(), 'mihomo-'));
    try {
      const file = path.join(dir, 'config.yaml');
      writeFileSync(file, generateClash(parseSurge(SURGE_CONFIG)));
      let output: string;
      try {
        output = execFileSync(bin, ['-t', '-d', MIHOMO_HOME, '-f', file], { encoding: 'utf-8' });
      } catch (error) {
        const e = error as { stdout?: string; stderr?: string };
        output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      }
      expect(output).toContain('test is successful');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
});
