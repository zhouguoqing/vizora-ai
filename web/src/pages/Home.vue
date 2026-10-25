<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, Play, Sparkles, Check, MessageSquare, Database, CloudUpload, LayoutGrid, Zap, ShieldCheck, Users, Plug, Bot } from 'lucide-vue-next';
import { session } from '../api';
import PricingCards from '../components/PricingCards.vue';
import SceneArt from '../components/SceneArt.vue';
const router = useRouter();
const prompt = ref('');
const steps = [
  { icon: MessageSquare, title: '描述想法', text: '用自然语言描述你想要的应用，以及它需要解决的问题。' },
  { icon: Sparkles, title: 'AI 生成应用', text: '将需求传递至独立 Designer，继续设计与编辑。' },
  { icon: Database, title: '连接数据与 API', text: '在 Designer 中配置真实数据，让应用连接业务。' },
  { icon: CloudUpload, title: '交付与运行', text: '在外部服务完成预览验证，再按部署要求交付。' },
];
const features = [
  { icon: Sparkles, title: '自然语言表达', text: '用业务语言描述需求，让每一个想法有清晰的起点。', status: '' },
  { icon: LayoutGrid, title: '可视化应用引擎', text: '通过独立 Designer 继续生成、组合与编辑界面。', status: '外部集成' },
  { icon: Plug, title: '数据与 API 连接', text: '按实际设计器能力接入数据与业务接口。', status: '外部集成' },
  { icon: Zap, title: 'FDE 快速交付', text: '管理多个项目，复用需求描述，减少重复准备工作。', status: '' },
  { icon: Users, title: '团队协作', text: '组织空间、角色与成员协作正在规划中。', status: '规划' },
  { icon: ShieldCheck, title: '安全账号与接入', text: '邮箱验证、会话撤销与短效一次性 Designer 票据。', status: '' },
];
const scenes = [
  ['经营分析驾驶舱', '整合经营指标，让业务趋势一目了然。'],
  ['业务工作台', '围绕客户、任务和业务流程组织应用。'],
  ['AI Agent 操作台', '为智能体任务提供清晰的可视化入口。'],
  ['实时监控中心', '从设备状态到告警，让运行情况可见。'],
  ['地图调度应用', '将位置、资源分布与业务任务联系起来。'],
  ['行业解决方案', '以行业问题为起点，探索可视化方案。'],
];
const faq = [
  ['Vizora AI 适合哪些用户和团队？', '适合需要快速交付业务界面的 FDE 工程师，以及希望用 AI 创建内部工具的组织。本站管理账号、项目和会员，应用设计由独立 Designer 完成。'],
  ['需要懂编程才能使用吗？', '可以先用自然语言创建项目。真实数据连接、权限和部署通常仍需要有经验的工程师参与。'],
  ['可以连接哪些业务数据？', '数据连接发生在外部 Designer 内，具体数据库、API 和认证支持应以接入服务的能力为准，本站不假装已经连接你的数据。'],
  ['付款后会自动续费吗？', '不会。当前按单次订单购买 30 天或 365 天会员，不会自动扣款。付款状态由服务端向商户确认。'],
  ['是否支持企业私有化部署？', '可以提交企业咨询讨论私有化与 OEM 需求。部署、SSO 和实施范围应在实际合同中约定。'],
  ['如何申请退款或获取帮助？', '请通过联系页面提交订单号和问题，不要提供密码或支付密钥。退款由管理员审核并向商户核对最终结果。'],
];
function start(value = prompt.value) {
  if (value.trim()) sessionStorage.setItem('vizora_prompt', value.trim());
  router.push(session.token ? '/workspace' : { path: '/register', query: { redirect: '/workspace' } });
}
</script>
<template>
  <div class="home">
    <section class="space-section"><div class="container hero-columns">
      <div class="hero-copy"><span class="eyebrow">✦ AI-NATIVE VISUAL APPLICATION PLATFORM</span><h1>你有一个想法，<br />Vizora AI 给你一个<br /><span class="gradient-text">可视化应用。</span></h1><p class="enline">You Imagine It. Vizora Builds It.</p><p class="lead">面向 FDE（前线部署工程师）和 AI 原生组织的<br />可视化应用快速创建与交付平台。</p>
        <form class="prompt-box" @submit.prevent="start()"><Sparkles :size="20" color="#48c7ff" /><input v-model="prompt" maxlength="5000" aria-label="描述你的应用想法" placeholder="例如：帮我创建一个客户运营分析应用…" /><button aria-label="用这个想法创建项目" type="submit"><ArrowRight :size="18" /></button></form>
        <div class="hero-buttons"><button @click="start()">立即体验 <ArrowRight :size="17" /></button><router-link class="button ghost" to="/contact"><Play :size="15" />预约演示</router-link></div>
        <div class="hero-checks"><span v-for="text in ['自然语言起步', '项目持久保存', '安全账号', '独立设计器']" :key="text"><Check :size="13" />{{ text }}</span></div>
      </div>
      <div class="hero-visual"><img class="product-illustration" src="/brand/product-preview.webp" width="421" height="275" alt="高保真设计中的经营分析驾驶舱，展示图表、地图与 AI 助手布局" fetchpriority="high" /><p class="illustration-caption">产品界面设计参考 · 非实时业务数据</p></div>
    </div></section>
    <section class="container trust-strip"><div><h2>为真实的业务问题而构建</h2><p>从单个灵感出发，走向有边界、可持续的交付。</p></div><div class="trust-values"><div><strong>FDE</strong><span>面向一线交付工程师</span></div><div><strong>AI Native</strong><span>为 AI 原生组织创造</span></div><div><strong>Idea → App</strong><span>让想法成为应用起点</span></div></div></section>
    <section class="container spacious"><div class="section-head"><span class="eyebrow">FROM IDEA TO APP</span><h2>从 Idea 到 App</h2><p>清晰的四步路径，让业务想法与工程交付连接起来。</p></div><div class="steps four"><article v-for="(step, i) in steps" :key="step.title" class="tile"><div class="stepnum"><component :is="step.icon" :size="21" /></div><h3><span class="muted tiny">0{{ i + 1 }} / </span>{{ step.title }}</h3><p>{{ step.text }}</p></article></div></section>
    <section class="alt"><div class="container spacious"><div class="section-top"><div class="section-head"><span class="eyebrow">WHY VIZORA AI</span><h2>为什么选择 Vizora AI</h2><p>不止一段提示词，而是从账号到项目再到设计器的完整路径。</p></div><router-link to="/features" class="link-arrow">全部能力 <ArrowRight :size="15" /></router-link></div><div class="feature-cards"><article v-for="feature in features" :key="feature.title" class="tile"><div class="feature-icon"><component :is="feature.icon" :size="23" /></div><h3>{{ feature.title }} <span v-if="feature.status" class="badge" :class="{ planned: feature.status === '规划' }">{{ feature.status }}</span></h3><p>{{ feature.text }}</p></article></div></div></section>
    <section class="container spacious"><div class="section-head"><span class="eyebrow">BUILT FOR BUILDERS</span><h2>面向两类核心用户</h2><p>不同的角色，相同的目标：更快把想法变成有价值的应用。</p></div><div class="persona-grid"><article class="persona"><span class="persona-label">01 / FORWARD DEPLOYED ENGINEERS</span><h3>FDE / 前线部署工程师</h3><p>管理客户项目，沉淀需求描述，通过安全入口进入独立设计器，让专业能力聚焦于真正复杂的业务问题。</p><router-link to="/solutions?audience=FDE" class="link-arrow">探索 FDE 应用场景 <ArrowRight :size="16" /></router-link></article><article class="persona"><span class="persona-label">02 / AI-NATIVE ORGANIZATIONS</span><h3>AI 原生组织</h3><p>从经营分析、内部工作台到 AI Agent 操作台，以自然语言明确需求，为团队探索适合自己的业务工具。</p><router-link to="/solutions?audience=AI原生组织" class="link-arrow">探索组织应用场景 <ArrowRight :size="16" /></router-link></article></div></section>
    <section class="alt"><div class="container spacious"><div class="section-top"><div class="section-head"><span class="eyebrow">APPLICATION SCENARIOS</span><h2>精选应用场景</h2><p>下列为场景灵感，实际界面和数据将在 Designer 中构建。</p></div><router-link to="/solutions" class="link-arrow">更多场景 <ArrowRight :size="15" /></router-link></div><div class="gallery-grid"><router-link v-for="(scene, i) in scenes" :key="scene[0]" :to="{ path: '/templates', query: { q: scene[0] } }" class="gallery-card"><SceneArt :kind="i" :title="scene[0]" /><h3>{{ scene[0] }}</h3><p>{{ scene[1] }}</p><span class="link-arrow">探索场景 <ArrowRight :size="14" /></span></router-link></div></div></section>
    <section class="container spacious"><div class="section-head"><span class="eyebrow">A PRACTICAL STARTING POINT</span><h2>从一个具体问题开始</h2><p>以能源运营为例，思考你的第一款业务应用。</p></div><div class="case-panel"><SceneArt :kind="3" title="能源运营场景" /><div><span class="badge">场景示例 · 非客户背书</span><h3 style="margin-top:15px">让能源运营信息更清晰</h3><p>把站点指标、设备状态和收入趋势整理成清晰需求，再在 Designer 中连接业务数据，逐步构建自己的运营界面。</p><button class="ghost small" @click="start('创建能源运营应用，包含站点指标、设备状态和收入趋势')">从这个想法开始 <ArrowRight :size="14" /></button></div><div class="case-metrics"><div><strong>01 / 指标</strong><p>明确核心业务目标</p></div><div><strong>02 / 数据</strong><p>连接真实数据源</p></div><div><strong>03 / 交付</strong><p>持续迭代业务界面</p></div></div></div></section>
    <section class="alt"><div class="container spacious"><div class="section-top"><div class="section-head"><span class="eyebrow">PRICING & PLANS</span><h2>价格与方案</h2><p>从个人创作到专业交付，按项目需求选择。</p></div><router-link to="/pricing" class="link-arrow">完整对比 <ArrowRight :size="15" /></router-link></div><PricingCards /></div></section>
    <section class="container spacious faq-layout"><div class="section-head"><span class="eyebrow">QUESTIONS, ANSWERED</span><h2>常见问题</h2><p>关于产品、能力边界与使用方式。</p></div><div class="faq-list"><details v-for="question in faq" :key="question[0]"><summary>{{ question[0] }}</summary><p>{{ question[1] }}</p></details></div></section>
    <section class="end-cta space-section"><h2>准备把你的想法变成应用？</h2><p>从第一个项目开始，给灵感一个清晰的落点。</p><button @click="start()">免费开始 <ArrowRight :size="16" /></button><router-link to="/contact" class="button ghost">联系销售</router-link></section>
  </div>
</template>
