<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const privacy = computed(() => route.path === '/privacy');
</script>
<template>
  <section class="container page legal-content"><span class="eyebrow">TRUST & TRANSPARENCY</span><h1>{{ privacy ? '隐私政策' : '服务协议' }}</h1><div class="notice" role="status">正式法律文本待运营主体审核。本页仅如实说明工程数据处理与服务边界，不构成已经批准的正式协议。完成运营主体、法务审核、备案与联系方式前，不得公开注册或收款。</div>
    <template v-if="privacy"><h2>工程中涉及的信息</h2><p>账号流程涉及邮箱、显示名称、密码哈希、验证与密码重置令牌哈希；项目流程保存项目名称与需求描述；交易流程记录订单、支付渠道和权益状态；企业咨询保存姓名、企业、邮箱、需求及同意时间。</p><h2>处理目的与安全边界</h2><p>这些信息用于账号验证、项目管理、会员开通和回应咨询。项目由服务端校验所有权；门户不会直接存储银行卡信息。邮件、商户和独立 Designer 涉及外部服务，实际提供方、数据位置及协议须由运营方在正式政策中披露。</p><h2>正式政策仍需补齐</h2><p>运营主体名称、联系方式、保存期限、删除导出流程、第三方清单、跨境处理与用户权利渠道。当前没有自动注销或导出能力，不应在正式政策中虚构此类功能。</p></template>
    <template v-else><h2>当前服务范围</h2><p>本站提供账号、项目记录、Designer 安全入口、套餐订单和企业咨询。应用内部生成、数据连接、编辑与运行由独立 Designer 实现；组织协作、发票、版本与发布中心属于规划能力。</p><h2>购买与退款边界</h2><p>会员为固定期限的单次购买，不自动续费。金额以服务端真实订单为准，支付需商户最终确认。退款由人工审核并向商户核对，处理中不是成功；具体履约、退款与消费者保护条款须经运营主体审核。</p><h2>正式协议仍需补齐</h2><p>运营主体资质、服务等级、交付约定、责任范围、退款条款、争议处理与真实联系方式。展示素材不能作为客户背书或性能承诺。</p></template>
    <router-link class="button ghost" to="/contact">联系运营方</router-link>
  </section>
</template>
