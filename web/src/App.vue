<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Menu, X, ArrowUpRight, LogOut } from 'lucide-vue-next';
import { api, errorMessage, session, setToken } from './api';
import BrandLogo from './components/BrandLogo.vue';
const router = useRouter();
const route = useRoute();
const mobile = ref(false);
const logoutError = ref('');
const loggingOut = ref(false);
const authPage = computed(() => ['/login', '/register'].includes(route.path));
const standaloneHome = computed(() => route.path === '/home-v2');
const links = [['/features', '产品能力'], ['/solutions', '应用场景'], ['/templates', '模板市场'], ['/pricing', '价格方案'], ['/resources', '资源中心'], ['/contact', '联系我们']];
watch(() => route.fullPath, () => { mobile.value = false; logoutError.value = ''; });
async function logout() {
  loggingOut.value = true;
  try { await api('/auth/logout-all', 'POST'); setToken(''); await router.push('/'); }
  catch (error) { logoutError.value = errorMessage(error); }
  finally { loggingOut.value = false; }
}
</script>
<template>
  <a href="#main-content" class="skip-link">跳转到主要内容</a>
  <header v-if="!standaloneHome" class="nav">
    <div class="navinner">
      <router-link to="/" aria-label="Vizora AI 首页"><BrandLogo /></router-link>
      <span v-if="authPage" class="auth-location">/ 账号{{ route.path === '/register' ? '注册' : '登录' }}</span>
      <nav v-if="!authPage" id="main-nav" :class="{ open: mobile }" aria-label="主导航">
        <router-link v-for="link in links" :key="link[0]" :to="link[0]">{{ link[1] }}</router-link>
      </nav>
      <div class="nav-actions">
        <template v-if="authPage"><router-link to="/">返回首页</router-link><router-link to="/contact">联系销售</router-link></template>
        <template v-else-if="session.token">
          <router-link class="ghost button small" to="/workspace">工作台</router-link>
          <router-link class="account-link" to="/billing">会员订单</router-link>
          <button class="icon-button" :disabled="loggingOut" aria-label="退出全部登录会话" @click="logout"><LogOut :size="18" /></button>
        </template>
        <template v-else><router-link class="ghost button small login-link" to="/login">登录</router-link><router-link class="button small" to="/register">免费开始 <ArrowUpRight :size="16" /></router-link></template>
        <button v-if="!authPage" class="icon-button mobile-menu" :aria-expanded="mobile" aria-controls="main-nav" :aria-label="mobile ? '关闭导航菜单' : '打开导航菜单'" @click="mobile = !mobile" @keydown.esc="mobile = false"><X v-if="mobile" /><Menu v-else /></button>
      </div>
    </div>
  </header>
  <p v-if="logoutError" class="global-error error" role="alert">{{ logoutError }}</p>
  <main id="main-content" tabindex="-1"><router-view v-slot="{ Component }"><transition name="page" mode="out-in"><component :is="Component" :key="route.path" /></transition></router-view></main>
  <footer v-if="!authPage && !standaloneHome" class="footer">
    <div class="container footgrid">
      <div><router-link to="/" aria-label="Vizora AI 首页"><BrandLogo /></router-link><p>You Imagine It. Vizora Builds It.</p><p>面向 FDE 与 AI 原生组织的<br />可视化应用创建与交付平台。</p><span class="footer-status"><i /> 从想法，走向真实业务</span></div>
      <div><h3>产品</h3><router-link to="/features">产品能力</router-link><router-link to="/solutions">应用场景</router-link><router-link to="/templates">模板市场</router-link><router-link to="/pricing">价格方案</router-link></div>
      <div><h3>资源</h3><router-link to="/resources">帮助与文档</router-link><router-link to="/resources#designer">Designer 集成</router-link><router-link to="/workspace">应用工作台</router-link><router-link to="/billing">会员与订单</router-link></div>
      <div><h3>与我们联系</h3><router-link to="/contact">预约产品演示 ↗</router-link><router-link to="/contact">企业定制与私有化</router-link><router-link to="/terms">服务协议</router-link><router-link to="/privacy">隐私政策</router-link></div>
    </div>
    <div class="container fineprint"><span>© {{ new Date().getFullYear() }} Vizora AI. All rights reserved.</span><span>规划能力以功能标识为准 · 运营主体与法务信息待正式审核</span></div>
  </footer>
</template>
