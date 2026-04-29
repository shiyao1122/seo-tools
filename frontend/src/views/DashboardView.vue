<template>
  <div class="dashboard-page">
    <section class="content-card hero-card">
      <div class="hero-copy">
        <div>
          <p class="label">Workspace</p>
          <h2>Google Console SEO 工具台</h2>
          <p>
            面向本地运营团队的任务后台，集中处理 Google Indexing API、GSC URL Inspection、重复关键词筛选，以及任务结果下载。
          </p>
        </div>
        <div class="hero-actions">
          <el-button type="primary" @click="downloadTemplate">下载 temp.xlsx 模板</el-button>
          <span class="hero-hint">模板必须保留 `url` 列，批量任务和重复关键词筛选都依赖这个字段。</span>
        </div>
      </div>
      <div class="tag-list">
        <span>Excel 导入</span>
        <span>后台任务</span>
        <span>结果下载</span>
        <span>本地权限管理</span>
      </div>
    </section>

    <section class="grid">
      <div class="content-card metric-card">
        <h3>批量提交收录</h3>
        <p>读取 Excel 的 `url` 列，调用 Google Indexing API，适合新页面提交和更新通知。</p>
      </div>
      <div class="content-card metric-card">
        <h3>批量查询收录</h3>
        <p>批量调用 GSC URL Inspection API，输出索引状态、覆盖状态和最近抓取时间。</p>
      </div>
      <div class="content-card metric-card">
        <h3>重复关键词筛选</h3>
        <p>从 URL slug 提取关键词，过滤掉停用词，筛出共享有效词过多的疑似重复页面。</p>
      </div>
    </section>

    <section class="content-card guide-card">
      <p class="label">使用说明</p>
      <div class="guide-grid">
        <div>
          <h3>1. 配置账号权限</h3>
          <p>管理员可进入系统设置维护 GSC Site URL、Service Account JSON 和任务延迟参数。</p>
        </div>
        <div>
          <h3>2. 创建普通用户</h3>
          <p>管理员可在用户管理中创建运营账号。普通用户可执行任务，但不能访问系统设置和用户管理。</p>
        </div>
        <div>
          <h3>3. 导入模板执行任务</h3>
          <p>下载模板后保留 `url` 列，按页面地址逐行填充，再进入对应功能页上传执行。</p>
        </div>
        <div>
          <h3>4. 查看任务列表和结果</h3>
          <p>每个功能页都会保留任务列表，可刷新进度、下载结果文件，也可删除历史任务。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus';
import client from '../api/client';

function downloadTemplate() {
  client
    .get('/tools/template', { responseType: 'blob' })
    .then(({ data, headers }) => {
      const disposition = headers['content-disposition'] || '';
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/);
      const fileName = decodeURIComponent(fileNameMatch?.[1] || 'temp.xlsx');
      const blobUrl = URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(blobUrl);
    })
    .catch((error) => {
      ElMessage.error(error.response?.data?.message || '模板下载失败');
    });
}
</script>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 24px;
}

.hero-card {
  padding: 28px;
  display: flex;
  justify-content: space-between;
  gap: 24px;
}

.hero-copy {
  display: grid;
  gap: 12px;
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--primary);
  font-size: 12px;
}

.hero-card h2 {
  margin: 0 0 10px;
  font-size: 32px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.hero-hint {
  color: #5d6978;
  font-size: 14px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 10px;
}

.tag-list span {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(182, 101, 42, 0.12);
  color: var(--primary-dark);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.metric-card,
.guide-card {
  padding: 24px;
}

.metric-card p,
.guide-grid p {
  margin: 0;
  color: #495567;
  line-height: 1.7;
}

.metric-card h3,
.guide-grid h3 {
  margin: 0 0 8px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

@media (max-width: 960px) {
  .hero-card {
    flex-direction: column;
  }

  .grid,
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
