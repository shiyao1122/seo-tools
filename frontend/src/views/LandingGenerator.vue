<template>
  <div class="page-container" v-loading="loadingPage">
    <div class="header-section">
      <el-button icon="back" @click="router.push('/landing-projects')">返回</el-button>
      <h2 class="title" style="margin-left: 16px;">
        生成工作流 - {{ project?.keyword || '加载中...' }}
      </h2>
      <el-tag v-if="project" style="margin-left: 12px;" type="info">
        {{ project.templateId || 'online-enhance-template-id14451' }}
      </el-tag>
    </div>

    <el-card class="stepper-card">
      <el-steps :active="activeStep" finish-status="success" align-center>
        <el-step title="步骤 1" description="生成内容大纲与 Markdown" style="cursor: pointer;" @click="viewStep = 0"></el-step>
        <el-step title="步骤 2" description="读取内容生成插图提示词" style="cursor: pointer;" @click="viewStep = 1"></el-step>
        <el-step title="步骤 3" description="调用 AI 绘制相关配图" style="cursor: pointer;" @click="viewStep = 2"></el-step>
        <el-step title="步骤 4" description="填充 HTML 模板并打包" style="cursor: pointer;" @click="viewStep = 3"></el-step>
      </el-steps>

      <div class="step-content">
        <!-- Step 1 Pane -->
        <div v-show="viewStep === 0" class="pane" :style="{ maxWidth: activeStep > 0 ? '800px' : '600px' }">
          <h3>生成内容大纲</h3>
          <p>这一步系统会自动调用数据工具研究分析竞品，并根据《{{ project?.keyword }}》自动生成 H1、卖点和详细落地方案。</p>
          
          <div v-if="activeStep > 0" class="content-editor">
             <div style="text-align: left; margin-bottom: 10px; font-weight: bold; color: var(--el-color-primary);">
               Step 1 已生成内容，您可以直接预览或编辑 Markdown 大纲：
             </div>
             <el-tabs v-model="mdTab" type="border-card" style="margin-bottom: 20px;">
               <el-tab-pane label="预览效果" name="preview">
                 <div class="markdown-preview" v-html="renderedMarkdown" style="text-align: left; max-height: 400px; overflow-y: auto;"></div>
               </el-tab-pane>
               <el-tab-pane label="编辑源文件" name="edit">
                 <el-input 
                   type="textarea" 
                   v-model="step1Content" 
                   :rows="15" 
                   style="font-family: monospace;" 
                 />
               </el-tab-pane>
             </el-tabs>
             <div class="pane-actions">
               <el-button type="success" size="large" :loading="savingContent" @click="handleSaveContent">
                 保存编辑内容
               </el-button>
               <el-button type="warning" size="large" :loading="runningStep" @click="handleRunStep(1)">
                 重新生成第一步
               </el-button>
             </div>
          </div>
          <div v-else class="pane-actions">
             <el-button type="primary" size="large" :loading="runningStep" @click="handleRunStep(1)">
               执行第一步 (内容生成)
             </el-button>
          </div>
        </div>

        <!-- Step 2 Pane -->
        <div v-show="viewStep === 1" class="pane" :style="{ maxWidth: activeStep > 0 ? '800px' : '600px' }">
          <h3>生成图片提示词</h3>
          <p>基于刚刚生成的 Markdown 内容大纲，智能提取相关占位图，并利用 LLM 自动生成高质量的绘画提示词。</p>
          
          <div v-if="activeStep > 0" class="content-editor">
             <div style="text-align: left; margin-bottom: 10px; font-weight: bold; color: var(--el-color-primary);">
               当前 Markdown 大纲内容（可修改后保存）：
             </div>
             <el-tabs v-model="mdTab" type="border-card" style="margin-bottom: 20px;">
               <el-tab-pane label="预览效果" name="preview">
                 <div class="markdown-preview" v-html="renderedMarkdown" style="text-align: left; max-height: 400px; overflow-y: auto;"></div>
               </el-tab-pane>
               <el-tab-pane label="编辑源文件" name="edit">
                 <el-input 
                   type="textarea" 
                   v-model="step1Content" 
                   :rows="15" 
                   style="font-family: monospace;" 
                 />
               </el-tab-pane>
             </el-tabs>
             <div class="pane-actions" style="margin-bottom: 20px;">
               <el-button type="success" size="large" :loading="savingContent" @click="handleSaveContent">
                 保存编辑内容
               </el-button>
             </div>
          </div>

          <div class="pane-actions">
             <el-button type="primary" size="large" :loading="runningStep" @click="handleRunStep(2)">
               执行第二步 (提示词生成)
             </el-button>
             <el-button type="warning" plain size="large" :loading="runningStep" @click="handleSkipStep(2)">
               跳过步骤 2
             </el-button>
             <el-button size="large" @click="handleViewFiles">查看当前目录进展</el-button>
          </div>
        </div>

        <!-- Step 3 Pane -->
        <div v-show="viewStep === 2" class="pane">
          <h3>绘制配图</h3>
          <p>将调用 OpenAI DALL-E 模型为您批量生成相关产品图并自动保存至本地目录。由于并发限制，此步骤通常需要较长时间（预计 2~3 分钟）。</p>
          <div class="pane-actions">
             <el-button type="primary" size="large" :loading="runningStep" @click="handleRunStep(3)">
               执行第三步 (批量生图)
             </el-button>
             <el-button type="warning" plain size="large" :loading="runningStep" @click="handleSkipStep(3)">
               跳过步骤 3
             </el-button>
             <el-button size="large" @click="handleViewFiles">查看当前目录进展</el-button>
          </div>
        </div>

        <!-- Step 4 Pane -->
        <div v-show="viewStep === 3" class="pane">
          <h3>打包产出物</h3>
          <p>融合所有内容与配图至最后的高转化 HTML 模板中，并生成配套 SEO Meta 和 JSON-LD 数据。</p>
          <div class="pane-actions">
             <el-button type="primary" size="large" :loading="runningStep" @click="handleRunStep(4)">
               执行第四步 (填充打包)
             </el-button>
             <el-button size="large" @click="handleViewFiles">查看当前目录进展</el-button>
          </div>
        </div>

        <!-- Finish Pane -->
        <div v-show="viewStep === 4" class="pane finish-pane">
          <el-result
            icon="success"
            title="生成完毕！"
            sub-title="所有操作已执行完毕，请下载归档包查看成品。"
          >
            <template #extra>
              <el-button type="primary" size="large" @click="downloadPackage">
                下载 Package (ZIP)
              </el-button>
              <el-button size="large" @click="handleViewFiles">查看项目文件</el-button>
            </template>
          </el-result>
          <div class="outputs-panel" v-loading="loadingOutputs">
            <div class="outputs-header">
              <h3>最终产物预览</h3>
              <el-button size="small" @click="fetchOutputs">刷新</el-button>
            </div>
            <el-empty v-if="!outputs.length" description="暂无最终产物，请先执行第 4 步" />
            <el-tabs v-else v-model="activeOutputTab" type="border-card" class="outputs-tabs">
              <el-tab-pane label="HTML 预览" name="html-preview">
                <iframe class="html-preview-frame" :srcdoc="htmlOutput?.content || ''"></iframe>
              </el-tab-pane>
              <el-tab-pane
                v-for="output in outputs"
                :key="output.key"
                :label="output.label"
                :name="output.key"
              >
                <div class="output-toolbar">
                  <span>{{ output.file }}</span>
                  <el-button size="small" type="primary" plain @click="copyOutput(output)">
                    复制
                  </el-button>
                </div>
                <pre class="output-code"><code>{{ output.content }}</code></pre>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </div>
    </el-card>

    <div class="logs-card" v-if="project?.status">
      <h4>当前任务状态：</h4>
      <pre>{{ JSON.stringify(project.steps, null, 2) }}</pre>
    </div>

    <!-- File Explorer Dialog -->
    <el-dialog v-model="filesDialogVisible" title="项目文件目录进展" width="800px">
      <el-table :data="projectFiles" v-loading="loadingFiles" height="400" stripe style="width: 100%">
        <el-table-column prop="name" label="文件名" min-width="200">
          <template #default="scope">
            <el-icon v-if="scope.row.isDirectory" style="margin-right: 8px;"><Folder /></el-icon>
            <el-icon v-else style="margin-right: 8px;"><Document /></el-icon>
            {{ scope.row.name }}
          </template>
        </el-table-column>
        <el-table-column label="大小" width="120" align="right">
          <template #default="scope">
            <span v-if="!scope.row.isDirectory">{{ formatSize(scope.row.size) }}</span>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="修改时间" width="180" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.updatedAt) }}
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="filesDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="handleViewFiles" :loading="loadingFiles">刷新</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getProject, runStep1, runStep2, skipStep2, runStep3, skipStep3, runStep4, getDownloadUrl, getProjectContent, updateProjectContent, getProjectFiles, getProjectOutputs } from '../api/landingApi';
import client from '../api/client';
import { marked } from 'marked';

