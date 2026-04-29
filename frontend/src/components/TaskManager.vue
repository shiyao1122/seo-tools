<template>
  <div class="task-page">
    <section class="content-card panel">
      <div class="panel-head">
        <div>
          <p class="panel-eyebrow">{{ eyebrow }}</p>
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
        </div>
        <el-upload :http-request="customUpload" :show-file-list="false" accept=".xlsx,.xls">
          <el-button type="primary" size="large" :loading="uploading">导入 Excel 并开始任务</el-button>
        </el-upload>
      </div>
      <div class="tips">
        <span>Excel 必须包含 url 列</span>
        <span>任务后台执行</span>
        <span>完成后可下载结果 Excel</span>
      </div>
    </section>

    <section v-if="enableSingleTest" class="content-card panel tester-panel">
      <div class="table-head">
        <h3>{{ singleTestTitle }}</h3>
      </div>
      <p class="tester-description">{{ singleTestDescription }}</p>
      <el-form label-position="top">
        <el-form-item label="URL">
          <el-input v-model="testForm.url" placeholder="https://example.com/page" />
        </el-form-item>
        <div class="test-actions">
          <el-button type="primary" @click="runSingleTest" :loading="testLoading">单条测试</el-button>
          <el-tag v-if="testResult.ran" :type="testResult.success ? 'success' : 'danger'">
            {{ testResult.success ? 'Success' : 'Failed' }}
          </el-tag>
        </div>
      </el-form>

      <div v-if="testResult.ran" class="log-box">
        <div class="log-head">
          <h3>Logs</h3>
          <div v-if="testResult.errorMessage" class="error-message">{{ testResult.errorMessage }}</div>
        </div>
        <div class="log-list">
          <div v-for="(item, index) in testResult.logs" :key="index" class="log-item">
            <div class="log-time">{{ formatBeijingTime(item.time) }}</div>
            <div class="log-message">{{ item.message }}</div>
            <pre v-if="item.extra">{{ formatJson(item.extra) }}</pre>
          </div>
        </div>
      </div>
    </section>

    <section class="content-card panel">
      <div class="table-head">
        <h3>任务列表</h3>
        <el-button @click="fetchTasks">刷新</el-button>
      </div>
      <el-table :data="tasks" stripe>
        <el-table-column prop="originalFileName" label="文件名" min-width="220" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="processedCount" label="进度" width="120">
          <template #default="{ row }">{{ row.processedCount }}/{{ row.totalCount }}</template>
        </el-table-column>
        <el-table-column prop="successCount" label="成功" width="90" />
        <el-table-column prop="failedCount" label="失败" width="90" />
        <el-table-column prop="uploadedAt" label="创建时间" min-width="180">
          <template #default="{ row }">{{ formatBeijingTime(row.uploadedAt) }}</template>
        </el-table-column>
        <el-table-column label="提示" min-width="240">
          <template #default="{ row }">
            <span class="warning-text">{{ row.warningMessage || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <div class="row-actions">
              <el-popconfirm
                v-if="canStopTask(row)"
                title="确认停止这个任务吗？"
                confirm-button-text="停止"
                cancel-button-text="取消"
                @confirm="stopCurrentTask(row)"
              >
                <template #reference>
                  <el-button link type="warning" :disabled="row.status === 'stopping'">停止</el-button>
                </template>
              </el-popconfirm>
              <el-button link type="primary" @click="downloadResult(row)" :disabled="!row.resultFileName">
                下载结果
              </el-button>
              <el-popconfirm
                title="确认删除这个任务吗？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="removeTask(row)"
              >
                <template #reference>
                  <el-button link type="danger" :disabled="row.status === 'running' || row.status === 'stopping'">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import client from '../api/client';
import { formatBeijingTime } from '../utils/time';

const props = defineProps({
  taskType: { type: String, required: true },
  title: { type: String, required: true },
  eyebrow: { type: String, required: true },
  description: { type: String, required: true },
  enableSingleTest: { type: Boolean, default: false },
  singleTestTitle: { type: String, default: '单条测试' },
  singleTestDescription: { type: String, default: '输入单条 URL，直接调用真实 Google API 查看返回日志。' }
});

const tasks = ref([]);
const uploading = ref(false);
const testLoading = ref(false);
const testForm = reactive({
  url: ''
});
const testResult = reactive({
  ran: false,
  success: false,
  logs: [],
  errorMessage: ''
});
let timer = null;

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function getRequestErrorMessage(error, fallbackMessage) {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.request && !error.response) {
    return '后端服务不可达或代理失败，请确认 backend 已启动';
  }

  return error.message || fallbackMessage;
}

async function fetchTasks() {
  const { data } = await client.get('/tasks', { params: { type: props.taskType } });
  tasks.value = data;
}

async function customUpload({ file }) {
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    await client.post(`/tasks/${props.taskType}`, formData);
    ElMessage.success('任务已加入队列');
    await fetchTasks();
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error, '上传失败'));
  } finally {
    uploading.value = false;
  }
}

