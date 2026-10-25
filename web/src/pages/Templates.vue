<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, Search } from 'lucide-vue-next';
import { session } from '../api';
import SceneArt from '../components/SceneArt.vue';
import AppDialog from '../components/AppDialog.vue';
import PageState from '../components/PageState.vue';
const route = useRoute();
const router = useRouter();
const filter = ref('全部');
const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const data = [
  { title: '经营分析驾驶舱', category: '经营管理', text: '整合营业趋势、核心指标与经营分析。', prompt: '创建经营分析驾驶舱，包含营收、订单、客户趋势和经营指标。', kind: 0 },
  { title: '业务工作台', category: '业务管理', text: '客户台账、任务状态与业务行动入口。', prompt: '创建业务工作台，包含客户台账、任务进度与操作表单。', kind: 1 },
  { title: 'AI Agent 操作台', category: 'AI 应用', text: '智能体会话、任务审批与执行记录。', prompt: '创建 AI Agent 操作台，包含会话、任务状态、人工确认与执行记录。', kind: 2 },
  { title: '实时监控中心', category: '实时监控', text: '设备状态、运行效率与告警信息。', prompt: '创建实时监控中心，包含设备状态、运行趋势和分级告警。', kind: 3 },
  { title: '地图调度应用', category: '地图应用', text: '位置分布、资源概览与调度任务。', prompt: '创建地图调度应用，包含资源位置、路线信息和调度任务列表。', kind: 4 },
  { title: '行业解决方案', category: '行业场景', text: '围绕能源、零售、制造等行业组织业务。', prompt: '创建行业业务应用，先明确业务角色、核心指标、数据来源与操作流程。', kind: 5 },
];
type Inspiration = typeof data[number];
const tags = ['全部', ...new Set(data.map(x => x.category))];
const list = computed(() => data.filter(x => (filter.value === '全部' || x.category === filter.value) && `${x.title}${x.text}${x.category}`.toLowerCase().includes(search.value.trim().toLowerCase())));
const detail = ref<Inspiration>();
function useTemplate(item: Inspiration) {
  sessionStorage.setItem('vizora_prompt', item.prompt);
  detail.value = undefined;
  router.push(session.token ? '/workspace' : { path: '/register', query: { redirect: '/workspace' } });
}
</script>
<template>
  <section class="container page"><div class="subhero"><span class="eyebrow">YOUR NEXT STARTING POINT</span><h1>精选应用模板，<br /><span class="gradient-text">让灵感有处落地。</span></h1><p>从常见业务场景提炼需求，带着清晰的想法开始创建项目。</p></div>
    <p class="notice">当前提供场景需求模板，而非已部署应用。预览为布局概念，不含真实业务数据；使用后创建项目，再进入独立 Designer 完成生成与数据接入。</p>
    <div class="filterbar"><label class="search"><Search :size="18" /><input v-model="search" aria-label="搜索模板" placeholder="搜索场景、行业或业务…" /></label><div class="chips" aria-label="筛选模板类别"><button v-for="tag in tags" :key="tag" :class="{ active: filter === tag }" :aria-pressed="filter === tag" @click="filter = tag">{{ tag }}</button></div></div>
    <div class="gallery-grid"><article v-for="item in list" :key="item.title" class="gallery-card"><SceneArt :kind="item.kind" :title="item.title" /><span class="eyebrow">{{ item.category }}</span><h3>{{ item.title }}</h3><p>{{ item.text }}</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="ghost small" @click="detail = item">查看详情</button><button class="small" @click="useTemplate(item)">使用此思路 <ArrowRight :size="13" /></button></div></article></div>
    <PageState v-if="!list.length" empty="暂无匹配的场景"><button class="ghost" @click="search = ''; filter = '全部'">清空筛选</button></PageState>
    <AppDialog :open="!!detail" :title="detail?.title || '场景详情'" @close="detail = undefined"><template v-if="detail"><SceneArt :kind="detail.kind" :title="detail.title" /><span class="tag">{{ detail.category }}</span><p style="margin-top:20px">{{ detail.text }}</p><h3>带入项目的需求描述</h3><p>{{ detail.prompt }}</p><p class="notice">这是一份需求起点，不是已经接通数据的业务系统。创建后需要在独立 Designer 中继续设计。</p><div class="modal-actions"><button @click="useTemplate(detail)">以此创建项目 <ArrowRight :size="16" /></button></div></template></AppDialog>
  </section>
</template>
