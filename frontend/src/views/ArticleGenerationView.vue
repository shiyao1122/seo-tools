<template>
  <div class="tool-page">
    <section class="content-card page-card">
      <p class="eyebrow">Content Workflow</p>
      <h1>文章生成</h1>
      <p class="description">
        该页面路由已预留。下一步可在这里实现文章参数配置、批量生成、任务管理与结果下载。
      </p>
    </section>
  </div>
</template>

<style scoped>
.tool-page {
  display: grid;
  gap: 24px;
}

.page-card {
  padding: 24px;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--primary);
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
}

.description {
  margin: 0;
  color: #5d6978;
  line-height: 1.7;
}
</style>
