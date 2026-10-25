import { reactive } from 'vue';

export interface Plan {
  code: string;
  name: string;
  price_fen: number;
  duration_days: number;
  project_limit: number | null;
}
export interface Membership {
  plan_code: string;
  valid_until: string | null;
  project_limit?: number | null;
  active?: boolean;
}
export interface Account {
  id?: string;
  email: string;
  display_name?: string;
  membership: Membership | null;
  project_limit?: number | null;
}
export interface Project {
  id: string;
  title: string;
  prompt: string;
  created_at: string;
}
export type OrderStatus = 'pending' | 'paid' | 'closed' | 'refunding' | 'refunded';
export interface Order {
  id: string;
  order_no: string;
  plan_code: string;
  amount_fen: number;
  provider: 'wechat' | 'alipay';
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  expires_at?: string;
  code_url?: string | null;
  checkout_url?: string | null;
  entitlement_review_required?: boolean;
}
export interface Checkout {
  id: string;
  orderNo: string;
  amountFen: number;
  payUrl: string;
  expiresAt?: string;
}
export class ApiError extends Error {
  constructor(public status: number, message: string, public staleSession = false) {
    super(message);
    this.name = 'ApiError';
  }
}

const stored = localStorage.getItem('vizora_token') || sessionStorage.getItem('vizora_token') || '';
export const session = reactive({ token: stored, email: '' });

export function setToken(token: string, remember = true) {
  session.token = token;
  localStorage.removeItem('vizora_token');
  sessionStorage.removeItem('vizora_token');
  if (token) (remember ? localStorage : sessionStorage).setItem('vizora_token', token);
  else session.email = '';
}

export async function api<T = unknown>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const requestToken = session.token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('/api' + path, {
      method,
      headers: {
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(requestToken ? { Authorization: 'Bearer ' + requestToken } : {}),
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = response.status === 401 ? '登录已失效，请重新登录。'
        : response.status === 429 ? '操作过于频繁，请稍后再试。' : `请求失败（${response.status}）`;
      const text = await response.text();
      if (text) {
        try {
          const body: unknown = JSON.parse(text);
          if (body && typeof body === 'object') {
            for (const key of ['error', 'detail', 'title']) {
              const value = Reflect.get(body, key);
              if (typeof value === 'string' && value) { message = value; break; }
            }
          }
        } catch {
          // Non-JSON gateway errors must not render HTML or leak infrastructure details.
          console.error('API returned a non-JSON error', path, response.status);
        }
      }
      const staleSession = response.status === 401 && session.token !== requestToken;
      if (response.status === 401 && !staleSession) setToken('');
      throw new ApiError(response.status, message, staleSession);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('请求超时，请检查网络后重试。');
    if (error instanceof TypeError) throw new Error('无法连接服务，请检查网络或稍后重试。');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function money(fen: number) {
  return '¥' + (fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。';
}
export function projectQuota(account?: Account) {
  if (account?.project_limit !== undefined) return account.project_limit === null ? -1 : account.project_limit;
  if (account?.membership?.project_limit === null) return -1;
  return account?.membership?.project_limit ?? 3;
}
export function safeRedirect(value: unknown, fallback = '/workspace') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    && !value.includes('\\') && !/[\r\n]/.test(value) ? value : fallback;
}
export const orderLabels: Record<OrderStatus, string> = {
  pending: '待支付', paid: '已支付', closed: '已关闭', refunding: '退款处理中', refunded: '已退款',
};
