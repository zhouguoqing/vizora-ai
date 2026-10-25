<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUpRight, ChevronRight, CreditCard, RefreshCw, ShieldCheck } from 'lucide-vue-next';
import QRCode from 'qrcode';
import { api, ApiError, errorMessage, money, orderLabels, projectQuota, type Account, type Checkout, type Order, type OrderStatus, type Plan } from '../api';
import PageState from '../components/PageState.vue';
import AppDialog from '../components/AppDialog.vue';
const route = useRoute();
const router = useRouter();
const orders = ref<Order[]>([]);
const plans = ref<Plan[]>([]);
const account = ref<Account>();
const selected = ref(typeof route.query.plan === 'string' ? route.query.plan : sessionStorage.getItem('vizora_selected_plan') || 'creator-month');
const provider = ref<'wechat' | 'alipay'>('wechat');
const loading = ref(true);
const loadError = ref('');
const error = ref('');
const message = ref('');
const busy = ref(false);
const querying = ref(false);
const checkout = ref<Checkout>();
const checkoutProvider = ref<'wechat' | 'alipay'>('wechat');
const qr = ref('');
const checkoutStatus = ref<OrderStatus>('pending');
const checkoutNeedsReview = ref(false);
const detail = ref<Order>();
const detailsLoading = ref(false);
const detailError = ref('');
const resuming = ref(false);
const timerNow = ref(Date.now());
let timer: ReturnType<typeof setTimeout> | undefined;
let clock: ReturnType<typeof setInterval> | undefined;
let alive = true;
let checkoutGeneration = 0;
let detailGeneration = 0;
let pollFailures = 0;
const plan = computed(() => plans.value.find(p => p.code === selected.value));
const projectLimit = computed(() => projectQuota(account.value));
const membershipActive = computed(() => {
  const membership = account.value?.membership;
  return !!membership && (membership.active ?? Date.parse(membership.valid_until || '') > Date.now());
});
function differentTier(code: string) {
  return membershipActive.value &&
    account.value?.membership?.plan_code.replace(/-(month|year)$/, '') !== code.replace(/-(month|year)$/, '');
}
const tierConflict = computed(() => !!plan.value && differentTier(plan.value.code));
const remaining = computed(() => {
  if (!checkout.value?.expiresAt) return '';
  const seconds = Math.max(0, Math.floor((Date.parse(checkout.value.expiresAt) - timerNow.value) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
});
function stopPolling() { if (timer) clearTimeout(timer); timer = undefined; }
function schedulePolling() {
  stopPolling();
  if (!alive || !checkout.value || checkoutStatus.value !== 'pending' || pollFailures >= 6) return;
  timer = setTimeout(() => {
    if (document.visibilityState === 'visible') void refresh(false);
    else schedulePolling();
  }, Math.min(30000, 5000 * 2 ** Math.min(pollFailures, 3)));
}
function closeDetail() { detailGeneration++; detail.value = undefined; }
async function handleError(e: unknown) {
  if (!alive) return;
  if (e instanceof ApiError && e.status === 401 && !e.staleSession) await router.replace({ path: '/login', query: { redirect: route.fullPath } });
  else error.value = errorMessage(e);
}
async function load() {
  loading.value = true; loadError.value = '';
  try {
    const result = await Promise.all([api<Order[]>('/orders'), api<Plan[]>('/plans'), api<Account>('/me')]);
    if (!alive) return;
    orders.value = result[0];
    plans.value = result[1].filter(item => item.price_fen > 0 && item.duration_days > 0);
    account.value = result[2];
    if (!plans.value.some(p => p.code === selected.value)) selected.value = plans.value[0]?.code || '';
  } catch (e) {
    if (!alive) return;
    if (e instanceof ApiError && e.status === 401) await handleError(e);
    else loadError.value = errorMessage(e);
  } finally { loading.value = false; }
}
function validPayUrl(value: string, method: 'wechat' | 'alipay') {
  const url = new URL(value);
  if (method === 'wechat') {
    if (url.protocol !== 'weixin:') throw new Error('支付服务返回了无效的微信支付地址，请联系支持。');
  } else if (url.protocol !== 'https:' || !(url.hostname === 'alipay.com' || url.hostname.endsWith('.alipay.com') || url.hostname === 'alipaydev.com' || url.hostname.endsWith('.alipaydev.com'))) throw new Error('支付服务返回了无效的支付宝地址，请联系支持。');
  return url.toString();
}
async function createCheckout() {
  if (busy.value || !plan.value) return;
  if (tierConflict.value) { error.value = '当前会员有效期内仅支持同档续期，请到期后再购买其他档位或联系支持。'; return; }
  busy.value = true; error.value = ''; message.value = ''; stopPolling();
  const generation = ++checkoutGeneration;
  querying.value = false; pollFailures = 0;
  const paymentProvider = provider.value;
  let paymentTab: Window | null = null;
  if (provider.value === 'alipay') {
    paymentTab = window.open('about:blank', '_blank');
    if (paymentTab) paymentTab.opener = null;
  }
  try {
    const created = await api<Checkout>('/orders', 'POST', { planCode: selected.value, provider: paymentProvider });
    if (!alive || generation !== checkoutGeneration) { paymentTab?.close(); return; }
    const url = validPayUrl(created.payUrl, paymentProvider);
    const image = paymentProvider === 'wechat' ? await QRCode.toDataURL(url, { width: 400, margin: 2, errorCorrectionLevel: 'M' }) : '';
    if (!alive || generation !== checkoutGeneration) { paymentTab?.close(); return; }
    checkout.value = created; checkoutProvider.value = paymentProvider; checkoutStatus.value = 'pending'; checkoutNeedsReview.value = false; qr.value = image;
    if (paymentProvider === 'alipay') {
      if (paymentTab) paymentTab.location.replace(url);
      else message.value = '浏览器阻止了新窗口，请使用下方按钮打开支付宝。';
    }
    sessionStorage.setItem('vizora_selected_plan', selected.value);
    await load();
    if (alive && generation === checkoutGeneration) schedulePolling();
  } catch (e) { paymentTab?.close(); if (alive && generation === checkoutGeneration) { await handleError(e); await load(); } }
  finally { busy.value = false; }
}
async function refresh(reconcile = true) {
  if (!checkout.value || querying.value || checkoutStatus.value !== 'pending') return;
  const id = checkout.value.id;
  const generation = checkoutGeneration;
  const current = () => alive && generation === checkoutGeneration && checkout.value?.id === id;
  querying.value = true; error.value = ''; stopPolling();
  let retry = true;
  try {
    const result = reconcile
      ? await api<{ status: OrderStatus; entitlement_review_required?: boolean }>('/orders/' + id + '/reconcile', 'POST')
      : await api<Order>('/orders/' + id);
    if (!current()) return;
    pollFailures = 0;
    checkoutStatus.value = result.status;
    checkoutNeedsReview.value = !!result.entitlement_review_required;
    if (result.status !== 'pending') {
      stopPolling(); await load();
      if (!current()) return;
      message.value = result.entitlement_review_required ? '款项状态已确认，会员权益待人工复核。原有会员不会因跨档付款被覆盖，请联系支持并勿重复付款。'
        : result.status === 'paid' ? '付款已由服务端确认，会员权益已生效。' : `订单${orderLabels[result.status]}。`;
    } else if (reconcile) message.value = '商户暂未确认付款，请完成支付后稍候查询。';
  } catch (e) {
    if (!current()) return;
    pollFailures++;
    retry = !(e instanceof ApiError && [401, 403, 404].includes(e.status));
    await handleError(e);
    if (pollFailures >= 6) error.value += ' 自动查询已暂停，请手动重试；请勿重复付款。';
  } finally {
    if (current()) { querying.value = false; if (retry) schedulePolling(); }
  }
}
async function showDetail(order: Order) {
  const generation = ++detailGeneration;
  detail.value = order; detailsLoading.value = true; detailError.value = '';
  try {
    const result = await api<Order>('/orders/' + order.id);
    if (alive && generation === detailGeneration && detail.value?.id === order.id) detail.value = result;
  } catch (e) { if (alive && generation === detailGeneration) detailError.value = errorMessage(e); }
  finally { if (alive && generation === detailGeneration) detailsLoading.value = false; }
}
async function resume(order: Order) {
  if (resuming.value || busy.value) return;
  resuming.value = true; detailError.value = '';
  const generation = ++checkoutGeneration;
  querying.value = false; pollFailures = 0;
  error.value = ''; stopPolling();
  try {
    const fresh = await api<Order>('/orders/' + order.id);
    if (!alive || generation !== checkoutGeneration) return;
    if (fresh.status !== 'pending') { detail.value = fresh; await load(); return; }
    if (differentTier(fresh.plan_code)) throw new Error('当前会员有效期内不能继续支付异档订单。请联系支持核实，勿重复付款。');
    const payUrl = fresh.provider === 'wechat' ? fresh.code_url : fresh.checkout_url;
    if (!payUrl) throw new Error('订单尚未取得可用支付地址，请联系支持核实，不要重复付款。');
    const url = validPayUrl(payUrl, fresh.provider);
    const image = fresh.provider === 'wechat' ? await QRCode.toDataURL(url, { width: 400, margin: 2 }) : '';
    if (!alive || generation !== checkoutGeneration) return;
    checkout.value = { id: fresh.id, orderNo: fresh.order_no, amountFen: fresh.amount_fen, payUrl: url, expiresAt: fresh.expires_at };
    checkoutProvider.value = fresh.provider; checkoutStatus.value = fresh.status; checkoutNeedsReview.value = !!fresh.entitlement_review_required;
    qr.value = image;
    closeDetail();
  } catch (e) {
    if (alive && generation === checkoutGeneration) {
      detailError.value = errorMessage(e);
      if (e instanceof ApiError && e.status === 401) await handleError(e);
    }
  } finally {
    if (alive && generation === checkoutGeneration) { resuming.value = false; schedulePolling(); }
  }
}
onMounted(() => { void load(); clock = setInterval(() => { timerNow.value = Date.now(); }, 1000); });
onBeforeUnmount(() => { alive = false; checkoutGeneration++; detailGeneration++; stopPolling(); if (clock) clearInterval(clock); });
</script>
<template>
  <section class="container workspace">
    <div class="toolbar"><div><span class="eyebrow">MEMBERSHIP & BILLING</span><h1>会员与订单</h1><p>管理会员期限、购买套餐与查看真实订单。</p></div><router-link class="button ghost" to="/workspace">返回工作台 <ArrowUpRight :size="15" /></router-link></div>
    <PageState v-if="loading || loadError" :loading="loading" :error="loadError" @retry="load" />
    <template v-else>
      <div class="account-cards"><div class="card"><h3>当前会员</h3><strong>{{ membershipActive ? account?.membership?.plan_code : 'Free' }}</strong><small>{{ account?.membership?.valid_until ? '到期时间：' + new Date(account.membership.valid_until).toLocaleString('zh-CN') : '免费体验，无需付款' }}</small></div><div class="card"><h3>项目配额</h3><strong>{{ projectLimit < 0 ? '不限' : projectLimit + ' 个' }}</strong><small>以服务端当前有效权益为准</small></div><div class="card"><h3>扣费方式</h3><strong>单次购买</strong><small>不自动续费、不自动扣款</small></div></div>
      <div class="checkout-grid">
        <section class="panel"><h2 style="font-size:23px">选择你的下一段创作旅程</h2><p class="muted tiny">微信 Native 扫码 / 支付宝电脑网站支付</p><form class="form" @submit.prevent="createCheckout">
          <label for="billing-plan">选择套餐</label>
          <select id="billing-plan" v-model="selected" :disabled="busy || checkoutStatus === 'pending' && !!checkout"><option v-for="p in plans" :key="p.code" :value="p.code">{{ p.name }} — {{ money(p.price_fen) }} / {{ p.duration_days }} 天</option></select>
          <p class="muted tiny">同档月付、年付可续期；有效期内暂不支持跨档购买，避免损失已有权益。</p>
          <p v-if="tierConflict" class="error" role="alert">当前会员有效期内仅支持同档续期，请选择当前档位，或到期后购买其他档位。</p>
          <span class="muted tiny" id="payment-method-label">支付方式</span>
          <div class="payment-methods" role="group" aria-labelledby="payment-method-label"><button type="button" :disabled="busy" :class="{ active: provider === 'wechat' }" :aria-pressed="provider === 'wechat'" @click="provider = 'wechat'">微信支付</button><button type="button" :disabled="busy" :class="{ active: provider === 'alipay' }" :aria-pressed="provider === 'alipay'" @click="provider = 'alipay'"><CreditCard :size="16" />支付宝</button></div><div class="checkout-summary"><span class="muted">应付金额</span><strong>{{ plan ? money(plan.price_fen) : '暂无套餐' }}</strong></div><button type="submit" :disabled="busy || !plan || tierConflict || checkoutStatus === 'pending' && !!checkout">{{ busy ? '正在创建真实订单…' : checkout && checkoutStatus === 'pending' ? '已有待支付订单，请先完成或等待关闭' : '创建订单并前往支付' }}</button></form><p class="muted tiny" style="margin:17px 0 0"><ShieldCheck :size="13" />支付金额由服务端确定，仅在商户确认成功后发放权益。</p></section>
        <section v-if="checkout" class="checkout-card" aria-live="polite"><h3>{{ checkoutNeedsReview ? '款项已确认，权益待复核' : checkoutStatus === 'paid' ? '付款成功' : checkoutStatus === 'closed' ? '订单已关闭' : checkoutProvider === 'wechat' ? '打开微信，扫一扫付款' : '前往支付宝完成付款' }}</h3><p>订单 {{ checkout.orderNo }}</p><strong class="price">{{ money(checkout.amountFen) }}</strong>
          <template v-if="checkoutStatus === 'pending'"><img v-if="qr" class="qr-image" :src="qr" width="220" height="220" alt="本订单的微信 Native 付款二维码" /><p v-if="remaining">有效期剩余 {{ remaining }}，过期后请重新创建订单</p><a v-if="checkoutProvider === 'alipay'" class="button" :href="checkout.payUrl" target="_blank" rel="noopener noreferrer" style="margin-block:20px">打开支付宝 <ArrowUpRight :size="15" /></a><button class="ghost" :disabled="querying" @click="refresh(true)"><RefreshCw :size="15" :class="{ spin: querying }" />{{ querying ? '正在向商户核实…' : '我已支付，查询到账' }}</button><p class="tiny">请勿向他人转发二维码；不要重复支付。网络查询失败不代表未付款。</p></template><span v-else class="status" :class="checkoutStatus">{{ orderLabels[checkoutStatus] }}</span>
        </section>
        <aside v-else class="tile"><span class="feature-icon"><CreditCard :size="23" /></span><h3>支付过程中的每一步，都有迹可循</h3><p>订单、支付渠道与会员期限均来自真实服务端。商户未配置时会明确报错，不展示假付款成功。</p><p>退款需要人工审核与商户核对。组织席位、应用运行和发票属于规划能力。</p><router-link class="link-arrow" to="/contact">需要企业方案或账单帮助？</router-link></aside>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="message" class="success" role="status">{{ message }}</p>
      <section class="section"><div class="toolbar"><h2>最近订单</h2><button class="ghost small" @click="load"><RefreshCw :size="14" />刷新列表</button></div><div v-if="orders.length" class="order-list"><button v-for="order in orders" :key="order.id" class="order-row" @click="showDetail(order)"><span><strong>{{ order.order_no }}</strong><small>{{ order.plan_code }} · {{ new Date(order.created_at).toLocaleString('zh-CN') }}</small></span><span>{{ money(order.amount_fen) }}</span><span class="status" :class="order.status">{{ orderLabels[order.status] }}</span><ChevronRight :size="16" /></button></div><PageState v-else empty="暂无订单"><p>选择适合你的套餐，订单将在这里显示。</p></PageState></section>
    </template>
    <AppDialog :open="!!detail" title="订单详情" :busy="resuming" @close="closeDetail">
      <PageState v-if="detailsLoading" loading />
      <template v-else-if="detail">
        <p v-if="detailError" class="error" role="alert">{{ detailError }}</p>
        <p v-if="detail.entitlement_review_required" class="error" role="status">此订单的会员权益待人工复核。原有会员不会被跨档付款覆盖，请联系订单帮助，勿重复付款。</p>
        <p v-if="detail.status === 'pending' && differentTier(detail.plan_code)" class="error" role="alert">当前会员有效期内不能继续支付异档订单，请联系支持核实。</p>
        <dl class="order-detail"><dt>订单编号</dt><dd>{{ detail.order_no }}</dd><dt>套餐</dt><dd>{{ detail.plan_code }}</dd><dt>支付金额</dt><dd>{{ money(detail.amount_fen) }}</dd><dt>支付渠道</dt><dd>{{ detail.provider === 'wechat' ? '微信支付' : '支付宝' }}</dd><dt>订单状态</dt><dd><span class="status" :class="detail.status">{{ orderLabels[detail.status] }}</span></dd><dt>创建时间</dt><dd>{{ new Date(detail.created_at).toLocaleString('zh-CN') }}</dd><dt>付款时间</dt><dd>{{ detail.paid_at ? new Date(detail.paid_at).toLocaleString('zh-CN') : '尚未付款' }}</dd></dl>
        <div class="modal-actions"><router-link class="button ghost" to="/contact" @click="closeDetail">订单帮助</router-link><button v-if="detail.status === 'pending'" :disabled="resuming || differentTier(detail.plan_code)" @click="resume(detail)">{{ resuming ? '正在恢复支付…' : '继续支付' }}</button></div>
      </template>
    </AppDialog>
  </section>
</template>
