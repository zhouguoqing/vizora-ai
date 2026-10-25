<script setup lang="ts">
import { LoaderCircle, AlertCircle, FolderOpen } from 'lucide-vue-next';
defineProps<{ loading?: boolean; error?: string; empty?: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="page-state" role="status"><LoaderCircle class="spin" :size="28" /><p>正在加载，请稍候…</p></div>
  <div v-else-if="error" class="page-state state-error" role="alert"><AlertCircle :size="28" /><p>{{ error }}</p><button class="ghost" @click="$emit('retry')">重新加载</button></div>
  <div v-else-if="empty" class="page-state"><FolderOpen :size="36" /><h3>{{ empty }}</h3><slot /></div>
</template>