const route = useRoute();
const router = useRouter();
const projectId = route.params.id;

const project = ref(null);
const loadingPage = ref(true);
const runningStep = ref(false);
const viewStep = ref(0);
const step1Content = ref('');
const savingContent = ref(false);
const mdTab = ref('preview');

const filesDialogVisible = ref(false);
const projectFiles = ref([]);
const loadingFiles = ref(false);
const outputs = ref([]);
const loadingOutputs = ref(false);
const activeOutputTab = ref('html-preview');

const renderedMarkdown = computed(() => {
  return marked.parse(step1Content.value || '');
});

const htmlOutput = computed(() => outputs.value.find(output => output.key === 'html'));

const activeStep = computed(() => {
  if (!project.value) return 0;
  const status = project.value.status;
  if (status === 'completed') return 4;
  if (status === 'step3_done') return 3;
  if (status === 'step2_done') return 2;
  if (status === 'step1_done') return 1;
  return 0; // created or initial
});

let syncTimer = null;

async function fetchProject(isInitial = false) {
  try {
    const res = await getProject(projectId);
    if (res.data?.ok) {
      project.value = res.data.project;
      
      if (isInitial) {
        viewStep.value = activeStep.value < 4 ? activeStep.value : 4;
      }
      
      if (activeStep.value > 0 && !step1Content.value) {
         fetchStep1Content();
      }
      if (activeStep.value === 4 && outputs.value.length === 0) {
        fetchOutputs();
      }
    }
  } catch (error) {
    ElMessage.error('读取项目详情失败');
  } finally {
    loadingPage.value = false;
  }
}

