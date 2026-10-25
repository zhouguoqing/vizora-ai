import { resolve } from 'node:path';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

const CERTIFICATE_PREFIX = 'Payments__Wechat__PlatformCertificates__';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_PATTERN = /replace[_ -]?with|your[_ -]|change[_ -]?me|placeholder/i;

function nonEmpty(env, key) {
  return typeof env[key] === 'string' && env[key].trim().length > 0;
}

function pemHasMarkers(value, marker) {
  if (typeof value !== 'string') return false;
  const normalized = value.replaceAll('\\n', '\n');
  return normalized.includes(`-----BEGIN ${marker}-----`)
    && normalized.includes(`-----END ${marker}-----`);
}

function privateKeyConfigured(env, key) {
  return pemHasMarkers(env[key], 'PRIVATE KEY') || pemHasMarkers(env[key], 'RSA PRIVATE KEY');
}

function securePublicUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const address = host.replace(/^\[|\]$/g, '');
    const labels = host.split('.');
    const validPublicHostname = host.length <= 253 && labels.length >= 2
      && labels.every(label => label.length <= 63
        && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
    return url.protocol === 'https:'
      && !url.username && !url.password && !url.search && !url.hash
      && host !== 'localhost' && !host.endsWith('.localhost')
      && isIP(address) === 0 && validPublicHostname;
  } catch {
    return false;
  }
}

function positivePort(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return false;
  const port = Number(value);
  return port >= 1 && port <= 65535;
}

