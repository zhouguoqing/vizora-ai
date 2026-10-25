<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
const props = defineProps<{ open: boolean; title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
watch(() => props.open, async open => {
  await nextTick();
  if (open && dialog.value && !dialog.value.open) dialog.value.showModal();
  else if (!open && dialog.value?.open) dialog.value.close();
}, { immediate: true });
onBeforeUnmount(() => dialog.value?.close());
function close() { if (!props.busy) emit('close'); }
</script>
<template>
  <dialog ref="dialog" class="modal" :aria-label="title" @cancel.prevent="close" @click="event => { if (event.target === dialog) close(); }">
    <div class="modal-head"><h2>{{ title }}</h2><button type="button" class="icon-button" :disabled="busy" aria-label="关闭对话框" @click="close"><X :size="18" /></button></div>
    <slot />
  </dialog>
</template>
<style scoped>
.modal{color:#e8f2ff}.modal::backdrop{background:#000b;backdrop-filter:blur(7px)}
</style>
