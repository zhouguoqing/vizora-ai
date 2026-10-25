<script setup lang="ts">
import { BarChart3, Bot, Map, LayoutDashboard, Radio, Building2 } from 'lucide-vue-next';
defineProps<{ kind?: number; title?: string }>();
const icons = [BarChart3, LayoutDashboard, Bot, Radio, Map, Building2];
</script>
<template>
  <div class="scene-art" :class="'scene-' + (kind || 0)" aria-hidden="true">
    <div class="art-top"><span class="art-dots">● ● ●</span><span>{{ title || 'Vizora AI' }}</span><component :is="icons[(kind || 0) % icons.length]" :size="14" /></div>
    <div class="art-body"><div class="art-side"><i v-for="n in 5" :key="n" /></div><div class="art-content">
      <div class="art-metrics"><i v-for="n in 3" :key="n" /></div>
      <svg v-if="kind !== 4" viewBox="0 0 300 90" preserveAspectRatio="none"><path d="M0 85 L25 70 L50 76 L75 48 L100 55 L125 30 L150 43 L175 18 L200 28 L225 8 L250 20 L280 2 L300 10 L300 90 L0 90Z" fill="#246bff25"/><path d="M0 85 L25 70 L50 76 L75 48 L100 55 L125 30 L150 43 L175 18 L200 28 L225 8 L250 20 L280 2 L300 10" fill="none" stroke="#48c7ff" stroke-width="2"/></svg>
      <div v-else class="art-map"><Map :size="90" /><span /><span /></div>
      <div class="art-rows"><i v-for="n in 3" :key="n" /></div>
    </div></div>
  </div>
</template>