export function checkProductionReadiness(env = process.env) {
  const issues = new Set();
  const requireValue = key => {
    if (!nonEmpty(env, key)) issues.add(`missing:${key}`);
  };
  const requirePem = (key, marker) => {
    if (!pemHasMarkers(env[key], marker)) issues.add(`invalid:${key}`);
  };
  const requirePrivateKey = key => {
    if (!nonEmpty(env, key)) issues.add(`missing:${key}`);
    else if (!privateKeyConfigured(env, key)) issues.add(`invalid:${key}`);
  };
  const requirePublicUrl = (key, value = env[key]) => {
    if (!securePublicUrl(value)) issues.add(`invalid:${key}`);
  };
  const requireAlipayGateway = () => {
    const value = env.Payments__Alipay__Gateway;
    if (nonEmpty(env, 'Payments__Alipay__Gateway')
      && value !== 'https://openapi.alipay.com/gateway.do')
      issues.add('invalid:Payments__Alipay__Gateway');
  };

  for (const key of [
    'ASPNETCORE_ENVIRONMENT',
    'Auth__SigningKey',
    'Mail__Host',
    'Mail__Port',
    'Mail__From',
    'Mail__EnableSsl',
    'Payments__PublicBaseUrl',
    'Payments__WebBaseUrl',
    'Payments__Wechat__MchId',
    'Payments__Wechat__AppId',
    'Payments__Wechat__SerialNo',
    'Payments__Wechat__ApiV3Key',
    'Payments__Alipay__AppId',
    'Payments__Alipay__SellerId',
    'Payments__Alipay__AlipayPublicKeyPem',
    'Payments__Alipay__Gateway',
    'Legal__Ready',
    'Legal__OperatorName',
    'Legal__ContactEmail',
  ]) requireValue(key);

  if (nonEmpty(env, 'ASPNETCORE_ENVIRONMENT')
    && env.ASPNETCORE_ENVIRONMENT !== 'Production')
    issues.add('invalid:ASPNETCORE_ENVIRONMENT');
  if (nonEmpty(env, 'DOTNET_ENVIRONMENT')
    && env.DOTNET_ENVIRONMENT !== 'Production')
    issues.add('invalid:DOTNET_ENVIRONMENT');

  const configuredKeys = [
    'Auth__SigningKey',
    'Mail__Host',
    'Mail__Port',
    'Mail__User',
    'Mail__Password',
    'Mail__From',
    'Payments__PublicBaseUrl',
    'Payments__WebBaseUrl',
    'Payments__Wechat__MchId',
    'Payments__Wechat__AppId',
    'Payments__Wechat__SerialNo',
    'Payments__Wechat__PrivateKeyPem',
    'Payments__Wechat__ApiV3Key',
    'Payments__Wechat__NotifyUrl',
    'Payments__Alipay__AppId',
    'Payments__Alipay__PrivateKeyPem',
    'Payments__Alipay__AlipayPublicKeyPem',
    'Payments__Alipay__SellerId',
    'Payments__Alipay__NotifyUrl',
    'Payments__Alipay__Gateway',
    'Legal__OperatorName',
    'Legal__ContactEmail',
    ...Object.keys(env).filter(key => key.startsWith(CERTIFICATE_PREFIX)),
  ];
  for (const key of configuredKeys)
    if (nonEmpty(env, key) && PLACEHOLDER_PATTERN.test(env[key])) issues.add(`invalid:${key}`);

  if (nonEmpty(env, 'Auth__SigningKey') && env.Auth__SigningKey.length < 40)
    issues.add('invalid:Auth__SigningKey');
  if (nonEmpty(env, 'Mail__Port') && !positivePort(env.Mail__Port))
    issues.add('invalid:Mail__Port');
  if (nonEmpty(env, 'Mail__From') && !EMAIL_PATTERN.test(env.Mail__From.trim()))
    issues.add('invalid:Mail__From');
  if (nonEmpty(env, 'Mail__EnableSsl') && env.Mail__EnableSsl.trim().toLowerCase() !== 'true')
    issues.add('invalid:Mail__EnableSsl');
  if (nonEmpty(env, 'Mail__User') || nonEmpty(env, 'Mail__Password')) {
    if (!nonEmpty(env, 'Mail__User')) issues.add('missing:Mail__User');
    if (!nonEmpty(env, 'Mail__Password')) issues.add('missing:Mail__Password');
  }

  for (const key of ['Payments__PublicBaseUrl', 'Payments__WebBaseUrl'])
    if (nonEmpty(env, key)) requirePublicUrl(key);

  for (const [provider, path] of [['Wechat', 'wechat'], ['Alipay', 'alipay']]) {
    const key = `Payments__${provider}__NotifyUrl`;
    let notifyUrl;
    if (nonEmpty(env, key)) {
      notifyUrl = env[key];
    } else if (nonEmpty(env, 'Payments__PublicBaseUrl')) {
      const base = env.Payments__PublicBaseUrl.trim().replace(/\/+$/, '');
      notifyUrl = `${base}/api/payments/${path}/notify`;
    }
    if (notifyUrl) {
      requirePublicUrl(key, notifyUrl);
      if (securePublicUrl(env.Payments__PublicBaseUrl) && securePublicUrl(notifyUrl)) {
        const apiOrigin = new URL(env.Payments__PublicBaseUrl).origin;
        const callback = new URL(notifyUrl);
        if (callback.origin !== apiOrigin
          || !callback.pathname.endsWith(`/api/payments/${path}/notify`))
          issues.add(`invalid:${key}`);
      }
    }
  }

  requirePrivateKey('Payments__Wechat__PrivateKeyPem');
  if (nonEmpty(env, 'Payments__Wechat__ApiV3Key')
    && Buffer.byteLength(env.Payments__Wechat__ApiV3Key, 'utf8') !== 32)
    issues.add('invalid:Payments__Wechat__ApiV3Key');

  const certificates = Object.keys(env).filter(key => key.startsWith(CERTIFICATE_PREFIX));
  if (!certificates.some(key => nonEmpty(env, key))) {
    issues.add(`missing:${CERTIFICATE_PREFIX}<serial>`);
  } else {
    for (const key of certificates)
      if (nonEmpty(env, key)) requirePem(key, 'CERTIFICATE');
  }

  requirePrivateKey('Payments__Alipay__PrivateKeyPem');
  requireAlipayGateway();
  if (nonEmpty(env, 'Payments__Alipay__AlipayPublicKeyPem')
    && !pemHasMarkers(env.Payments__Alipay__AlipayPublicKeyPem, 'PUBLIC KEY')
    && !pemHasMarkers(env.Payments__Alipay__AlipayPublicKeyPem, 'RSA PUBLIC KEY'))
    issues.add('invalid:Payments__Alipay__AlipayPublicKeyPem');

  if (nonEmpty(env, 'Legal__Ready') && env.Legal__Ready.trim().toLowerCase() !== 'true')
    issues.add('invalid:Legal__Ready');
  if (nonEmpty(env, 'Legal__ContactEmail')
    && !EMAIL_PATTERN.test(env.Legal__ContactEmail.trim()))
    issues.add('invalid:Legal__ContactEmail');

  const sortedIssues = [...issues].sort();
  return { ready: sortedIssues.length === 0, issues: sortedIssues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkProductionReadiness();
  if (result.ready) {
    console.log('Production readiness checks passed.');
  } else {
    console.error(`Production readiness blocked: ${result.issues.join(', ')}`);
    process.exitCode = 1;
  }
}
