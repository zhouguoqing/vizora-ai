<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';
import SceneArt from '../components/SceneArt.vue';
const blocks = [
  { title: '从自然语言开始，让想法先落地', text: '在首页描述业务目标，创建项目并保存需求。账号与项目真实持久化，登录后可以继续管理和进入设计器。', tags: ['需求描述', '项目创建', '持久保存'], status: '已实现', kind: 0 },
  { title: '可视化应用，交给专业的 Designer', text: '门户不是设计器本身。通过短效的一次性票据进入独立服务，在那里生成和编辑图表、表格、地图与业务页面。实际能力取决于接入的 Designer。', tags: ['安全 SSO 入口', '一次性票据', '独立服务'], status: '外部集成', kind: 1 },
  { title: '让数据连接建立在真实业务之上', text: '数据库、API、字段映射与 AI 助手由外部 Designer 集成。先明确业务数据及权限边界，不用示例图表代替已经接通的真实数据。', tags: ['数据权限', 'REST API', '业务集成'], status: '外部集成', kind: 4 },
  { title: '面向交付的项目管理', text: '为不同需求分别创建项目，查看、搜索、删除自己的记录。服务端检查项目所有权和套餐配额，避免跨用户访问。', tags: ['项目隔离', '配额控制', '工作台'], status: '已实现', kind: 3 },
  { title: '清晰的会员、订单与支付状态', text: '真实数据库套餐价格、人民币订单与商户支付接口相连。微信扫码与支付宝网页支付只有经过服务端确认后才开通会员。', tags: ['真实订单', '服务端确认', '不自动续费'], status: '已实现 · 商户待验收', kind: 2 },
  { title: '组织协作与应用运行，下一步继续进化', text: '组织成员、应用版本、运行发布与发票仍在规划。不将尚未实现的页面包装成已上线能力，企业可提交实际需求讨论实施范围。', tags: ['组织成员', '应用版本', '发布中心'], status: '规划', kind: 5 },
];
</script>
<template>
  <div><section class="space-section page-hero"><div class="container subhero"><span class="eyebrow">MADE FOR REAL-WORLD BUILDERS</span><h1>让好想法，拥有<br /><span class="gradient-text">可视化的表达能力。</span></h1><p>从账号与项目，到安全连接 Designer。了解每项能力的真实边界，构建可持续交付的业务应用。</p><router-link class="button" to="/workspace">进入应用工作台 <ArrowRight :size="16" /></router-link></div></section>
    <section class="container page"><article v-for="(block, i) in blocks" :key="block.title" class="feature-detail"><div><span class="eyebrow">CAPABILITY 0{{ i + 1 }}</span><span class="badge" :class="{ planned: block.status === '规划' }">{{ block.status }}</span><h2 style="margin-top:15px">{{ block.title }}</h2><p>{{ block.text }}</p><div class="chips"><span v-for="tag in block.tags" :key="tag" class="tag">{{ tag }}</span></div><router-link to="/resources" class="link-arrow">阅读使用与集成指南 <ArrowRight :size="15" /></router-link></div><SceneArt :kind="block.kind" :title="block.title" /></article></section>
  </div>
</template>
