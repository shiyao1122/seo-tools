<template>
  <TaskManager
    task-type="indexing"
    eyebrow="Indexing API"
    title="批量提交 Google 收录"
    description="后台会读取 Excel 的 url 列，依次调用 Google Indexing API 提交更新请求。"
    :enable-single-test="true"
    single-test-title="单条提交测试"
    single-test-description="先用单条 URL 直接调用 Google Indexing API，确认代理、凭据和接口返回内容都正常。"
  />
</template>

<script setup>
import TaskManager from '../components/TaskManager.vue';
</script>