function canStopTask(row) {
  return ['indexing', 'inspection'].includes(props.taskType)
    && ['queued', 'running', 'stopping'].includes(row.status);
}

function downloadResult(row) {
  client
    .get(`/tasks/${row.id}/download`, { responseType: 'blob' })
    .then(({ data, headers }) => {
      const disposition = headers['content-disposition'] || '';
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/);
      const fileName = decodeURIComponent(fileNameMatch?.[1] || `${row.id}.xlsx`);
      const blobUrl = URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(blobUrl);
    })
    .catch((error) => {
      ElMessage.error(getRequestErrorMessage(error, '下载失败'));
    });
}

async function stopCurrentTask(row) {
  try {
    await client.post(`/tasks/${row.id}/stop`);
    ElMessage.success(row.status === 'queued' ? '任务已停止' : '已发送停止请求');
    await fetchTasks();
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error, '停止任务失败'));
  }
}

async function removeTask(row) {
  try {
    await client.delete(`/tasks/${row.id}`);
    ElMessage.success('任务已删除');
    await fetchTasks();
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error, '删除失败'));
  }
}

async function runSingleTest() {
  const url = testForm.url.trim();
  if (!url) {
    ElMessage.warning('请输入 URL');
    return;
  }

  testLoading.value = true;
  testResult.ran = false;
  testResult.success = false;
  testResult.logs = [];
  testResult.errorMessage = '';

  try {
    const { data } = await client.post('/tools/test', {
      type: props.taskType,
      url
    });

    testResult.ran = true;
    testResult.success = data.success;
    testResult.logs = data.logs || [];
    testResult.errorMessage = data.error?.message || '';

    if (data.success) {
      ElMessage.success('单条测试成功');
    } else {
      ElMessage.error(data.error?.message || '单条测试失败');
    }
  } catch (error) {
    testResult.ran = true;
    testResult.success = false;
    testResult.logs = [
      {
        time: formatBeijingTime(),
        message: 'Request failed',
        extra: error.response?.data || { message: error.message }
      }
    ];
    testResult.errorMessage = getRequestErrorMessage(error, '单条测试失败');
    ElMessage.error(testResult.errorMessage);
  } finally {
    testLoading.value = false;
  }
}

onMounted(async () => {
  await fetchTasks();
  timer = setInterval(fetchTasks, 5000);
});

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<style scoped>
.task-page {
  display: grid;
  gap: 20px;
}

.panel {
  padding: 24px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.panel-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 12px;
  color: var(--primary);
}

.panel-head h2,
.table-head h3 {
  margin: 0 0 10px;
}

.tips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.tips span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(24, 34, 45, 0.06);
  color: #495567;
}

.table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning-text {
  color: #8a5a20;
  line-height: 1.5;
}

.tester-panel {
  overflow: hidden;
}

.tester-description {
  margin: 0 0 16px;
  color: #5d6978;
}

.test-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.log-box {
  margin-top: 24px;
  padding: 18px;
  border-radius: 18px;
  background: #161c22;
  color: #eef2f6;
}

.log-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}

.log-head h3 {
  margin: 0;
}

.error-message {
  color: #ffb4a8;
}

.log-list {
  display: grid;
  gap: 12px;
}

.log-item {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.log-time {
  font-size: 12px;
  color: #9db0c2;
}

.log-message {
  margin: 6px 0 10px;
  font-weight: 600;
}

.log-item pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .panel-head {
    flex-direction: column;
  }

  .log-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
