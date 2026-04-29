<template>
  <div class="page-container">
    <div class="header-section">
      <h2 class="title">SEO 落地页生成项目</h2>
      <el-button type="primary" @click="showCreateModal = true">
        创建新项目
      </el-button>
    </div>

    <el-dialog v-model="showCreateModal" title="新建落地页项目" width="560px">
      <el-form label-position="top">
        <el-form-item label="核心产品关键词 (Keyword)">
          <el-input
            v-model="newKeyword"
            placeholder="例如: AI Video Enhancer"
            @keyup.enter="handleCreate"
          />
        </el-form-item>
        <el-form-item label="落地页模板">
          <el-select v-model="newTemplateId" placeholder="请选择模板" style="width: 100%;">
            <el-option
              v-for="template in templates"
              :key="template.id"
              :label="`${template.name} (${template.id})`"
              :value="template.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateModal = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">
          确认创建
        </el-button>
      </template>
    </el-dialog>

    <div class="content-section">
      <el-skeleton v-if="loading" :rows="4" animated />
      <el-empty v-else-if="projects.length === 0" description="暂无项目" />

      <div v-else class="project-grid">
        <el-card
          v-for="project in projects"
          :key="project.id"
          class="project-card"
          shadow="hover"
        >
          <div class="card-header">
            <h3>{{ project.keyword }}</h3>
            <el-tag :type="getStatusType(project.status)" size="small">
              {{ getStatusText(project.status) }}
            </el-tag>
          </div>
          <div class="card-body">
            <p class="meta">ID: {{ project.id }}</p>
            <p class="meta">Template: {{ project.templateId || defaultTemplateId }}</p>
            <p class="meta">创建时间: {{ new Date(project.createdAt).toLocaleString() }}</p>
          </div>
          <div class="card-footer">
            <el-button type="primary" plain @click="goToProject(project.id)">
              查看进度 / 继续
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { listProjects, createProject, listTemplates } from '../api/landingApi';

const defaultTemplateId = 'online-enhance-template-id14451';
const router = useRouter();
const projects = ref([]);
const templates = ref([]);
const loading = ref(true);
const creating = ref(false);
const showCreateModal = ref(false);
const newKeyword = ref('');
const newTemplateId = ref(defaultTemplateId);

async function fetchProjects() {
  loading.value = true;
  try {
    const res = await listProjects();
    if (res.data?.ok) {
      projects.value = res.data.projects;
    }
  } catch (error) {
    ElMessage.error('无法获取项目列表');
  } finally {
    loading.value = false;
  }
}

async function fetchTemplates() {
  try {
    const res = await listTemplates();
    if (res.data?.ok) {
      templates.value = res.data.templates || [];
      if (!templates.value.some(template => template.id === newTemplateId.value) && templates.value[0]) {
        newTemplateId.value = templates.value[0].id;
      }
    }
  } catch (error) {
    ElMessage.error('无法获取模板列表');
  }
}

async function handleCreate() {
  if (!newKeyword.value.trim()) {
    return ElMessage.warning('请输入关键词');
  }
  creating.value = true;
  try {
    const res = await createProject({
      keyword: newKeyword.value.trim(),
      templateId: newTemplateId.value
    });
    if (res.data?.ok) {
      ElMessage.success('创建成功');
      showCreateModal.value = false;
      newKeyword.value = '';
      router.push(`/landing-generator/${res.data.project.id}`);
    } else {
      throw new Error(res.data?.message || '创建失败');
    }
  } catch (error) {
    ElMessage.error(error.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

function goToProject(id) {
  router.push(`/landing-generator/${id}`);
}

function getStatusType(status) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'created') return 'info';
  return 'primary';
}

function getStatusText(status) {
  const map = {
    created: '新创建',
    step1_done: '完成第一步 (内容)',
    step2_done: '完成第二步 (提示词)',
    step3_done: '完成第三步 (图片)',
    completed: '完整打包生成',
    failed: '生成失败'
  };
  return map[status] || status;
}

onMounted(() => {
  fetchTemplates();
  fetchProjects();
});
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.title {
  margin: 0;
  font-size: 24px;
  color: var(--el-text-color-primary);
}
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
.project-card {
  display: flex;
  flex-direction: column;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}
.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.meta {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 4px 0;
}
.card-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