async function fetchStep1Content() {
  try {
    const res = await getProjectContent(projectId);
    if (res.data?.ok) {
      step1Content.value = res.data.content;
    }
  } catch (e) {
    console.error('Error fetching step 1 content:', e);
  }
}

async function handleSaveContent() {
  savingContent.value = true;
  try {
    const res = await updateProjectContent(projectId, step1Content.value);
    if (res.data?.ok) {
      ElMessage.success('文档保存成功！');
    } else {
      throw new Error(res.data?.message || '保存失败');
    }
  } catch (error) {
    ElMessage.error(error.message || '网络错误');
  } finally {
    savingContent.value = false;
  }
}

async function handleRunStep(stepNum) {
  runningStep.value = true;
  try {
    let res;
    if (stepNum === 1) res = await runStep1(projectId);
    else if (stepNum === 2) res = await runStep2(projectId);
    else if (stepNum === 3) res = await runStep3(projectId);
    else if (stepNum === 4) res = await runStep4(projectId);
    
    if (res.data?.ok) {
      ElMessage.success(`第 ${stepNum} 步执行完毕`);
      await fetchProject();
      if (stepNum === 4) {
        viewStep.value = 4;
        await fetchOutputs();
      }
    } else {
      throw new Error(res.data?.message || '执行失败');
    }
  } catch (error) {
    console.error(error);
    const msg = error.response?.data?.message || error.message || '网络错误';
    ElMessageBox.alert(msg, `执行第 ${stepNum} 步失败`, { type: 'error' });
    await fetchProject(); // refresh state
  } finally {
    runningStep.value = false;
  }
}

