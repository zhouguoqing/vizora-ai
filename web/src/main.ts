import { createApp, nextTick } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import { session } from './api';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to) {
    return to.hash ? { el: to.hash, top: 90, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' } : { top: 0 };
  },
  routes: [
    { path: '/', component: () => import('./pages/Home.vue'), meta: { title: '从想法到可视化应用' } },
    { path: '/home-v2', component: () => import('./pages/HomeV2.vue'), meta: {
      title: 'AI 大屏设计与开发',
      description: 'Vizora AI，以自然语言描述大屏需求，从经营驾驶舱、设备监控到项目交付看板，通过项目工作台连接独立 Designer，开展 AI 大屏设计与开发。',
      themeColor: '#f6f9f6',
    } },
    { path: '/features', component: () => import('./pages/Features.vue'), meta: { title: '产品能力' } },
    { path: '/solutions', component: () => import('./pages/Solutions.vue'), meta: { title: '应用场景' } },
    { path: '/templates', component: () => import('./pages/Templates.vue'), meta: { title: '模板市场' } },
    { path: '/resources', component: () => import('./pages/Resources.vue'), meta: { title: '资源中心' } },
    { path: '/contact', component: () => import('./pages/Contact.vue'), meta: { title: '联系销售' } },
    { path: '/pricing', component: () => import('./pages/Pricing.vue'), meta: { title: '价格方案' } },
    { path: '/login', component: () => import('./pages/Auth.vue'), meta: { title: '账号登录' } },
    { path: '/register', component: () => import('./pages/Auth.vue'), meta: { title: '免费注册' } },
    { path: '/verify-email', name: 'verify', component: () => import('./pages/AccountRecovery.vue'), meta: { title: '验证邮箱' } },
    { path: '/resend-verification', name: 'resend', component: () => import('./pages/AccountRecovery.vue'), meta: { title: '重发验证' } },
    { path: '/forgot-password', name: 'forgot', component: () => import('./pages/AccountRecovery.vue'), meta: { title: '找回密码' } },
    { path: '/reset-password', name: 'reset', component: () => import('./pages/AccountRecovery.vue'), meta: { title: '重置密码' } },
    { path: '/workspace', component: () => import('./pages/Workspace.vue'), meta: { title: '我的工作台', auth: true } },
    { path: '/billing', component: () => import('./pages/Billing.vue'), meta: { title: '会员与订单', auth: true } },
    { path: '/terms', component: () => import('./pages/Legal.vue'), meta: { title: '服务协议' } },
    { path: '/privacy', component: () => import('./pages/Legal.vue'), meta: { title: '隐私政策' } },
    { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFound.vue'), meta: { title: '页面未找到' } },
  ],
});
router.beforeEach(to => to.meta.auth && !session.token
  ? { path: '/login', query: { redirect: to.fullPath } } : true);
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const defaultDescription = description?.content ?? '';
const defaultThemeColor = themeColor?.content ?? '#061328';
router.afterEach(async to => {
  document.title = `${String(to.meta.title || '可视化应用平台')} · Vizora AI`;
  if (description) description.content = typeof to.meta.description === 'string' ? to.meta.description : defaultDescription;
  if (themeColor) themeColor.content = typeof to.meta.themeColor === 'string' ? to.meta.themeColor : defaultThemeColor;
  await nextTick();
  document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
});
createApp(App).use(router).mount('#app');
