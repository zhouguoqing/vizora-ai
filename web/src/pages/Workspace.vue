<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowUpRight, Plus, Search, Trash2, Sparkles, CreditCard } from 'lucide-vue-next';
import { api, ApiError, errorMessage, projectQuota, type Account, type Project } from '../api';
import SceneArt from '../components/SceneArt.vue';
import PageState from '../components/PageState.vue';
import AppDialog from '../components/AppDialog.vue';
const router = useRouter();
const projects = ref<Project[]>([]);
const account = ref<Account>();
const search = ref('');
const loading = ref(true);
const loadError = ref('');
const actionError = ref('');
const createOpen = ref(false);
const title = ref('');
const prompt = ref(sessionStorage.getItem('vizora_prompt') || '');
const saving = ref(false);
const deleting = ref(false);
const selected = ref<Project>();
const opening = ref('');
const filtered = computed(() => projects.value.filter(p => (p.title + p.prompt).toLowerCase().includes(search.value.trim().toLowerCase())));
const limit = computed(() => projectQuota(account.value));
const atLimit = computed(() => limit.value >= 0 && projects.value.length >= limit.value);
async function handleError(error: unknown, load = false) {
  if (error instanceof ApiError && error.status === 401 && !error.staleSession) {
    await router.replace({ path: '/login', query: { redirect: '/workspace' } });
  } else if (load) loadError.value = errorMessage(error);
  else actionError.value = errorMessage(error);
}
async function load() {
  loading.value = true; loadError.value = '';
  try { [projects.value, account.value] = await Promise.all([api<Project[]>('/dashboards'), api<Account>('/me')]); }
  catch (error) { await handleError(error, true); }
  finally { loading.value = false; }
}
function startCreate() {
  actionError.value = ''; title.value = ''; createOpen.value = true;
}
async function create() {
  if (saving.value) return;
  saving.value = true; actionError.value = '';
  try {
    await api<Project>('/dashboards', 'POST', { title: title.value.trim(), prompt: prompt.value.trim() });
    sessionStorage.removeItem('vizora_prompt'); prompt.value = ''; createOpen.value = false;
    await load();
  } catch (error) { await handleError(error); }
  finally { saving.value = false; }
}
async function open(project: Project) {
  if (opening.value) return;
  actionError.value = ''; opening.value = project.id;
  const tab = window.open('about:blank', '_blank');
  if (!tab) { actionError.value = '浏览器阻止了新窗口，请允许本站弹出窗口后重试。'; opening.value = ''; return; }
  tab.opener = null;
  try {
    const result = await api<{ url: string; ticket: string }>('/designer/ticket', 'POST', { dashboardId: project.id });
    const url = new URL(result.url);
    if (url.protocol !== 'https:' && !(import.meta.env.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Designer 地址必须使用受信任的 HTTPS 服务。');
    url.searchParams.set('ticket', result.ticket);
    tab.location.replace(url.toString());
  } catch (error) { tab.close(); await handleError(error); }
  finally { opening.value = ''; }
}
async function remove() {
  if (!selected.value || deleting.value) return;
  deleting.value = true; actionError.value = '';
  try {
    await api('/dashboards/' + selected.value.id, 'DELETE');
    selected.value = undefined; await load();
  } catch (error) { await handleError(error); }
  finally { deleting.value = false; }
}
onMounted(async () => { await load(); if (prompt.value && !loadError.value) createOpen.value = true; });
</script>
<template>
  <section class="container workspace">
    <div class="toolbar"><div><span class="eyebrow">YOUR WORKSPACE</span><h1>我的工作台</h1><p>{{ account?.email || '管理想法与项目，开始下一次交付。' }}</p></div><router-link class="button ghost" to="/billing"><CreditCard :size="16" />会员与订单</router-link></div>
    <div class="workspace-intro"><div><h2>让下一个想法，<span class="gradient-text">从这里开始。</span></h2><p>创建项目并保存需求，再通过安全入口前往独立 AI Designer。</p></div><button :disabled="loading || !!loadError || atLimit" @click="startCreate"><Plus :size="18" />新建项目</button></div>
    <p v-if="atLimit && !loading && !loadError" class="notice">已达到 {{ limit }} 个项目配额。可以删除不再需要的项目，或 <router-link to="/pricing">查看套餐方案</router-link>。</p>
    <p v-if="actionError && !createOpen && !selected" class="error" role="alert">{{ actionError }}</p>
    <div class="toolbar workspace-tabs"><h2>我的项目 <span class="pill">{{ projects.length }} / {{ limit < 0 ? '不限' : limit }}</span></h2><label class="search"><Search :size="17" /><input v-model="search" aria-label="搜索我的项目" placeholder="搜索名称或需求…" /></label></div>
    <PageState v-if="loading || loadError" :loading="loading" :error="loadError" @retry="load" />
    <template v-else><div v-if="filtered.length" class="project-list"><article v-for="(project, index) in filtered" :key="project.id" class="project"><SceneArt :kind="index % 6" :title="project.title" /><h3>{{ project.title }}</h3><p>{{ project.prompt || '尚未填写设计需求。' }}</p><span class="project-meta">创建于 {{ new Date(project.created_at).toLocaleString('zh-CN') }} · 项目概念示意图</span><div class="project-actions"><button :disabled="!!opening" @click="open(project)">{{ opening === project.id ? '连接设计器…' : '进入 AI Designer' }}<ArrowUpRight :size="15" /></button><button class="danger-button" :aria-label="'删除项目 ' + project.title" @click="selected = project; actionError = ''"><Trash2 :size="16" /></button></div></article></div>
      <PageState v-else :empty="search ? '没有匹配的项目' : '还没有项目，让灵感先落地'"><button v-if="!search" @click="startCreate"><Plus :size="16" />创建第一个项目</button><button v-else class="ghost" @click="search = ''">清空搜索</button></PageState>
    </template>
    <p class="muted tiny" style="margin-top:30px">本站保存项目记录与需求；AI 生成、编辑和运行由外部 Designer 提供。团队协作、应用版本与发布中心为规划能力。</p>
    <AppDialog :open="createOpen" title="创建应用项目" :busy="saving" @close="createOpen = false"><form class="form" @submit.prevent="create"><label>项目名称<input v-model="title" required maxlength="200" placeholder="例如：客户运营分析平台" autofocus /></label><label>你希望创建什么应用？<textarea v-model="prompt" maxlength="5000" rows="5" placeholder="描述业务目标、关键指标、页面和操作…" /></label><p class="muted tiny">创建后需求会保存到服务端，可从项目卡片打开 Designer。创建项目不代表已经生成应用。</p><p v-if="actionError" class="error" role="alert">{{ actionError }}</p><div class="modal-actions"><button type="button" class="ghost" :disabled="saving" @click="createOpen = false">取消</button><button type="submit" :disabled="saving || !title.trim()"><Sparkles :size="16" />{{ saving ? '正在创建…' : '创建项目' }}</button></div></form></AppDialog>
    <AppDialog :open="!!selected" title="确认删除项目" :busy="deleting" @close="selected = undefined"><p>即将删除「{{ selected?.title }}」。此操作不可恢复，项目记录和需求将被移除。</p><p v-if="actionError" class="error" role="alert">{{ actionError }}</p><div class="modal-actions"><button class="ghost" :disabled="deleting" @click="selected = undefined">取消</button><button class="danger-button" :disabled="deleting" @click="remove">{{ deleting ? '正在删除…' : '确认删除' }}</button></div></AppDialog>
  </section>
</template>
