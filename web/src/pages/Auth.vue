<script setup lang="ts">
import { useRoute } from 'vue-router';
import { Zap, ShieldCheck, Layers3, LayoutGrid, CreditCard } from 'lucide-vue-next';
import AuthForm from '../components/AuthForm.vue';
const route = useRoute();
</script>
<template>
  <section class="auth-page v3-auth-page"><div class="container auth-grid">
    <div class="auth-story"><span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>从想法到应用，<br /><span class="gradient-text">只差一次登录。</span></h1><p>Vizora AI 基于 FDE 理念，让 AI 原生团队更快地将想法变为可落地的应用。<br />从数据到决策，从概念到业务价值。</p>
      <div class="auth-perks"><div><Zap :size="30" />AI 原生生产力<span>以业务需求为起点</span></div><div><ShieldCheck :size="30" />安全账号与接入<span>邮箱验证 · 短效票据</span></div><div><Layers3 :size="30" />专注项目交付<span>让每个想法有迹可循</span></div></div>
      <div class="v3-auth-preview" role="img" aria-label="区域经营看板概念示意，不含实时业务数据">
        <div class="v3-auth-preview-head"><strong>区域经营概览</strong><span>概念示意 · 非实时数据</span></div>
        <div class="v3-auth-preview-metrics"><div><span>核心指标</span><strong>经营表现</strong></div><div><span>业务趋势</span><strong>指标变化</strong></div><div><span>数据来源</span><strong>待接入</strong></div></div>
        <svg class="v3-auth-preview-chart" viewBox="0 0 600 150" aria-hidden="true">
          <path d="M0 125H600M0 82H600M0 39H600" fill="none" stroke="#e5eee8" stroke-dasharray="4 7" />
          <path d="M10 117C60 109 78 76 126 87S194 104 240 66 310 84 354 48 427 69 472 39 541 53 590 16" fill="none" stroke="#16816b" stroke-width="4" stroke-linecap="round" />
          <path d="M10 117C60 109 78 76 126 87S194 104 240 66 310 84 354 48 427 69 472 39 541 53 590 16V150H10Z" fill="#eaf4ed" />
        </svg>
        <div class="v3-auth-preview-foot"><span>从业务问题开始</span><span>在 Designer 中继续设计</span></div>
      </div>
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
