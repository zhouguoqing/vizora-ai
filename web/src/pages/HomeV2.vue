<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Database, FileSpreadsheet, Menu, Plug, Sparkles, X } from 'lucide-vue-next';
import { session } from '../api';
import { screenDesignTarget, screenExamples } from '../home-v2';
import BrandLogo from '../components/BrandLogo.vue';
import HomeV2Preview from '../components/HomeV2Preview.vue';

const router = useRouter();
const route = useRoute();
const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement>();
const prompt = ref('');
const startError = ref('');
const selectedExample = ref(0);
const example = computed(() => screenExamples[selectedExample.value]!);
const selectedAudience = ref(0);
const navLinks = [
  { hash: '#v2-product', text: '产品能力' },
  { hash: '#v2-scenarios', text: '应用场景' },
  { hash: '#v2-path', text: '产品路线' },
];
const audiences = [
  { label: '软件服务商', eyebrow: '为专业交付而设计', title: '把业务需求，变成清晰的大屏设计起点。', text: '面向 FDE 与实施团队，按客户需求管理大屏项目。在独立 Designer 中继续设计与开发，让专业能力聚焦数据口径、业务理解和现场交付。', items: ['区域经营驾驶舱', '设备运行监控', '项目交付看板'], tags: ['经营指标', '状态趋势', '进度概览'] },
  { label: '企业数字化团队', eyebrow: '为业务全景而设计', title: '让分散的业务指标，拥有共同的视图。', text: '从经营管理、能源运营到园区监控，先梳理数据来源与展示目标，再与设计开发团队确认数据接入、权限和部署方案。', items: ['企业经营驾驶舱', '能源运营大屏', '智慧园区大屏'], tags: ['经营分析', '能源指标', '园区概览'] },
  { label: '运营与业务团队', eyebrow: '为日常决策而设计', title: '从一张看板开始，把业务重点看清楚。', text: '用自然语言表达你关注的指标、趋势与异常，把业务问题转化为大屏需求。真实数据连接和运行交付仍需与实施团队共同验证。', items: ['区域运营看板', '生产制造大屏', '指挥调度大屏'], tags: ['运营趋势', '生产进度', '资源分布'] },
];
const audience = computed(() => audiences[selectedAudience.value]!);
const steps = [
  { number: '01', label: '描述与设计', title: '说出需求，勾勒第一张大屏', text: '从业务目标、关键指标和布局偏好开始。保存需求后，通过项目入口前往独立 Designer 继续设计。', status: '需求与项目已支持' },
  { number: '02', label: '数据与开发', title: '让大屏连接真实业务', text: '围绕数据来源、字段映射与指标口径规划接入。图表编辑和数据绑定能力以外部 Designer 实际支持为准。', status: '外部 Designer 集成' },
  { number: '03', label: '验证与交付', title: '从视觉表达，走向业务验证', text: '在实际运行环境中核验数据、分辨率和展示效果。部署与交付范围由接入服务及实施方案确认。', status: '需独立联调验收' },
];
const roadmap = [
  { number: '01', label: '当前聚焦', title: 'AI 大屏设计与开发', text: '从需求描述、项目管理与 Designer 安全入口出发，连接大屏设计开发流程。', status: '门户已实现 · Designer 待接入' },
  { number: '02', label: '规划方向', title: '可复用的大屏交付', text: '探索场景模板、统一指标与版本维护，逐步沉淀可复用的交付资产。', status: '规划 · 非当前套餐权益' },
  { number: '03', label: '长期探索', title: '围绕场景持续演进', text: '以经营、设备与行业监控场景的真实需求为依据，评估协作和运行能力。', status: '规划 · 无上线时间承诺' },
];
watch(() => route.fullPath, () => { menuOpen.value = false; });
function closeMenu() {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  menuButton.value?.focus();
}
function chooseExample(index: number) {
  selectedExample.value = index;
  prompt.value = screenExamples[index]!.prompt;
  startError.value = '';
}
async function startDesign() {
  startError.value = '';
  try {
    sessionStorage.setItem('vizora_prompt', prompt.value.trim() || example.value.prompt);
    await router.push(screenDesignTarget(!!session.token));
  } catch {
    startError.value = '暂时无法保存需求或打开工作台，请检查浏览器存储权限后重试。';
  }
}
</script>

