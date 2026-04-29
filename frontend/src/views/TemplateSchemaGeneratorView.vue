<template>
  <div class="tool-page">
    <section class="content-card page-card">
      <p class="eyebrow">Template Workflow</p>
      <h1>模板 Schema JSON 生成</h1>
      <p class="description">
        根据 `content_schema.json` 动态生成表单，支持手动填写、Markdown 粘贴导入，以及 Word(.docx) / Markdown 文件导入。
        导入后仍可继续修改，点击生成即可得到最终 JSON。
      </p>
    </section>

    <section class="panel-grid">
      <section class="content-card panel">
        <div class="panel-head">
          <div>
            <h2>导入内容</h2>
            <p>Word / Markdown 导入会调用 Gemini 自动映射到表单字段，导入后仍可继续手动修改。</p>
          </div>
        </div>

        <el-form label-position="top">
          <el-form-item label="粘贴 Markdown 或说明文本">
            <el-input
              v-model="importText"
              type="textarea"
              :rows="10"
              placeholder="可直接粘贴参考 markdown 的填写内容，或粘贴整理后的页面说明"
            />
          </el-form-item>
          <div class="action-row">
            <el-button type="primary" :loading="importing" @click="importFromText">导入文本到表单</el-button>
            <el-upload
              :http-request="handleUploadImport"
              :show-file-list="false"
              accept=".docx,.md,.markdown,.txt"
            >
              <el-button :loading="importing">上传 Word / Markdown</el-button>
            </el-upload>
          </div>
        </el-form>
      </section>

      <section class="content-card panel">
        <div class="panel-head">
          <div>
            <h2>生成结果</h2>
            <p>生成时会补齐 `_meta.template_version` 和 `_meta.generated_at`，并校验必填字段。</p>
          </div>
          <div class="action-row">
            <el-button @click="resetForm">重置表单</el-button>
            <el-button type="primary" :loading="generating" @click="generateJson">生成 JSON</el-button>
            <el-button :disabled="!generatedJson" @click="downloadJson">下载 JSON</el-button>
          </div>
        </div>

        <el-input
          :model-value="generatedJson"
          type="textarea"
          :rows="18"
          readonly
          placeholder="点击“生成 JSON”后显示结果"
        />
      </section>
    </section>

    <section class="content-card panel" v-if="formConfig.length">
      <div class="panel-head">
        <div>
          <h2>动态表单</h2>
          <p>表单字段由 `content_schema.json` 的 `definitions/$defs` 与 `properties` 自动展开。</p>
        </div>
      </div>

      <el-form label-position="top">
        <SchemaFieldGroup :fields="formConfig" :model="formData" />
      </el-form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import client from '../api/client';
import SchemaFieldGroup from '../components/SchemaFieldGroup.vue';

const importing = ref(false);
const generating = ref(false);
const formConfig = ref([]);
const initialData = ref({});
const formData = ref({});
const generatedJson = ref('');
const importText = ref('');

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetForm() {
  formData.value = cloneValue(initialData.value);
  generatedJson.value = '';
}

async function fetchConfig() {
  try {
    const { data } = await client.get('/tools/template-schema/config');
    formConfig.value = data.formConfig || [];
    initialData.value = data.initialData || {};
    formData.value = cloneValue(initialData.value);
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '加载表单配置失败');
  }
}

async function importFromText() {
  if (!importText.value.trim()) {
    ElMessage.warning('请先输入要导入的文本');
    return;
  }

  importing.value = true;
  try {
    const { data } = await client.post('/tools/template-schema/import', {
      text: importText.value
    });
    formData.value = data.data;
    generatedJson.value = '';
    ElMessage.success('文本已写入表单');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '文本导入失败');
  } finally {
    importing.value = false;
  }
}

async function handleUploadImport({ file }) {
  importing.value = true;
  try {
    const body = new FormData();
    body.append('file', file);
    const { data } = await client.post('/tools/template-schema/import', body);
    formData.value = data.data;
    generatedJson.value = '';
    ElMessage.success('文件内容已写入表单');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '文件导入失败');
  } finally {
    importing.value = false;
  }
}

async function generateJson() {
  generating.value = true;
  try {
    const { data } = await client.post('/tools/template-schema/generate', {
      formData: formData.value
    });
    generatedJson.value = JSON.stringify(data.data, null, 2);
    ElMessage.success('JSON 生成成功');
  } catch (error) {
    const detailMessage = error.response?.data?.details?.join('\n');
    ElMessage.error(detailMessage || error.response?.data?.message || 'JSON 生成失败');
  } finally {
    generating.value = false;
  }
}

function downloadJson() {
  if (!generatedJson.value) {
    return;
  }

  const pageName = formData.value?._meta?.page_name || 'template-schema';
  const blob = new Blob([generatedJson.value], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pageName}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(fetchConfig);
</script>

<style scoped>
.tool-page {
  display: grid;
  gap: 20px;
}

.page-card,
.panel {
  padding: 24px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--primary);
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
}

.description,
.panel-head p {
  margin: 10px 0 0;
  color: #5d6978;
  line-height: 1.7;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 1100px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .panel-head {
    flex-direction: column;
  }
}
</style>
