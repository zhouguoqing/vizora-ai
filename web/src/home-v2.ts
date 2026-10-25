export const screenExamples = [
  {
    id: 'operations', label: '区域经营看板', title: '区域经营概览',
    subtitle: '从关键指标出发，看清业务的每一次变化。',
    prompt: '设计一个区域经营大屏，展示营业收入、设备利用率、项目分布和异常趋势，采用清晰的指标卡片、趋势图和区域对比布局。',
    metrics: [
      { label: '本月营业收入', value: '¥ 286.4', unit: '万', note: '+12.8% 较上月' },
      { label: '设备利用率', value: '68.5', unit: '%', note: '+5.2% 较上月' },
      { label: '运营项目', value: '24', unit: '个', note: '3 个项目需要关注' },
    ],
    trend: [22, 36, 30, 58, 48, 72, 88],
    regions: [{ name: '华东', value: 86 }, { name: '华南', value: 69 }, { name: '华北', value: 54 }, { name: '西南', value: 38 }],
    chart: '收入趋势', breakdown: '区域表现',
    assistant: '在一个视图里组织收入、利用率与项目分布，让经营重点更清晰。',
  },
  {
    id: 'equipment', label: '设备监控大屏', title: '设备运行概览',
    subtitle: '汇集设备状态与运行趋势，聚焦需要关注的异常。',
    prompt: '设计一个设备监控大屏，展示在线设备数、在线率、待处理告警和运行趋势，按区域呈现设备状态，突出异常设备。',
    metrics: [
      { label: '在线设备', value: '1,286', unit: '台', note: '示例设备状态' },
      { label: '设备在线率', value: '98.6', unit: '%', note: '+0.8% 较昨日' },
      { label: '待处理告警', value: '12', unit: '条', note: '2 条高优先级告警' },
    ],
    trend: [65, 70, 62, 80, 76, 86, 91],
    regions: [{ name: '一区', value: 95 }, { name: '二区', value: 82 }, { name: '三区', value: 73 }, { name: '四区', value: 62 }],
    chart: '在线设备趋势', breakdown: '分区在线率',
    assistant: '将在线设备、运行趋势与告警信息放在一起，帮助确定监控视图的重点。',
  },
  {
    id: 'delivery', label: '项目交付看板', title: '项目交付概览',
    subtitle: '让里程碑、进度与风险，在同一个视图里对齐。',
    prompt: '设计一个项目交付大屏，展示在途项目、按期交付率、风险项目与里程碑趋势，按实施阶段呈现进度，不包含审批或任务执行功能。',
    metrics: [
      { label: '在途项目', value: '18', unit: '个', note: '覆盖 4 个交付阶段' },
      { label: '按期交付率', value: '92.3', unit: '%', note: '+3.1% 较上月' },
      { label: '风险项目', value: '3', unit: '个', note: '待核实交付计划' },
    ],
    trend: [18, 32, 28, 48, 63, 71, 84],
    regions: [{ name: '需求', value: 92 }, { name: '设计', value: 76 }, { name: '开发', value: 61 }, { name: '验收', value: 42 }],
    chart: '里程碑完成趋势', breakdown: '阶段进度',
    assistant: '围绕交付进度和风险构建看板布局，让项目沟通有共同的视觉起点。',
  },
] as const;

export type ScreenExample = typeof screenExamples[number];

export function screenDesignTarget(authenticated: boolean) {
  return authenticated ? { path: '/workspace' } :
    { path: '/register', query: { redirect: '/workspace' } };
}
