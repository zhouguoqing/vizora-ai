<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MailCheck, ShieldCheck, ArrowLeft } from 'lucide-vue-next';
import { api, errorMessage, safeRedirect, setToken } from '../api';
const route = useRoute();
const router = useRouter();
const mode = computed(() => String(route.name || ''));
const email = ref(typeof route.query.email === 'string' ? route.query.email : '');
const password = ref('');
const confirmPassword = ref('');
const message = ref(route.query.sent === '1' ? '注册成功，验证邮件已发送。请前往邮箱点击验证链接。' : '');
const error = ref('');
const busy = ref(false);
const complete = ref(false);
let resendAt = 0;
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');
const title = computed(() => ({ verify: '验证电子邮箱', resend: '重发验证邮件', forgot: '找回密码', reset: '设置新密码' }[mode.value] || '账号安全'));
async function submit() {
  if (busy.value || complete.value) return;
  if (mode.value === 'resend' && Date.now() < resendAt) { error.value = '邮件已请求发送，请稍后再试。'; return; }
  if (mode.value === 'reset' && password.value !== confirmPassword.value) { error.value = '两次输入的密码不一致。'; return; }
  error.value = ''; message.value = ''; busy.value = true;
  try {
    if (mode.value === 'verify') {
      await api('/auth/verify-email', 'POST', { token: token.value });
      message.value = '邮箱验证成功，现在可以登录。'; complete.value = true;
      await router.replace({ path: '/verify-email', query: { verified: '1', redirect: safeRedirect(route.query.redirect) } });
    } else if (mode.value === 'resend' || mode.value === 'forgot') {
      const result = await api<{ message: string }>(mode.value === 'resend' ? '/auth/resend-verification' : '/auth/forgot-password', 'POST', { email: email.value.trim() });
      message.value = result.message; resendAt = Date.now() + 60000;
    } else {
      await api('/auth/reset-password', 'POST', { token: token.value, newPassword: password.value });
      setToken(''); message.value = '密码已重置，旧会话已全部失效，请重新登录。'; complete.value = true;
      await router.replace('/reset-password?completed=1');
    }
  } catch (e) { error.value = errorMessage(e); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="panel auth-wrap"><MailCheck v-if="mode === 'resend' || mode === 'verify'" :size="35" color="#087e69" /><ShieldCheck v-else :size="35" color="#087e69" /><h1 style="margin-top:20px">{{ title }}</h1><p>验证和密码重置链接有效期为 30 分钟，且只能使用一次。</p>
    <p v-if="!token && !complete && (mode === 'verify' || mode === 'reset')" class="notice">{{ route.query.verified === '1' ? '此邮箱已经完成验证，请登录。' : route.query.completed === '1' ? '密码重置已完成，请登录。' : '缺少有效链接。请从邮件进入，或重新请求邮件。' }}</p>
    <form v-if="!complete && !route.query.verified && !route.query.completed" class="form" @submit.prevent="submit">
      <label v-if="mode === 'resend' || mode === 'forgot'">电子邮箱<input v-model="email" type="email" autocomplete="email" required maxlength="320" placeholder="you@company.com" /></label>
      <template v-if="mode === 'reset'"><label>新密码<input v-model="password" type="password" autocomplete="new-password" required minlength="12" maxlength="256" placeholder="至少 12 位" /></label><label>确认新密码<input v-model="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="256" /></label></template>
      <button :disabled="busy || ((mode === 'verify' || mode === 'reset') && !token)" type="submit">{{ busy ? '正在处理…' : mode === 'verify' ? '确认验证邮箱' : mode === 'reset' ? '确认重置密码' : mode === 'resend' ? '发送验证邮件' : '发送重置邮件' }}</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="message" class="success" role="status">{{ message }}</p>
    <router-link v-if="(mode === 'verify' || mode === 'reset') && !complete" :to="mode === 'reset' ? '/forgot-password' : '/resend-verification'" class="link-arrow">链接失效？重新发送</router-link><br />
    <router-link class="link-arrow" :to="{ path: '/login', query: { redirect: safeRedirect(route.query.redirect) } }"><ArrowLeft :size="15" />返回登录</router-link>
  </section>
</template>
