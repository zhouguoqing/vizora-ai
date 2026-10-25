<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, Users, Building2, BriefcaseBusiness } from 'lucide-vue-next';
import { session } from '../api';
import SceneArt from '../components/SceneArt.vue';
const route = useRoute();
const router = useRouter();
const audiences = ['FDE', 'AI原生组织', '企业创新团队'] as const;
type Audience = typeof audiences[number];
const selected = ref<Audience>(audiences.find(a => a === route.query.audience) || 'FDE');
const icons = [Users, Building2, BriefcaseBusiness];
const content: Record<Audience, string> = {
  FDE: '把客户需求变成清晰的应用项目，在独立 Designer 中快速试验与迭代，专注真正重要的现场交付。',
  AI原生组织: '从经营分析到业务工作台，先明确组织需求与数据权限，让内部工具围绕实际工作方式生长。',
  企业创新团队: '为新业务验证设计可视化入口，快速整理需求并与实施团队讨论真实数据、权限和部署方案。',
};
const scenes = [
  ['经营分析驾驶舱', '整合关键指标与趋势，为管理者提供清晰的业务全景。', '经营指标 / 数据分析 / 决策支持'],
  ['业务工作台', '围绕客户、任务和审批，设计适合角色的业务入口。', '业务运营 / 流程协同 / 操作界面'],
  ['AI Agent 操作台', '可视化智能体的会话、执行任务与需要人工确认的步骤。', '智能体编排 / 业务助手 / 知识问答'],
  ['实时监控中心', '围绕设备与业务状态，规划告警、趋势和运行视图。', '状态监控 / 事件告警 / 运行趋势'],
  ['地图调度应用', '将空间位置与业务规则联系起来，规划资源分布和调度。', '地图可视化 / 路径规划 / 资源调度'],
  ['行业解决方案', '从能源、制造、零售、交通等具体行业问题出发。', '行业场景 / 快速验证 / 实施咨询'],
];
const featured = ref(0);
const examples = ['客户运营分析平台', '供应链监控平台', '门店运营分析', '城市交通运行监测', '能源运营中心'];
const example = computed(() => examples[featured.value]);
function start(scene: string) {
  sessionStorage.setItem('vizora_prompt', `面向${selected.value}，创建${scene}，请规划关键指标、业务页面、数据来源和交互。`);
  router.push(session.token ? '/workspace' : { path: '/register', query: { redirect: '/workspace' } });
}
</script>
<template>
  <div><section class="page-hero space-section"><div class="container"><div class="subhero"><span class="eyebrow">FROM DATA TO ACTION</span><h1>覆盖真实业务场景的<br /><span class="gradient-text">AI 可视化应用</span></h1><p>从数据分析到业务运营，从智能决策到行业创新。<br />让每个角色，都能找到贴近实际问题的出发点。</p></div><div class="tabs" aria-label="选择目标用户"><button v-for="(audience, i) in audiences" :key="audience" :aria-pressed="selected === audience" :class="{ active: selected === audience }" @click="selected = audience"><component :is="icons[i]" :size="18" />{{ audience }}</button></div><p class="muted tiny">{{ content[selected] }}</p></div></section>
    <section class="container page"><div class="section-head"><h2>热门应用场景</h2><p>场景仅为需求灵感；实际数据、AI 和运行能力需在外部 Designer 中接入。</p></div><div class="gallery-grid"><article v-for="(scene, i) in scenes" :key="scene[0]" class="gallery-card"><SceneArt :kind="i" :title="scene[0]" /><h3>{{ scene[0] }}</h3><p>{{ scene[1] }}</p><span class="tag">{{ scene[2] }}</span><div style="margin-top:16px"><button class="ghost small" @click="start(scene[0])">从此场景开始 <ArrowRight :size="14" /></button></div></article></div>
      <section class="section"><div class="section-top"><div><h2>精选应用场景：{{ example }}</h2><p class="muted tiny">选中一个方向，把灵感带入你的项目。</p></div><span class="pill">{{ featured + 1 }} / 5</span></div><div class="tabs" aria-label="精选场景"><button v-for="(name, i) in examples" :key="name" :class="{ active: featured === i }" :aria-pressed="featured === i" @click="featured = i">{{ name }}</button></div><div class="case-panel"><SceneArt :kind="featured" :title="example" /><div><span class="badge">场景概念 · 非现有业务应用</span><h3 style="margin-top:15px">{{ example }}</h3><p>从业务指标、用户角色、数据来源和关键操作四个方面梳理需求，再通过项目入口前往 Designer 完成设计。</p><button @click="start(example)">创建这个方向的项目 <ArrowRight :size="15" /></button></div><div class="case-metrics"><div><strong>业务目标</strong><p>先定义需要解决的问题</p></div><div><strong>真实数据</strong><p>接入前核实权限与来源</p></div><div><strong>持续迭代</strong><p>从原型到正式验证</p></div></div></div></section>
    </section>
  </div>
</template>
