<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Database, MessageSquare, Sparkles } from 'lucide-vue-next';
import HomeV2Preview from '../components/HomeV2Preview.vue';
import { session } from '../api';
import { screenDesignTarget, screenExamples } from '../home-v2';

const router = useRouter();
const prompt = ref('');
const startError = ref('');
const selectedExample = ref(0);
const example = computed(() => screenExamples[selectedExample.value]!);

const steps = [
  { number: '01', title: '描述业务目标', text: '从业务问题、关键指标和使用角色开始，整理一份清晰的大屏需求。' },
  { number: '02', title: '进入 Designer', text: '将项目需求带入独立 Designer，继续界面设计与开发。实际能力以接入服务为准。' },
  { number: '03', title: '验证交付方案', text: '与实施团队核对数据、权限和运行环境，再按真实部署要求完成验收。' },
];
const scenarios = [
  ['经营分析驾驶舱', '组织收入、趋势与关键经营指标。'],
  ['业务工作台', '围绕客户、任务与日常流程规划业务入口。'],
  ['AI Agent 操作台', '梳理智能体任务、执行记录与人工确认。'],
  ['实时监控中心', '呈现设备状态、告警与运行趋势。'],
  ['地图调度应用', '结合位置、资源分布与业务任务规划视图。'],
  ['行业解决方案', '从能源、制造、零售等真实问题出发。'],
];
const roadmap = [
  ['当前门户', '项目与需求管理', '账号、项目持久化、套餐订单与咨询线索。', '门户已实现'],
  ['独立服务', 'AI 大屏设计与数据连接', '由外部 Designer 提供，需完成真实接入与验收。', '外部集成'],
  ['持续规划', '团队协作与应用运行', '组织、版本、发布等能力仍在规划，不计入当前套餐。', '规划中'],
];

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
  <div class="v3-home">
    <section class="v3-hero">
      <div class="v3-container">
        <span class="v3-hero-pill"><span />从 AI 大屏出发 · 探索企业运营应用</span>
        <h1>让想法，成为<br /><em>可运行的可视化应用。</em></h1>
        <p class="v3-hero-lead">用自然语言描绘需求，连接你的业务数据。<br />从第一张运营看板开始，让交付更轻，让业务看得更清。</p>

        <form class="v3-prompt" @submit.prevent="startDesign">
          <label class="v3-sr-only" for="v3-prompt">描述你的大屏需求</label>
          <textarea id="v3-prompt" v-model="prompt" rows="2" maxlength="5000" placeholder="我想搭建一个区域经营看板，关注收入、设备利用率和异常项目…" />
          <div class="v3-prompt-bottom">
            <span><Sparkles :size="16" />描述你的想法，从这里开始</span>
            <button type="submit">开始设计 <ArrowUpRight :size="17" /></button>
          </div>
        </form>
        <p v-if="startError" class="v3-start-error" role="alert">{{ startError }}</p>
        <div class="v3-examples" role="group" aria-label="选择大屏示例">
          <button v-for="(item, index) in screenExamples" :key="item.id" type="button" :aria-pressed="selectedExample === index" @click="chooseExample(index)">
            <ArrowUpRight :size="14" />{{ item.label }}
          </button>
        </div>
        <p class="v3-disclaimer">下方为布局概念与示例数据，非实时生成；开始设计会保存需求并前往项目工作台。</p>
        <div class="home-v2 v3-preview-theme"><HomeV2Preview :example="example" /></div>
      </div>
    </section>

    <section class="v3-section v3-container">
      <div class="v3-section-heading"><div><span class="v3-eyebrow">FROM IDEA TO SCREEN</span><h2>从一句需求，到一份清晰的交付起点。</h2></div><p>让设计、数据与开发沿着真实可行的路径展开，把时间留给业务理解和专业交付。</p></div>
      <div class="v3-step-grid">
        <article v-for="step in steps" :key="step.number" class="v3-card">
          <span class="v3-step-number">{{ step.number }} / WORKFLOW</span>
          <h3>{{ step.title }}</h3><p>{{ step.text }}</p>
        </article>
      </div>
    </section>

    <section class="v3-context-section">
      <div class="v3-container v3-context-grid">
        <div class="v3-context-copy">
          <span class="v3-eyebrow">BEYOND THE CANVAS</span>
          <h2>好看的背后，<br />是连接业务的能力。</h2>
          <p>同一个指标，在不同视图里也应有同一种解释。先理清数据来源和指标口径，再讨论布局与连接。</p>
          <ul>
            <li><Check :size="17" />数据有来源，指标有口径</li>
            <li><Check :size="17" />组件与场景复用，减少重复搭建</li>
            <li><Check :size="17" />面向团队交付，规划多项目管理</li>
          </ul>
          <span class="v3-status-pill">业务连接示意 · 非当前门户能力</span>
        </div>
        <div class="v3-flow-card" aria-label="业务数据与可视化应用的概念关系图">
          <div class="v3-flow-heading"><strong>一个应用，连接业务上下文</strong><span>概念示意</span></div>
          <div class="v3-flow-sources">
            <div><Database :size="22" /><span>业务 API</span></div>
            <div><Database :size="22" /><span>数据库</span></div>
            <div><MessageSquare :size="22" /><span>Excel / CSV</span></div>
          </div>
          <ArrowDown class="v3-flow-arrow" :size="23" />
          <div class="v3-flow-metric"><strong>统一指标定义</strong><span>收入 · 利用率 · 异常</span></div>
          <ArrowDown class="v3-flow-arrow" :size="23" />
          <div class="v3-flow-products"><span>经营看板</span><span>运营工作台</span><span>业务报告</span></div>
          <div class="v3-flow-foot"><span>数据接入需独立配置</span><span>可复用的应用结构</span></div>
        </div>
      </div>
    </section>

    <section id="v3-scenarios" class="v3-section v3-container">
      <div class="v3-section-heading"><div><span class="v3-eyebrow">BUILT AROUND REAL WORK</span><h2>从你的第一个业务场景开始。</h2></div><router-link class="v3-text-link" to="/solutions">探索全部场景 <ArrowRight :size="16" /></router-link></div>
      <div class="v3-scenario-grid">
        <router-link v-for="(scenario, index) in scenarios" :key="scenario[0]" class="v3-scenario-card" :to="{ path: '/templates', query: { q: scenario[0] } }">
          <span class="v3-scenario-index">0{{ index + 1 }}</span><h3>{{ scenario[0] }}</h3><p>{{ scenario[1] }}</p><span class="v3-text-link">探索场景 <ArrowRight :size="14" /></span>
        </router-link>
      </div>
    </section>

    <section class="v3-audience-section">
      <div class="v3-container">
        <div class="v3-section-heading"><div><span class="v3-eyebrow">MADE FOR BUILDERS</span><h2>把项目经验，变成下一次交付的起点。</h2></div><router-link class="v3-text-link" to="/solutions">按角色了解场景 <ArrowRight :size="16" /></router-link></div>
        <div class="v3-audience-grid">
          <article class="v3-audience-card"><span>01 / FDE</span><h3>为专业交付而设计</h3><p>把客户需求沉淀为项目，在独立 Designer 中继续设计与开发，让专业能力聚焦业务理解和现场交付。</p></article>
          <article class="v3-audience-card"><span>02 / AI-NATIVE TEAMS</span><h3>为业务全景而设计</h3><p>从经营管理、能源运营到园区监控，先梳理数据与指标，再与交付团队确认连接、权限和部署方案。</p></article>
        </div>
      </div>
    </section>

    <section class="v3-section v3-container">
      <div class="v3-section-heading"><div><span class="v3-eyebrow">PRODUCT ROADMAP</span><h2>以大屏切入，向运营应用生长。</h2></div><router-link class="v3-text-link" to="/features">了解产品能力 <ArrowRight :size="16" /></router-link></div>
      <div class="v3-roadmap-grid">
        <article v-for="item in roadmap" :key="item[0]" class="v3-roadmap-card"><span>{{ item[0] }}</span><h3>{{ item[1] }}</h3><p>{{ item[2] }}</p><small>{{ item[3] }}</small></article>
      </div>
    </section>

    <section class="v3-bottom-cta">
      <div class="v3-container"><div><span class="v3-eyebrow">LET'S BUILD WITH CONTEXT</span><h2>你的下一张大屏，<br />从一个想法开始。</h2><p>带上真实的业务问题，一起探讨设计、数据与交付。</p></div><router-link to="/contact">申请试点 <ArrowUpRight :size="18" /></router-link></div>
    </section>
  </div>
</template>

<style src="./home-v2.css"></style>
