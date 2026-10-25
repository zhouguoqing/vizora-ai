<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Box, Users, Layers3, Building2, Check, ArrowRight } from 'lucide-vue-next';
import { api, errorMessage, money, session, type Plan } from '../api';
import PageState from './PageState.vue';
const router = useRouter();
const annual = ref(false);
const plans = ref<Plan[]>([]);
const loading = ref(true);
const error = ref('');
const icons = [Box, Users, Layers3, Building2];
const tiers = computed(() => [
  { name: 'Free', description: '轻松开始，体验项目创建', limit: '3 个应用项目', benefits: ['邮箱账号与安全验证', '个人项目管理', 'Designer 安全接入入口'], plan: undefined },
  { name: 'Creator', description: '适合个人创作者与小型项目', limit: '10 个应用项目', benefits: ['包含 Free 基础能力', '固定期限会员', '项目需求持久保存'], plan: plans.value.find(p => p.code === `creator-${annual.value ? 'year' : 'month'}`) },
  { name: 'FDE', description: '面向专业交付与高频创建', limit: '不限应用项目', benefits: ['包含 Creator 基础能力', '不设项目数量上限', '适合多个项目并行交付'], plan: plans.value.find(p => p.code === `fde-${annual.value ? 'year' : 'month'}`) },
  { name: 'Enterprise', description: '企业部署与定制集成咨询', limit: '按合同约定', benefits: ['私有化与 OEM 方案咨询', '安全合规需求评估', '专属实施方案沟通'], plan: undefined },
]);
async function load() {
  loading.value = true; error.value = '';
  try { plans.value = await api<Plan[]>('/plans'); }
  catch (e) { error.value = errorMessage(e); }
  finally { loading.value = false; }
}
function buy(index: number, plan?: Plan) {
  if (index === 3) { router.push('/contact'); return; }
  if (!plan) { router.push(session.token ? '/workspace' : '/register'); return; }
  sessionStorage.setItem('vizora_selected_plan', plan.code);
  router.push({ path: '/billing', query: { plan: plan.code } });
}
onMounted(load);
</script>
<template>
  <div class="section-top" style="margin-bottom:28px"><span class="muted tiny">单次购买 · 不自动续费 · 服务端实时价格</span><div class="billing-toggle" aria-label="计费周期"><button :class="{ active: !annual }" :aria-pressed="!annual" @click="annual = false">月付</button><button :class="{ active: annual }" :aria-pressed="annual" @click="annual = true">年付 <span class="discount">约 8 折</span></button></div></div>
  <PageState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
  <div v-else class="plans">
    <article v-for="(tier, index) in tiers" :key="tier.name" class="plan" :class="{ featured: index === 2 }">
      <span v-if="index === 2" class="plan-badge">推荐方案</span>
      <div class="plan-top"><h3>{{ tier.name }}</h3><component :is="icons[index]" :size="36" :stroke-width="1.5" /></div>
      <p class="description">{{ tier.description }}</p>
      <div class="price">{{ index === 0 ? '¥0' : index === 3 ? '联系销售' : tier.plan ? money(tier.plan.price_fen) : '暂未开售' }} <small v-if="index < 3 && (tier.plan || index === 0)">/ {{ annual && index !== 0 ? '年' : '月' }}</small></div>
      <p class="price-note">{{ index === 0 ? '免费版，无需支付' : index === 3 ? '按企业需求提供专属报价' : tier.plan ? `${tier.plan.duration_days} 天固定期限，含税以实际订单为准` : '此周期套餐尚未配置' }}</p>
      <ul><li><Check :size="16" />{{ tier.limit }}</li><li v-for="benefit in tier.benefits" :key="benefit"><Check :size="16" />{{ benefit }}</li></ul>
      <button :class="{ ghost: index !== 2 }" class="button" :disabled="(index === 1 || index === 2) && !tier.plan" @click="buy(index, tier.plan)">{{ index === 0 ? '免费开始' : index === 3 ? '联系销售' : '立即购买' }} <ArrowRight :size="15" /></button>
    </article>
  </div>
  <p class="muted tiny" style="margin-top:20px">套餐目前仅控制项目数量和会员期限。同档月付、年付可续期；有效期内暂不支持跨档购买。组织席位、数据连接、发布次数、团队协作等属于规划或外部 Designer 能力，不包含在本站已交付权益中。</p>
</template>
