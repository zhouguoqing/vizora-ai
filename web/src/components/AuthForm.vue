<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Eye, EyeOff, ArrowRight } from 'lucide-vue-next';
import { api, errorMessage, safeRedirect, setToken } from '../api';
const props = defineProps<{ mode: 'login' | 'register' }>();
const route = useRoute();
const router = useRouter();
const email = ref(props.mode === 'login' && typeof route.query.email === 'string' ? route.query.email : '');
const password = ref('');
const name = ref('');
const consent = ref(false);
const remember = ref(false);
const visible = ref(false);
const busy = ref(false);
const error = ref('');
async function submit() {
  if (busy.value) return;
  error.value = ''; busy.value = true;
  try {
    if (props.mode === 'register') {
      await api('/auth/register', 'POST', { email: email.value.trim(), password: password.value, name: name.value.trim(), consent: consent.value });
      await router.push({ path: '/resend-verification', query: { email: email.value.trim(), sent: '1', redirect: safeRedirect(route.query.redirect) } });
    } else {
      const result = await api<{ token: string }>('/auth/login', 'POST', { email: email.value.trim(), password: password.value });
      setToken(result.token, remember.value);
      await router.push(safeRedirect(route.query.redirect));
    }
  } catch (e) { error.value = errorMessage(e); }
  finally { busy.value = false; }
}
</script>
<template>
  <form class="form" @submit.prevent="submit">
    <label v-if="mode === 'register'">姓名 / 显示名称<input v-model="name" autocomplete="name" maxlength="120" placeholder="你的称呼" /></label>
    <label>电子邮箱<input v-model="email" type="email" autocomplete="email" maxlength="320" required placeholder="you@company.com" :name="`${mode}-email`" /></label>
    <label>{{ mode === 'register' ? '设置密码' : '密码' }}<span class="password-input"><input v-model="password" :type="visible ? 'text' : 'password'" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" :minlength="mode === 'register' ? 12 : 1" maxlength="256" required :placeholder="mode === 'register' ? '至少 12 位密码' : '输入你的密码'" :name="`${mode}-password`" /><button type="button" :aria-label="visible ? '隐藏密码' : '显示密码'" :aria-pressed="visible" @click="visible = !visible"><EyeOff v-if="visible" :size="18" /><Eye v-else :size="18" /></button></span></label>
    <div v-if="mode === 'login'" class="form-between"><label class="consent"><input v-model="remember" type="checkbox" />记住登录</label><router-link to="/forgot-password">忘记密码？</router-link></div>
    <label v-else class="consent"><input v-model="consent" type="checkbox" required /><span>我已阅读并同意 <router-link to="/terms" target="_blank">《服务协议》</router-link> 和 <router-link to="/privacy" target="_blank">《隐私政策》</router-link></span></label>
    <p v-if="error" class="error" role="alert">{{ error }} <router-link v-if="error.includes('验证')" to="/resend-verification" class="link-arrow">重发验证邮件</router-link></p>
    <button :disabled="busy" type="submit" class="submit-button">{{ busy ? '正在提交…' : mode === 'register' ? '免费开始' : '登录' }}<ArrowRight :size="16" /></button>
  </form>
</template>
