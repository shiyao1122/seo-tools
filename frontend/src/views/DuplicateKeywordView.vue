<template>
  <TaskManager
    task-type="duplicate-keywords"
    eyebrow="Keyword Filter"
    title="重复关键词筛选"
    description="后台会读取 Excel 的 url 列，提取 URL 最后一个斜杠后的内容作为关键词，筛选出共享 3 个或以上有效词的数据，并生成结果 Excel。建议单次不超过 10000 条，超过 20000 条会被拒绝。"
  />
</template>

<script setup>
import TaskManager from '../components/TaskManager.vue';
</script>
