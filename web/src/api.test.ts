import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('sessionStorage', new MemoryStorage());
const { api, ApiError, money, projectQuota, safeRedirect, session, setToken } = await import('./api');

beforeEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', new MemoryStorage()); vi.stubGlobal('sessionStorage', new MemoryStorage()); setToken(''); });
describe('safe redirect', () => {
  it.each(['/workspace', '/billing?plan=fde-year', '/resources#designer'])('preserves same-origin path %s', path => { expect(safeRedirect(path)).toBe(path); });
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test', null, ['//evil.test']])('rejects unsafe redirect %s', path => { expect(safeRedirect(path)).toBe('/workspace'); });
});
describe('session storage', () => {
  it('only persists login when explicitly requested', () => {
    setToken('temporary', false);
    expect(sessionStorage.getItem('vizora_token')).toBe('temporary');
    expect(localStorage.getItem('vizora_token')).toBeNull();
    setToken('remembered', true);
    expect(localStorage.getItem('vizora_token')).toBe('remembered');
    expect(sessionStorage.getItem('vizora_token')).toBeNull();
    setToken('');
    expect(session.token).toBe('');
    expect(localStorage.getItem('vizora_token')).toBeNull();
  });
});
describe('typed API transport', () => {
  it('sends real endpoint shape and bearer header', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'saved' }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    setToken('unit-token', false);
    expect(await api('/dashboards', 'POST', { title: 'project' })).toEqual({ id: 'saved' });
    expect(fetcher).toHaveBeenCalledWith('/api/dashboards', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer unit-token' }, body: '{"title":"project"}' }));
  });
  it('surfaces server failures instead of returning fake data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"商户未配置"}', { status: 503 })));
    await expect(api('/orders', 'POST', {})).rejects.toThrow('商户未配置');
  });
  it('invalidates expired authentication', async () => {
    setToken('old', true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(session.token).toBe('');
    expect(localStorage.getItem('vizora_token')).toBeNull();
  });
  it('does not revoke a newer session when an old request returns 401', async () => {
    let respond: (response: Response) => void = () => { throw new Error('request not started'); };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { respond = resolve; })));
    setToken('old', false);
    const pending = api('/me');
    setToken('new', true);
    respond(new Response('', { status: 401 }));
    await expect(pending).rejects.toMatchObject({ status: 401, staleSession: true });
    expect(session.token).toBe('new');
    expect(localStorage.getItem('vizora_token')).toBe('new');
  });
  it('handles standard problem detail and empty deletion responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"detail":"邮箱未验证"}', { status: 403 })).mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(api('/auth/login', 'POST', {})).rejects.toThrow('邮箱未验证');
    expect(await api('/dashboards/id', 'DELETE')).toBeUndefined();
  });
  it('surfaces network and timeout failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/plans')).rejects.toThrow('无法连接服务');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(api('/plans')).rejects.toThrow('请求超时');
  });
  it('does not render gateway HTML as an error', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>upstream secret</html>', { status: 502 })));
    await expect(api('/orders')).rejects.toThrow('请求失败（502）');
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});
describe('money', () => {
  it.each([[0, '¥0'], [9900, '¥99'], [95000, '¥950'], [671000, '¥6,710'], [1, '¥0.01']])('renders %s fen exactly', (fen, expected) => { expect(money(Number(fen))).toBe(expected); });
});
describe('project quotas from actual API contracts', () => {
  it('interprets an explicit null limit as unlimited, not Free', () => {
    expect(projectQuota({ email: 'fde@example.test', membership: null, project_limit: null })).toBe(-1);
    expect(projectQuota({ email: 'fde@example.test', membership: { plan_code: 'fde-month', valid_until: null, project_limit: null } })).toBe(-1);
  });
  it('keeps the Free and Creator limits returned by the server', () => {
    expect(projectQuota({ email: 'free@example.test', membership: null, project_limit: 3 })).toBe(3);
    expect(projectQuota({ email: 'creator@example.test', membership: null, project_limit: 10 })).toBe(10);
    expect(projectQuota({ email: 'expired@example.test', project_limit: 3, membership: { plan_code: 'fde-month', valid_until: '2020-01-01', project_limit: null } })).toBe(3);
    expect(projectQuota()).toBe(3);
  });
});
