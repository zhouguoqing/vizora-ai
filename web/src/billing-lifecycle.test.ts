import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { computed, ref, type Ref } from 'vue';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Checkout, Order, OrderStatus, Plan } from './api';

interface BillingHarness {
  checkout: Ref<Checkout | undefined>;
  checkoutStatus: Ref<OrderStatus>;
  detail: Ref<Order | undefined>;
  detailError: Ref<string>;
  error: Ref<string>;
  plans: Ref<Plan[]>;
  selected: Ref<string>;
  querying: Ref<boolean>;
  account: Ref<Account | undefined>;
  tierConflict: Ref<boolean>;
  checkoutNeedsReview: Ref<boolean>;
  message: Ref<string>;
  refresh(reconcile?: boolean): Promise<void>;
  resume(order: Order): Promise<void>;
  createCheckout(): Promise<void>;
  showDetail(order: Order): Promise<void>;
  closeDetail(): void;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function order(id: string, status: OrderStatus = 'pending'): Order {
  return { id, order_no: id, plan_code: 'creator-month', amount_fen: 9900, provider: 'wechat', status, created_at: new Date().toISOString(), paid_at: null, code_url: 'weixin://wxpay/bizpayurl?pr=' + id };
}
function harness(api: (path: string, method?: string) => Promise<unknown>) {
  let unmount = () => {};
  const source = readFileSync(new URL('./pages/Billing.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1];
  if (!source) throw new Error('Billing script not found');
  const exports = 'export {checkout,checkoutStatus,detail,detailError,error,plans,selected,querying,account,tierConflict,checkoutNeedsReview,message,refresh,resume,createCheckout,showDetail,closeDetail};';
  const compiled = ts.transpileModule(source + exports, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  class TestApiError extends Error { constructor(public status: number, message: string, public staleSession = false) { super(message); } }
  const module = { exports: {} };
  const tab = { opener: null, close: vi.fn(), location: { replace: vi.fn() } };
  runInNewContext(compiled, {
    exports: module.exports, module,
    require(name: string) {
      if (name === 'vue') return { ref, computed, onMounted: () => {}, onBeforeUnmount: (fn: () => void) => { unmount = fn; } };
      if (name === 'vue-router') return { useRoute: () => ({ fullPath: '/billing', query: {} }), useRouter: () => ({ replace: vi.fn() }) };
      if (name === 'qrcode') return { toDataURL: async () => 'data:image/png;base64,test' };
      if (name === '../api') return { api, ApiError: TestApiError, errorMessage: (e: Error) => e.message };
      return {};
    },
    URL, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval,
    window: { open: () => tab }, document: { visibilityState: 'visible' },
    sessionStorage: { getItem: () => '', setItem: () => {} },
  });
  return { state: module.exports as BillingHarness, unmount: () => unmount(), tab };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('billing asynchronous lifecycle regression', () => {
  it('blocks active cross-tier purchases before opening a payment window or sending a request', async () => {
    const api = vi.fn();
    const { state, unmount, tab } = harness(api);
    state.account.value = { email: 'test@example.test', membership: { plan_code: 'creator-year', active: true, valid_until: new Date(Date.now() + 86400000).toISOString() } };
    state.plans.value = [{ code: 'fde-month', name: 'FDE', price_fen: 69900, duration_days: 30, project_limit: null }];
    state.selected.value = 'fde-month';
    await state.createCheckout();
    expect(api).not.toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(state.error.value).toContain('仅支持同档续期');
    unmount();
  });
  it('allows monthly/yearly renewal within a tier and allows a new tier after expiry', () => {
    const { state, unmount } = harness(vi.fn());
    state.account.value = { email: 'test@example.test', membership: { plan_code: 'creator-month', active: true, valid_until: new Date(Date.now() + 86400000).toISOString() } };
    state.plans.value = [
      { code: 'creator-year', name: 'Creator', price_fen: 95000, duration_days: 365, project_limit: 10 },
      { code: 'fde-month', name: 'FDE', price_fen: 69900, duration_days: 30, project_limit: null },
    ];
    state.selected.value = 'creator-year';
    expect(state.tierConflict.value).toBe(false);
    state.selected.value = 'fde-month';
    expect(state.tierConflict.value).toBe(true);
    state.account.value.membership!.active = false;
    expect(state.tierConflict.value).toBe(false);
    unmount();
  });
  it('never describes a paid order pending entitlement review as an activated membership', async () => {
    const api = vi.fn((path: string): Promise<unknown> => Promise.resolve(path === '/orders/A/reconcile'
      ? { status: 'paid', entitlement_review_required: true }
      : path === '/me' ? { email: 'test@example.test', membership: null } : []));
    const { state, unmount } = harness(api);
    state.checkout.value = { id: 'A', orderNo: 'A', amountFen: 69900, payUrl: 'weixin://wxpay/A' };
    await state.refresh(true);
    expect(state.checkoutNeedsReview.value).toBe(true);
    expect(state.message.value).toContain('待人工复核');
    expect(state.message.value).not.toContain('会员权益已生效');
    expect(vi.getTimerCount()).toBe(0);
    api.mockResolvedValueOnce(order('B'));
    await state.resume(order('B'));
    expect(state.checkoutNeedsReview.value).toBe(false);
    unmount();
  });
  it('never applies the result for order A to a newly selected order B', async () => {
    const oldQuery = deferred<Order>();
    const api = vi.fn((path: string) => path === '/orders/A' ? oldQuery.promise : Promise.resolve(order('B')));
    const { state, unmount } = harness(api);
    state.checkout.value = { id: 'A', orderNo: 'A', amountFen: 9900, payUrl: 'weixin://wxpay/A' };
    const pending = state.refresh(false);
    await state.resume(order('B'));
    oldQuery.resolve(order('A', 'paid'));
    await pending;
    expect(state.checkout.value?.id).toBe('B');
    expect(state.checkoutStatus.value).toBe('pending');
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('never installs polling when an order creation completes after unmount', async () => {
    const creation = deferred<Checkout>();
    const { state, unmount } = harness(() => creation.promise);
    state.plans.value = [{ code: 'creator-month', name: 'Creator', price_fen: 9900, duration_days: 30, project_limit: 10 }];
    state.selected.value = 'creator-month';
    const pending = state.createCheckout();
    unmount();
    creation.resolve({ id: 'A', orderNo: 'A', amountFen: 9900, payUrl: 'weixin://wxpay/A' });
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    expect(state.checkout.value).toBeUndefined();
  });
  it('never installs polling when resume completes after unmount', async () => {
    const result = deferred<Order>();
    const { state, unmount } = harness(() => result.promise);
    const pending = state.resume(order('A'));
    unmount(); result.resolve(order('A')); await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retries temporary query failures and resumes regular polling after recovery', async () => {
    const api = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(order('A'));
    const { state, unmount } = harness(api);
    state.checkout.value = { id: 'A', orderNo: 'A', amountFen: 9900, payUrl: 'weixin://wxpay/A' };
    await state.refresh(false);
    expect(state.error.value).toBe('offline');
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(api).toHaveBeenCalledTimes(2);
    expect(state.error.value).toBe('');
    expect(state.checkoutStatus.value).toBe('pending');
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });
  it('shows resume errors inside the open order dialog', async () => {
    const { state, unmount } = harness(() => Promise.reject(new Error('payment address unavailable')));
    state.detail.value = order('A');
    await state.resume(order('A'));
    expect(state.detail.value?.id).toBe('A');
    expect(state.detailError.value).toBe('payment address unavailable');
    unmount();
  });
  it('bounds automatic failures and lets manual verification restart polling', async () => {
    const api = vi.fn().mockRejectedValue(new Error('temporary outage'));
    const { state, unmount } = harness(api);
    state.checkout.value = { id: 'A', orderNo: 'A', amountFen: 9900, payUrl: 'weixin://wxpay/A' };
    await state.refresh(false);
    await vi.advanceTimersByTimeAsync(150000);
    expect(api).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
    expect(state.error.value).toContain('自动查询已暂停');
    api.mockResolvedValue(order('A'));
    await state.refresh(true);
    expect(state.error.value).toBe('');
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });
  it('does not reopen closed details when their request completes', async () => {
    const result = deferred<Order>();
    const { state, unmount } = harness(() => result.promise);
    const pending = state.showDetail(order('A'));
    state.closeDetail();
    result.resolve(order('A')); await pending;
    expect(state.detail.value).toBeUndefined();
    unmount();
  });
  it('does not replace newly opened details with an older request', async () => {
    const first = deferred<Order>();
    const { state, unmount } = harness(path => path.endsWith('/A') ? first.promise : Promise.resolve(order('B')));
    const old = state.showDetail(order('A'));
    await state.showDetail(order('B'));
    first.resolve(order('A')); await old;
    expect(state.detail.value?.id).toBe('B');
    unmount();
  });
});
