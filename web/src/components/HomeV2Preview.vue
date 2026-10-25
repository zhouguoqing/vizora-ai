<script setup lang="ts">
import { ArrowUpRight, Check, Circle, Database, LayoutDashboard, SlidersHorizontal, Sparkles } from 'lucide-vue-next';
import type { ScreenExample } from '../home-v2';
defineProps<{ example: ScreenExample }>();
</script>

<template>
  <div class="v2-studio" aria-label="大屏布局概念预览">
    <div class="v2-studio-bar"><span class="v2-window-dots" aria-hidden="true"><i /><i /><i /></span><span>Vizora Studio <span class="v2-bar-divider">/</span> {{ example.label }}</span><span class="v2-studio-caption">布局概念预览 <ArrowUpRight :size="13" /></span></div>
    <div class="v2-studio-body">
      <aside class="v2-studio-sidebar" aria-label="预览中的概念功能（不可操作）">
        <span class="v2-mini-label">MY WORKSPACE</span>
        <span class="v2-sidebar-item selected"><LayoutDashboard :size="15" />大屏概览</span>
        <span class="v2-sidebar-item"><Database :size="15" />数据来源</span>
        <span class="v2-sidebar-item"><SlidersHorizontal :size="15" />指标定义</span>
        <p class="v2-sidebar-note"><span class="v2-dot" />示例数据<br /><span>非真实业务连接</span></p>
      </aside>
      <div class="v2-dashboard" aria-live="polite" aria-atomic="true">
        <div class="v2-dashboard-heading"><div><h3>{{ example.title }}</h3><p>{{ example.subtitle }}</p></div><span class="v2-demo-badge"><span class="v2-dot" />演示数据</span></div>
        <div class="v2-metrics"><div v-for="metric in example.metrics" :key="metric.label" class="v2-metric"><span>{{ metric.label }}</span><strong>{{ metric.value }}<small>{{ metric.unit }}</small></strong><span class="v2-metric-note">{{ metric.note }}</span></div></div>
        <div class="v2-charts">
          <div class="v2-chart"><h4>{{ example.chart }}<span>近 7 日 · 示例</span></h4>
            <svg viewBox="0 0 350 145" role="img" :aria-label="`${example.chart}示例图，非真实业务数据`">
              <path d="M12 28H338 M12 70H338 M12 112H338" fill="none" stroke="#e5ece8" stroke-dasharray="3 5" />
              <polygon :points="`12,130 ${example.trend.map((value, i) => `${12 + i * 54},${125 - value}`).join(' ')} 336,130`" fill="#e8f4ee" />
              <polyline :points="example.trend.map((value, i) => `${12 + i * 54},${125 - value}`).join(' ')" fill="none" stroke="#13836c" stroke-width="2.5" stroke-linejoin="round" />
              <circle v-for="(value, i) in example.trend" :key="i" :cx="12 + i * 54" :cy="125 - value" r="3" fill="#fff" stroke="#13836c" stroke-width="2" />
            </svg>
            <div class="v2-chart-days" aria-hidden="true"><span v-for="day in ['周一', '周二', '周三', '周四', '周五', '周六', '周日']" :key="day">{{ day }}</span></div>
          </div>
          <div class="v2-chart"><h4>{{ example.breakdown }}<span>示例</span></h4><div class="v2-region" v-for="region in example.regions" :key="region.name"><span>{{ region.name }}</span><div><i :style="{ width: `${region.value}%` }" /></div><small>{{ region.value }}%</small></div></div>
        </div>
      </div>
      <aside class="v2-assistant"><h4><Sparkles :size="16" />Vizora AI</h4><p>{{ example.assistant }}</p><ul><li><Check :size="13" />指标卡片与趋势布局</li><li><Check :size="13" />场景切换概念预览</li><li><Circle :size="12" />真实数据需另行接入</li></ul><router-link to="/contact">了解 Designer 接入 <ArrowUpRight :size="13" /></router-link><small>示例布局非 AI 实时生成</small></aside>
    </div>
  </div>
</template>
