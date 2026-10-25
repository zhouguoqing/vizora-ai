<script setup lang="ts">
const sections = [['getting-started', '开始使用'], ['projects', '项目与配额'], ['designer', 'Designer 集成'], ['billing', '计费与订单'], ['security', '账号与安全'], ['deployment', '部署与验收']];
</script>
<template>
  <section class="container page"><div class="subhero"><span class="eyebrow">A GUIDE TO BUILDING WITH VIZORA</span><h1>开发资源与<span class="gradient-text">交付指南</span></h1><p>了解实际使用流程、服务边界，以及从本地验证到正式发布需要完成的工作。</p></div>
    <div class="resource-layout"><nav class="resource-nav" aria-label="资源章节"><a v-for="section in sections" :key="section[0]" :href="'#' + section[0]">{{ section[1] }}</a></nav><div>
      <article id="getting-started" class="resource-section"><h2>01 / 开始使用</h2><ol><li>前往注册页，填写邮箱、显示名称和至少 12 位密码，阅读并同意协议。</li><li>打开验证邮件中的链接，确认邮箱。链接有效期 30 分钟且只能使用一次。</li><li>验证后登录工作台，创建项目并填写业务需求。</li><li>点击项目卡片的 Designer 入口，在外部设计器继续设计。</li></ol><router-link class="link-arrow" to="/register">创建账号 →</router-link></article>
      <article id="projects" class="resource-section"><h2>02 / 项目与配额</h2><p>项目记录和需求真实保存在服务端，只有项目所有者能够访问、删除或取得 Designer 票据。Free 可创建 3 个项目；Creator 10 个；FDE 不限制项目数量。</p><p>项目卡片上的示意图只是视觉标识，不代表 Designer 已生成业务页面。删除项目不可恢复，请谨慎操作。</p><router-link class="link-arrow" to="/workspace">前往工作台 →</router-link></article>
      <article id="designer" class="resource-section"><h2>03 / Designer 安全集成</h2><p>工作台调用 <code>POST /api/designer/ticket</code>，服务端先校验所有权和配额，再发放有效期 2 分钟的一次性票据。Designer 后端通过 <code>POST /api/designer/redeem</code> 兑换后建立自身会话。</p><p>票据不是长期登录凭据，不能重复使用。不要把门户 JWT 放进 URL。Designer 必须持续校验自己的资源权限，不能只信任浏览器参数。</p><p>未配置 Designer 时入口会明确提示，门户不会伪造已进入或已完成生成。</p><router-link class="link-arrow" to="/contact">讨论 Designer 接入 →</router-link></article>
      <article id="billing" class="resource-section"><h2>04 / 计费与订单</h2><p>所有价格以服务端套餐和实际订单为准，金额以人民币分保存。月套餐 30 天，年套餐 365 天，都是单次购买，不自动续费。</p><p>微信 Native 用于手机微信扫描电脑上的二维码；支付宝电脑网站支付用于浏览器跳转。移动端能查看账单，微信同机付款不适用 Native 扫码，应使用另一设备扫码，JSAPI / H5 属后续集成。</p><p>不要根据浏览器返回页判断付款成功。只有服务端验证商户状态后，订单才会标为已支付并开通权益。退款请联系支持，处理中的退款并非最终成功。</p><router-link class="link-arrow" to="/billing">查看真实订单 →</router-link></article>
      <article id="security" class="resource-section"><h2>05 / 账号与安全</h2><p>邮箱验证与密码恢复令牌在服务端仅保存哈希，30 分钟有效，单次使用。重置密码和退出全部会话会使旧会话失效。</p><p>“记住登录”会在本机持久保存登录凭据，不勾选则仅在当前浏览器会话内保存。不要在公共设备上勾选；离开共享设备前退出账号。</p><p>咨询表单只应填写必要的联系信息和需求，切勿提交密码、API 密钥或敏感业务数据。</p><router-link class="link-arrow" to="/forgot-password">找回账号密码 →</router-link></article>
      <article id="deployment" class="resource-section"><h2>06 / 部署与正式验收</h2><p>技术栈为 Vue 3 / TypeScript、ASP.NET Core 10、PostgreSQL。生产部署需完成域名、HTTPS、数据库迁移、备份恢复、真实 SMTP、商户回调和 Designer 端到端联调。</p><p>编译通过不代表资金交易和生产安全已经验收。正式开放注册和收款前，必须由真实运营主体审核协议、隐私、退款政策、备案和联系方式。</p><p>组织成员、应用版本、运行发布、发票与完整运营后台仍为规划范围。</p><router-link class="link-arrow" to="/contact">联系实施与部署咨询 →</router-link></article>
    </div></div>
  </section>
</template>
