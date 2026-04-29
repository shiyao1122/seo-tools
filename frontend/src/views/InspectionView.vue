<template>
  <TaskManager
    task-type="inspection"
    eyebrow="URL Inspection"
    title="批量查询 GSC 收录状态"
    description="后台会读取 Excel 的 url 列，调用 Google Search Console URL Inspection API 查询收录状态。"
    :enable-single-test="true"
    single-test-title="单条查询测试"
    single-test-description="先用单条 URL 直接调用 URL Inspection API，确认站点权限、GSC Site URL 和接口返回内容都正常。"
  />
</template>

<script setup>
import TaskManager from '../components/TaskManager.vue';
</script>
