import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkProductionReadiness } from '../scripts/production-readiness.mjs';
import { fileURLToPath } from 'node:url';

const pem = '-----BEGIN PRIVATE KEY-----\nredacted-test-material\n-----END PRIVATE KEY-----';
const certificate = '-----BEGIN CERTIFICATE-----\nredacted-test-material\n-----END CERTIFICATE-----';
const publicKey = '-----BEGIN PUBLIC KEY-----\nredacted-test-material\n-----END PUBLIC KEY-----';

function validEnvironment() {
  return {
    ASPNETCORE_ENVIRONMENT: 'Production',
    Auth__SigningKey: 's'.repeat(48),
    Mail__Host: 'smtp.example.test',
    Mail__Port: '587',
    Mail__User: 'mailer',
    Mail__Password: 'smtp-test-secret',
    Mail__From: 'no-reply@example.test',
    Mail__EnableSsl: 'true',
    Payments__PublicBaseUrl: 'https://api.example.test',
    Payments__WebBaseUrl: 'https://app.example.test',
    Payments__Wechat__MchId: 'merchant',
    Payments__Wechat__AppId: 'wechat-app',
    Payments__Wechat__SerialNo: 'merchant-key-serial',
    Payments__Wechat__PrivateKeyPem: pem,
    Payments__Wechat__ApiV3Key: 'w'.repeat(32),
    Payments__Wechat__PlatformCertificates__platform1: certificate,
    Payments__Wechat__NotifyUrl: 'https://api.example.test/api/payments/wechat/notify',
    Payments__Alipay__AppId: 'alipay-app',
    Payments__Alipay__PrivateKeyPem: pem,
    Payments__Alipay__AlipayPublicKeyPem: publicKey,
    Payments__Alipay__SellerId: 'seller',
    Payments__Alipay__Gateway: 'https://openapi.alipay.com/gateway.do',
    Payments__Alipay__NotifyUrl: 'https://api.example.test/api/payments/alipay/notify',
    Legal__Ready: 'true',
    Legal__OperatorName: 'Example Operator',
    Legal__ContactEmail: 'legal@example.test',
  };
}

test('complete production configuration passes readiness without returning values', () => {
  const result = checkProductionReadiness(validEnvironment());

  assert.deepEqual(result, { ready: true, issues: [] });
});

test('the API environment must be explicitly Production', () => {
  for (const [changes, expectedIssue] of [
    [{ ASPNETCORE_ENVIRONMENT: undefined }, 'missing:ASPNETCORE_ENVIRONMENT'],
    [{ ASPNETCORE_ENVIRONMENT: 'Development' }, 'invalid:ASPNETCORE_ENVIRONMENT'],
    [{ ASPNETCORE_ENVIRONMENT: 'Production ' }, 'invalid:ASPNETCORE_ENVIRONMENT'],
    [{ DOTNET_ENVIRONMENT: 'Development' }, 'invalid:DOTNET_ENVIRONMENT'],
  ]) {
    const env = validEnvironment();
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }

    const result = checkProductionReadiness(env);
    assert.equal(result.ready, false);
    assert.ok(result.issues.includes(expectedIssue));
  }
});

test('missing configuration is identified by setting name without exposing supplied values', () => {
  const env = validEnvironment();
  delete env.Payments__Wechat__MchId;
  delete env.Payments__Wechat__PrivateKeyPem;
  delete env.Payments__Alipay__Gateway;
  delete env.Payments__Alipay__AlipayPublicKeyPem;
  delete env.Mail__Host;
  env.Mail__Password = 'must-never-appear-in-diagnostics';

  const result = checkProductionReadiness(env);
  const report = JSON.stringify(result);

  assert.equal(result.ready, false);
  assert.ok(result.issues.includes('missing:Mail__Host'));
  assert.ok(result.issues.includes('missing:Payments__Wechat__MchId'));
  assert.ok(result.issues.includes('missing:Payments__Wechat__PrivateKeyPem'));
  assert.ok(result.issues.includes('missing:Payments__Alipay__Gateway'));
  assert.ok(result.issues.includes('missing:Payments__Alipay__AlipayPublicKeyPem'));
  assert.ok(!result.issues.includes('invalid:Payments__Wechat__PrivateKeyPem'));
  assert.ok(!result.issues.includes('invalid:Payments__Alipay__Gateway'));
  assert.ok(!report.includes(env.Mail__Password));
  assert.ok(!report.includes(env.Payments__Wechat__PrivateKeyPem));
});

test('loopback and non-HTTPS public or notification URLs fail closed', () => {
  const env = {
    ...validEnvironment(),
    Payments__PublicBaseUrl: 'http://localhost:8080',
    Payments__WebBaseUrl: 'https://app.example.test',
    Payments__Wechat__NotifyUrl: 'http://127.0.0.1:8080/api/payments/wechat/notify',
    Payments__Alipay__NotifyUrl: 'http://api.example.test/api/payments/alipay/notify',
  };

  const result = checkProductionReadiness(env);

  assert.equal(result.ready, false);
  assert.ok(result.issues.includes('invalid:Payments__PublicBaseUrl'));
  assert.ok(result.issues.includes('invalid:Payments__Wechat__NotifyUrl'));
  assert.ok(result.issues.includes('invalid:Payments__Alipay__NotifyUrl'));
});

