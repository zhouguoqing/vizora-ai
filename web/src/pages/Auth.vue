<script setup lang="ts">
import { useRoute } from 'vue-router';
import { Zap, ShieldCheck, Layers3, LayoutGrid, CreditCard } from 'lucide-vue-next';
import AuthForm from '../components/AuthForm.vue';
const route = useRoute();
</script>
<template>
  <section class="auth-page space-section"><div class="container auth-grid">
    <div class="auth-story"><span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>从想法到应用，<br /><span class="gradient-text">只差一次登录。</span></h1><p>Vizora AI 基于 FDE 理念，让 AI 原生团队更快地将想法变为可落地的应用。<br />从数据到决策，从概念到业务价值。</p>
      <div class="auth-perks"><div><Zap :size="30" />AI 原生生产力<span>以业务需求为起点</span></div><div><ShieldCheck :size="30" />安全账号与接入<span>邮箱验证 · 短效票据</span></div><div><Layers3 :size="30" />专注项目交付<span>让每个想法有迹可循</span></div></div>
      <img class="product-illustration" src="/brand/product-preview.webp" width="421" height="275" alt="Vizora AI 高保真产品界面设计参考" /><p class="illustration-caption">产品界面设计参考，实际应用在独立 Designer 中构建</p>
    </div>
    <div><div class="auth-mobile-tabs" aria-label="账号操作"><router-link :to="{ path: '/login', query: route.query }">账号登录</router-link><router-link :to="{ path: '/register', query: route.query }">免费注册</router-link></div>
      <div class="auth-forms"><section class="auth-card" :class="{ 'mobile-hidden': route.path !== '/login' }" aria-label="登录表单"><h2>登录</h2><p>欢迎回来，继续在 Vizora AI 构建更强大的应用</p><AuthForm mode="login" /><div class="auth-unavailable">当前支持邮箱密码登录<br />微信登录与企业 SSO 为规划能力，暂未开放</div><div class="auth-switch">没有账号？ <router-link :to="{ path: '/register', query: route.query }">立即免费注册</router-link></div></section>
        <section class="auth-card" :class="{ 'mobile-hidden': route.path !== '/register' }" aria-label="注册表单"><h2>免费注册</h2><p>开启 Vizora AI，创建你的第一个可视化应用项目</p><AuthForm mode="register" /><div class="auth-unavailable">注册后需验证邮箱，才能登录<br />手机号注册与企业 SSO 暂未开放</div><div class="auth-switch">已有账号？ <router-link :to="{ path: '/login', query: route.query }">立即登录</router-link></div></section>
      </div>
      <div class="auth-after"><h3>登录后可进入</h3><div class="grid3"><div class="tile"><LayoutGrid :size="25" /><strong>我的项目</strong><p>创建、管理项目并打开独立 Designer。</p></div><div class="tile"><Layers3 :size="25" /><strong>场景灵感</strong><p>从场景描述出发，整理应用需求。</p></div><div class="tile"><CreditCard :size="25" /><strong>会员与订单</strong><p>查看套餐期限、购买与支付状态。</p></div></div></div>
      <p class="muted tiny" style="margin:18px 5px">正式公开注册前，运营方须完成法律文件审核及邮箱服务验收。</p>
    </div>
  </div></section>
</template>