<template>
  <div class="home-v2">
    <header class="v2-nav" role="banner" @keydown.esc="closeMenu"><div class="v2-container v2-nav-inner">
      <router-link to="/home-v2" aria-label="Vizora AI 第二版首页"><BrandLogo /></router-link>
      <nav id="v2-navigation" aria-label="第二版首页导航" :class="{ 'is-open': menuOpen }">
        <router-link v-for="link in navLinks" :key="link.hash" :to="{ path: '/home-v2', hash: link.hash }">{{ link.text }}</router-link>
      </nav>
      <div class="v2-nav-actions"><router-link class="v2-login" :to="session.token ? '/workspace' : '/login'">{{ session.token ? '工作台' : '登录' }}</router-link><router-link class="v2-button v2-nav-cta" to="/contact">申请试点 <ArrowUpRight :size="16" /></router-link><button ref="menuButton" class="v2-menu" :aria-expanded="menuOpen" aria-controls="v2-navigation" :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'" @click="menuOpen = !menuOpen"><X v-if="menuOpen" :size="21" /><Menu v-else :size="21" /></button></div>
    </div></header>

    <section class="v2-hero"><div class="v2-container">
      <span class="v2-hero-pill"><span class="v2-dot" />从 AI 大屏出发 · 专注设计与开发</span>
      <h1>让想法，成为<br /><span>看得见的业务全景。</span></h1>
      <p class="v2-hero-lead">用自然语言描绘需求，开启 AI 大屏设计与开发。<br />从第一张经营看板开始，让数据表达更清晰，让专业交付更从容。</p>
      <form class="v2-prompt" @submit.prevent="startDesign">
        <label class="v2-sr-only" for="v2-prompt">描述你的大屏需求</label><textarea id="v2-prompt" v-model="prompt" rows="2" maxlength="5000" placeholder="我想设计一个区域经营大屏，关注收入、设备利用率和异常项目…" aria-describedby="v2-prompt-help" />
        <div class="v2-prompt-bottom"><span><Sparkles :size="16" />描述你的想法，从这里开始</span><button class="v2-button" type="submit">开始设计 <ArrowUpRight :size="18" /></button></div>
      </form>
      <p v-if="startError" class="v2-start-error" role="alert">{{ startError }}</p>
      <div class="v2-example-buttons" role="group" aria-label="选择大屏示例"><button v-for="(item, i) in screenExamples" :key="item.id" :aria-pressed="selectedExample === i" @click="chooseExample(i)"><ArrowUpRight :size="14" />{{ item.label }}</button></div>
      <p id="v2-prompt-help" class="v2-disclaimer">下方为布局概念与示例数据，非实时生成；开始设计将保存需求并前往项目工作台。</p>
      <HomeV2Preview :example="example" />
    </div></section>

    <section id="v2-product" class="v2-section v2-container"><div class="v2-section-top"><div><span class="v2-eyebrow">FROM IDEA TO SCREEN</span><h2>从一句需求，<br />到一张有业务价值的大屏。</h2></div><p>让设计、数据与开发沿着清晰的路径展开。<br />把时间留给业务，把表达交给更合适的工具。</p></div>
      <div class="v2-step-grid"><article v-for="step in steps" :key="step.number"><span class="v2-step-label">{{ step.number }} / {{ step.label }}</span><h3>{{ step.title }}</h3><p>{{ step.text }}</p><span class="v2-status">{{ step.status }}</span></article></div>
    </section>

    <section class="v2-context"><div class="v2-container v2-context-grid"><div><span class="v2-eyebrow">BEYOND THE CANVAS</span><h2>好看的背后，<br />是对业务的理解。</h2><p>同一个指标，在不同视图里也应有同一种解释。<br />先理清数据来源和指标口径，再讨论布局与连接。</p><ul class="v2-context-list"><li><ArrowRight :size="17" />数据有来源，指标有口径</li><li><ArrowRight :size="17" />图表与布局，服务于业务重点</li><li><ArrowRight :size="17" />面向真实交付，明确接入与运行边界</li></ul><span class="v2-status">数据接入由外部 Designer 提供</span></div>
      <div class="v2-flow"><div class="v2-flow-heading"><strong>一张大屏，连接业务上下文</strong><span>概念示意</span></div><div class="v2-source-grid"><div><Plug :size="23" /><span>业务 API</span></div><div><Database :size="23" /><span>数据库</span></div><div><FileSpreadsheet :size="23" /><span>Excel / CSV</span></div></div><ArrowDown class="v2-flow-arrow" :size="22" /><div class="v2-definition"><strong>统一指标定义</strong><span>收入 · 利用率 · 异常</span></div><ArrowDown class="v2-flow-arrow" :size="22" /><div class="v2-output-grid"><span>经营驾驶舱</span><span>设备监控大屏</span><span>行业数据大屏</span></div><p>接入类型、数据绑定与指标复用以 Designer 能力为准，不代表本站已连接数据。</p></div>
    </div></section>

    <section id="v2-scenarios" class="v2-section v2-container"><div class="v2-center-heading"><span class="v2-eyebrow">BUILT FOR REAL WORK</span><h2>从你的第一个大屏场景开始。</h2><p>聚焦有数据、有使用者、有持续价值的场景。</p></div>
      <div class="v2-audience-buttons" role="group" aria-label="选择适用团队"><button v-for="(item, i) in audiences" :key="item.label" :aria-pressed="selectedAudience === i" @click="selectedAudience = i">{{ item.label }}</button></div>
      <div class="v2-audience-panel"><div aria-live="polite"><span class="v2-eyebrow">{{ audience.eyebrow }}</span><h3>{{ audience.title }}</h3><p>{{ audience.text }}</p><router-link to="/contact" class="v2-text-link">探讨你的大屏场景 <ArrowUpRight :size="17" /></router-link></div><div class="v2-project-board"><div class="v2-board-title"><span class="v2-dot" />大屏项目工作区 <span>概念示意</span></div><div class="v2-board-row" v-for="(item, i) in audience.items" :key="item"><span class="v2-project-icon"><span /><span /><span /></span><strong>{{ item }}</strong><span class="v2-board-tag">{{ audience.tags[i] }}</span></div><div class="v2-board-bottom"><Check :size="15" />以业务场景为起点，逐步明确交付范围</div></div></div>
    </section>

    <section id="v2-path" class="v2-roadmap"><div class="v2-container v2-section"><div class="v2-center-heading"><span class="v2-eyebrow">START FOCUSED. BUILD WITH PURPOSE.</span><h2>聚焦大屏，把每一步做扎实。</h2><p>先验证设计与交付价值，再按真实需求演进。以下包含规划方向。</p></div><div class="v2-roadmap-grid"><article v-for="item in roadmap" :key="item.number"><div class="v2-roadmap-top"><span>{{ item.number }}</span><span>{{ item.label }}</span></div><h3>{{ item.title }}</h3><p>{{ item.text }}</p><span class="v2-status">{{ item.status }}</span></article></div></div></section>

    <section class="v2-container v2-cta"><div><span class="v2-eyebrow">LET'S BUILD YOUR FIRST SCREEN</span><h2>你的下一张大屏，<br />从一个想法开始。</h2><p>带上真实的业务问题，一起探讨设计、数据与交付。</p></div><router-link class="v2-button" to="/contact">申请成为试点伙伴 <ArrowUpRight :size="19" /></router-link></section>
    <footer class="v2-footer" role="contentinfo"><div class="v2-container"><div class="v2-footer-top"><router-link to="/home-v2" aria-label="Vizora AI 第二版首页"><BrandLogo /></router-link><p>AI 大屏设计与开发，让数据表达更清晰。</p><div><router-link to="/">原版首页 <ArrowUpRight :size="13" /></router-link><router-link to="/pricing">价格方案</router-link><router-link to="/contact">联系我们</router-link></div></div><div class="v2-footer-bottom"><span>© {{ new Date().getFullYear() }} Vizora AI · 第二版首页</span><span><router-link to="/terms">服务协议</router-link><router-link to="/privacy">隐私政策</router-link></span><span>概念展示不代表全部能力已上线</span></div></div></footer>
  </div>
</template>

<style src="./home-v2.css"></style>
