<template>
  <div class="settings-page">
    <section class="content-card panel">
      <div class="intro">
        <p class="eyebrow">System Settings</p>
        <h2>Google API Settings</h2>
        <p>Save settings locally. The Service Account must be added to the matching Search Console property.</p>
      </div>

      <el-form label-position="top" :model="form">
        <el-form-item label="GSC Site URLs">
          <el-input
            v-model="form.siteUrl"
            type="textarea"
            :rows="4"
            placeholder="One per line, for example:&#10;https://online.hitpaw.com/&#10;https://www.hitpaw.jp/&#10;sc-domain:hitpaw.com"
          />
          <div class="field-hint">
            支持多个站点，每行一个。查询时会按 URL 自动匹配对应站点，优先精确域名，其次匹配 `sc-domain:`
            Domain Property。
          </div>
        </el-form-item>
        <div class="inline-fields">
          <el-form-item label="Indexing API Delay (ms)">
            <el-input-number v-model="form.submitDelayMs" :min="0" />
          </el-form-item>
          <el-form-item label="URL Inspection API Delay (ms)">
            <el-input-number v-model="form.queryDelayMs" :min="0" />
          </el-form-item>
        </div>
        <el-form-item label="Service Account JSON">
          <el-input
            v-model="form.serviceAccountJson"
            type="textarea"
            :rows="16"
            placeholder="Paste the full Google Service Account JSON"
          />
        </el-form-item>
        <el-form-item label="Gemini API Key">
          <el-input
            v-model="form.geminiApiKey"
            type="password"
            show-password
            placeholder="Paste Gemini API Key for schema import"
          />
        </el-form-item>
        <el-button type="primary" @click="saveSettings" :loading="loading">Save Settings</el-button>
      </el-form>
    </section>

    <section class="content-card panel tester-panel">
      <div class="intro">
        <p class="eyebrow">Single URL Test</p>
        <h2>Single URL Debug</h2>
        <p>Enter one URL, run the real Google API call, and inspect step-by-step backend logs.</p>
      </div>

      <el-form label-position="top">
        <el-form-item label="Test Type">
          <el-radio-group v-model="testForm.type">
            <el-radio-button label="indexing">Indexing API</el-radio-button>
            <el-radio-button label="inspection">URL Inspection</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="URL">
          <el-input v-model="testForm.url" placeholder="https://example.com/page" />
        </el-form-item>
        <div class="test-actions">
          <el-button type="primary" @click="runTest" :loading="testLoading">Run Test</el-button>
          <el-tag :type="testResult.success ? 'success' : 'danger'" v-if="testResult.ran">
            {{ testResult.success ? 'Success' : 'Failed' }}
          </el-tag>
        </div>
      </el-form>

      <div class="log-box" v-if="testResult.ran">
        <div class="log-head">
          <h3>Logs</h3>
          <div class="error-message" v-if="testResult.errorMessage">{{ testResult.errorMessage }}</div>
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
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import client from '../api/client';
import { formatBeijingTime } from '../utils/time';

const loading = ref(false);
const testLoading = ref(false);
const form = reactive({
  siteUrl: '',
  serviceAccountJson: '',
  geminiApiKey: '',
  submitDelayMs: 200,
  queryDelayMs: 300
});
const testForm = reactive({
  type: 'indexing',
  url: ''
});
const testResult = reactive({
  ran: false,
  success: false,
  logs: [],
  errorMessage: ''
});

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

async function fetchSettings() {
  const { data } = await client.get('/settings');
  Object.assign(form, data);
}

async function saveSettings() {
  loading.value = true;
  try {
    await client.post('/settings', form);
    ElMessage.success('Settings saved');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || 'Failed to save settings');
  } finally {
    loading.value = false;
  }
}

async function runTest() {
  if (!testForm.url.trim()) {
    ElMessage.warning('Please enter a URL');
    return;
  }

  testLoading.value = true;
  testResult.ran = false;
  testResult.success = false;
  testResult.logs = [];
  testResult.errorMessage = '';

  try {
    await client.post('/settings', form);
    const { data } = await client.post('/tools/test', {
      type: testForm.type,
      url: testForm.url.trim()
    });

    testResult.ran = true;
    testResult.success = data.success;
    testResult.logs = data.logs || [];
    testResult.errorMessage = data.error?.message || '';

    if (data.success) {
      ElMessage.success('Test succeeded');
    } else {
      ElMessage.error(data.error?.message || 'Test failed');
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
    testResult.errorMessage = error.response?.data?.message || error.message;
    ElMessage.error(testResult.errorMessage);
  } finally {
    testLoading.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
.settings-page {
  display: grid;
  gap: 20px;
}

.panel {
  padding: 24px;
}

.inline-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--primary);
  font-size: 12px;
}

.intro h2 {
  margin: 0 0 8px;
}

.tester-panel {
  overflow: hidden;
}

.field-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
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

@media (max-width: 900px) {
  .inline-fields {
    grid-template-columns: 1fr;
  }

  .log-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