test('merchant notifications must target the public API origin and implemented route', () => {
  for (const [provider, notifyUrl] of [
    ['Wechat', 'https://other.example.test/api/payments/wechat/notify'],
    ['Alipay', 'https://api.example.test/wrong/path'],
  ]) {
    const key = `Payments__${provider}__NotifyUrl`;
    const env = { ...validEnvironment(), [key]: notifyUrl };
    const result = checkProductionReadiness(env);
    assert.equal(result.ready, false, `${notifyUrl} must not pass`);
    assert.ok(result.issues.includes(`invalid:Payments__${provider}__NotifyUrl`));
  }
});

test('normalized IP literals and dotted localhost aliases are never public URLs', () => {
  for (const host of ['https://[::1]', 'https://localhost.', 'https://2130706433']) {
    const env = { ...validEnvironment(), Payments__PublicBaseUrl: host };
    const result = checkProductionReadiness(env);
    assert.equal(result.ready, false, `${host} must not pass as a public API base`);
    assert.ok(result.issues.includes('invalid:Payments__PublicBaseUrl'));
  }
});

test('malformed or non-public DNS hostnames are rejected', () => {
  for (const host of ['https://.', 'https://api', 'https://api..example.test']) {
    const env = { ...validEnvironment(), Payments__PublicBaseUrl: host };
    const result = checkProductionReadiness(env);
    assert.equal(result.ready, false, `${host} must not pass as a public API base`);
    assert.ok(result.issues.includes('invalid:Payments__PublicBaseUrl'));
  }
});

test('valid public base URLs supply the same default notification routes as the API', () => {
  const env = validEnvironment();
  delete env.Payments__Wechat__NotifyUrl;
  delete env.Payments__Alipay__NotifyUrl;

  assert.deepEqual(checkProductionReadiness(env), { ready: true, issues: [] });
});

test('Alipay gateway rejects non-HTTPS or untrusted hosts', () => {
  for (const gateway of [
    'http://attacker.example/gateway.do',
    'https://openapi.alipay.com:8443/gateway.do',
  ]) {
    const env = { ...validEnvironment(), Payments__Alipay__Gateway: gateway };
    const result = checkProductionReadiness(env);
    assert.equal(result.ready, false, `${gateway} must not pass`);
    assert.ok(result.issues.includes('invalid:Payments__Alipay__Gateway'));
  }
});

test('production TLS and legal readiness must be explicit', () => {
  const env = validEnvironment();
  delete env.Mail__EnableSsl;
  delete env.Legal__Ready;

  const result = checkProductionReadiness(env);

  assert.equal(result.ready, false);
  assert.ok(result.issues.includes('missing:Mail__EnableSsl'));
  assert.ok(result.issues.includes('missing:Legal__Ready'));
});

test('SMTP credentials are accepted only as a complete user/password pair', () => {
  const env = validEnvironment();
  delete env.Mail__Password;
  const result = checkProductionReadiness(env);

  assert.equal(result.ready, false);
  assert.ok(result.issues.includes('missing:Mail__Password'));

  const passwordOnly = validEnvironment();
  delete passwordOnly.Mail__User;
  const passwordWithoutUser = checkProductionReadiness(passwordOnly);
  assert.equal(passwordWithoutUser.ready, false);
  assert.ok(passwordWithoutUser.issues.includes('missing:Mail__User'));
});

test('invalid merchant keys, WeChat key length, and legal readiness are reported by name only', () => {
  const env = {
    ...validEnvironment(),
    Payments__Wechat__PrivateKeyPem: 'private-key-secret',
    Payments__Wechat__ApiV3Key: 'short',
    Payments__Wechat__PlatformCertificates__platform1: 'certificate-secret',
    Payments__Alipay__AlipayPublicKeyPem: 'public-key-secret',
    Legal__Ready: 'false',
  };

  const result = checkProductionReadiness(env);
  const report = JSON.stringify(result);

  assert.equal(result.ready, false);
  assert.ok(result.issues.includes('invalid:Payments__Wechat__PrivateKeyPem'));
  assert.ok(result.issues.includes('invalid:Payments__Wechat__ApiV3Key'));
  assert.ok(result.issues.includes('invalid:Payments__Wechat__PlatformCertificates__platform1'));
  assert.ok(result.issues.includes('invalid:Payments__Alipay__AlipayPublicKeyPem'));
  assert.ok(result.issues.includes('invalid:Legal__Ready'));
  for (const secret of ['private-key-secret', 'certificate-secret', 'public-key-secret'])
    assert.ok(!report.includes(secret));
});

test('template placeholders cannot satisfy production readiness', () => {
  const env = {
    ...validEnvironment(),
    Auth__SigningKey: 'REPLACE_WITH_A_LONG_RANDOM_SECRET_VALUE',
    Mail__Host: 'smtp.your-domain.example',
    Payments__Wechat__MchId: 'YOUR_MERCHANT_ID',
  };

  const result = checkProductionReadiness(env);

  assert.equal(result.ready, false);
  assert.ok(result.issues.includes('invalid:Auth__SigningKey'));
  assert.ok(result.issues.includes('invalid:Mail__Host'));
  assert.ok(result.issues.includes('invalid:Payments__Wechat__MchId'));
  assert.ok(!JSON.stringify(result).includes('YOUR_MERCHANT_ID'));
});

test('command-line failure reports setting names but never environment values', () => {
  const key = 'do-not-print-this-signing-key';
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../scripts/production-readiness.mjs', import.meta.url)),
  ], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, Auth__SigningKey: key, Mail__Password: 'do-not-print-this-password' },
  });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 1);
  assert.match(output, /missing:Mail__Host/);
  assert.ok(!output.includes(key));
  assert.ok(!output.includes('do-not-print-this-password'));
});