async function handleSkipStep(stepNum) {
  runningStep.value = true;
  try {
    let res;
    if (stepNum === 2) res = await skipStep2(projectId);
    else if (stepNum === 3) res = await skipStep3(projectId);

    if (res?.data?.ok) {
      ElMessage.success(`步骤 ${stepNum} 已跳过`);
      await fetchProject();
      viewStep.value = stepNum;
    } else {
      throw new Error(res?.data?.message || '跳过失败');
    }
  } catch (error) {
    const msg = error.response?.data?.message || error.message || '网络错误';
    ElMessageBox.alert(msg, `跳过步骤 ${stepNum} 失败`, { type: 'error' });
    await fetchProject();
  } finally {
    runningStep.value = false;
  }
}

function downloadPackage() {
  const url = getDownloadUrl(projectId);
  window.open(url, '_blank');
}

async function handleViewFiles() {
  filesDialogVisible.value = true;
  loadingFiles.value = true;
  try {
    const res = await getProjectFiles(projectId);
    if (res.data?.ok) {
      projectFiles.value = res.data.files;
    }
  } catch (error) {
    ElMessage.error('获取文件列表失败');
  } finally {
    loadingFiles.value = false;
  }
}

async function fetchOutputs() {
  loadingOutputs.value = true;
  try {
    const res = await getProjectOutputs(projectId);
    if (res.data?.ok) {
      outputs.value = (res.data.outputs || []).filter(output => output.exists);
      if (activeOutputTab.value !== 'html-preview' && !outputs.value.some(output => output.key === activeOutputTab.value)) {
        activeOutputTab.value = 'html-preview';
      }
    }
  } catch (error) {
    ElMessage.error('获取最终产物失败');
  } finally {
    loadingOutputs.value = false;
  }
}

async function copyOutput(output) {
  try {
    await navigator.clipboard.writeText(output.content || '');
    ElMessage.success(`${output.label} 已复制`);
  } catch (error) {
    ElMessage.error('复制失败，请手动选择内容复制');
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString();
}

onMounted(() => {
  fetchProject(true);
  syncTimer = setInterval(() => fetchProject(false), 10000); 
});

onUnmounted(() => {
  if (syncTimer) clearInterval(syncTimer);
});
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}
.header-section {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}
.title {
  margin: 0;
  font-size: 20px;
  color: var(--el-text-color-primary);
}
.stepper-card {
  margin-bottom: 24px;
  padding: 20px;
}
.step-content {
  margin-top: 40px;
  min-height: 250px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.pane {
  text-align: center;
  max-width: 600px;
}
.finish-pane {
  max-width: 1080px;
  width: 100%;
}
.pane h3 {
  font-size: 22px;
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}
.pane p {
  color: var(--el-text-color-regular);
  line-height: 1.6;
  margin-bottom: 30px;
}
.pane-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}
.outputs-panel {
  margin-top: 24px;
  text-align: left;
  width: 100%;
}
.outputs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.outputs-header h3 {
  margin: 0;
}
.outputs-tabs {
  width: 100%;
}
.html-preview-frame {
  width: 100%;
  height: 560px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: #fff;
}
.output-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.output-code {
  max-height: 560px;
  overflow: auto;
  margin: 0;
  padding: 16px;
  border-radius: 4px;
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.6;
}
.logs-card {
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 16px;
}
.logs-card h4 {
  margin-top: 0;
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 13px;
  color: #666;
}

/* Markdown Preview Styles */
.markdown-preview {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}
.markdown-preview h1, .markdown-preview h2, .markdown-preview h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
.markdown-preview h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
.markdown-preview h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
.markdown-preview h3 { font-size: 1.25em; }
.markdown-preview p { margin-top: 0; margin-bottom: 16px; }
.markdown-preview ul, .markdown-preview ol { padding-left: 2em; margin-bottom: 16px; }
.markdown-preview li { margin-bottom: 4px; }
.markdown-preview code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27,31,35,0.05);
  border-radius: 3px;
  font-family: monospace;
}
.markdown-preview pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 3px;
}
.markdown-preview pre code {
  background-color: transparent;
  padding: 0;
}
.markdown-preview blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0 0 16px 0;
}
</style>
