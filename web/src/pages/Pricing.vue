<script setup lang="ts">
import PricingCards from '../components/PricingCards.vue';
const comparisons = [
  ['应用项目数', '3 个', '10 个', '不限', '合同约定'],
  ['邮箱验证与账号恢复', '支持', '支持', '支持', '支持'],
  ['项目需求持久保存', '支持', '支持', '支持', '支持'],
  ['Designer 一次性票据入口', '支持', '支持', '支持', '集成咨询'],
  ['会员期限', '免费', '30 / 365 天', '30 / 365 天', '合同约定'],
  ['自动扣费', '无', '不自动续费', '不自动续费', '合同约定'],
  ['团队席位 / 应用运行发布', '规划', '规划', '规划', '需求评估'],
  ['私有化 / OEM', '—', '—', '—', '方案咨询'],
];
</script>
<template>
  <div><section class="page-hero space-section"><div class="container subhero pricing-hero"><span class="eyebrow">SIMPLE, TRANSPARENT PRICING</span><h1>清晰透明的<span class="gradient-text">价格</span></h1><p>根据项目数量与会员期限选择适合的价格。<br />固定期限单次购买，不自动续费。</p></div></section>
    <section class="container page"><PricingCards /><div class="section-top" style="margin-top:40px"><div><h2>功能对比</h2><p class="muted tiny">选择最适合你的方案，规划能力不计入已交付权益。</p></div></div>
      <div class="comparison" role="region" aria-label="套餐功能对比，可横向滚动" tabindex="0"><table><thead><tr><th scope="col">产品权益</th><th v-for="name in ['Free', 'Creator', 'FDE', 'Enterprise']" :key="name" scope="col">{{ name }}</th></tr></thead><tbody><tr v-for="row in comparisons" :key="row[0]"><th scope="row">{{ row[0] }}</th><td v-for="(cell, i) in row.slice(1)" :key="i" :class="{ highlight: i === 2 }">{{ cell }}</td></tr></tbody></table></div>
      <section class="section"><h2>计费与常见问题</h2><p class="muted">关于购买、期限与退款的说明。</p><div class="faq-list"><details open><summary>年付如何计算？</summary><p>年付一次支付完整年度金额，开通 365 天；月付开通 30 天。不是自动续费订阅。</p></details><details><summary>订单与支付是否真实？</summary><p>订单由服务端保存，金额来自数据库。微信或支付宝只有经过商户确认后才会开通会员。未配置商户时会明确提示不可支付。</p></details><details><summary>可以退款吗？</summary><p>请联系销售并提供订单号。退款需人工审核，最终状态以商户核对为准，处理中不等于退款成功。</p></details><details><summary>包含 AI 额度、团队成员和发票吗？</summary><p>本站当前只管理项目配额与会员期限。团队、运行发布和发票属于规划，AI 和数据连接能力由外部 Designer 提供，应另行核实。</p></details></div></section>
    </section>
  </div>
</template>
