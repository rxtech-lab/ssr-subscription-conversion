import type { SubscriptionConfig, ProxyServer, ProxyGroup, Rule, HostEntry } from '../types';

function formatServerLine(server: ProxyServer): string {
  const { name, type, server: host, port, settings } = server;

  if (type === 'direct') {
    return `${name} = direct`;
  }

  if (type === 'reject') {
    return `${name} = reject`;
  }

  const settingsParts = Object.entries(settings).map(
    ([key, value]) => `${key}=${value}`
  );

  switch (type) {
    case 'ss':
      return `${name} = ss, ${host}, ${port}, ${settingsParts.join(', ')}`;

    case 'vmess':
      return `${name} = vmess, ${host}, ${port}, username=${settings.uuid}, ${Object.entries(settings)
        .filter(([key]) => key !== 'uuid')
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')}`;

    case 'trojan':
      return `${name} = trojan, ${host}, ${port}, password=${settings.password}, ${Object.entries(settings)
        .filter(([key]) => key !== 'password')
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')}`;

    default:
      return `${name} = ${type}, ${host}, ${port}, ${settingsParts.join(', ')}`;
  }
}

function formatProxyGroupLine(group: ProxyGroup): string {
  const { name, type, members, settings } = group;

  const settingsParts = Object.entries(settings).map(
    ([key, value]) => `${key}=${value}`
  );
  const memberStr = members.join(', ');
  const settingsStr = settingsParts.length > 0 ? `, ${settingsParts.join(', ')}` : '';

  return `${name} = ${type}, ${memberStr}${settingsStr}`;
}

function formatRuleLine(rule: Rule): string {
  const { type, value, target, comment } = rule;

  let line: string;
  if (type === 'FINAL') {
    line = `FINAL,${target}`;
  } else {
    line = `${type},${value},${target}`;
  }

  if (comment) {
    line += ` // ${comment}`;
  }

  return line;
}

function formatHostLine(entry: HostEntry): string {
  return `${entry.domain} = ${entry.ip}`;
}

export function generateSurge(config: SubscriptionConfig): string {
  const sections: string[] = [];

  // [General]
  const generalLines = Object.entries(config.general).map(
    ([key, value]) => `${key} = ${value}`
  );
  if (generalLines.length > 0) {
    sections.push(`[General]\n${generalLines.join('\n')}`);
  }

  // [Proxy]
  const proxyLines = config.servers.map(formatServerLine);
  if (proxyLines.length > 0) {
    sections.push(`[Proxy]\n${proxyLines.join('\n')}`);
  }

  // [Proxy Group]
  const groupLines = config.proxyGroups.map(formatProxyGroupLine);
  if (groupLines.length > 0) {
    sections.push(`[Proxy Group]\n${groupLines.join('\n')}`);
  }

  // [Rule]
  const ruleLines = config.rules.map(formatRuleLine);
  if (ruleLines.length > 0) {
    sections.push(`[Rule]\n${ruleLines.join('\n')}`);
  }

  // [Host]
  const hostLines = config.hosts.map(formatHostLine);
  if (hostLines.length > 0) {
    sections.push(`[Host]\n${hostLines.join('\n')}`);
  }

  return sections.join('\n\n') + '\n';
}
