<template>
  <div class="layout page-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">GC</span>
        <div>
          <strong>Google Console Tools</strong>
          <p>本地管理后台</p>
        </div>
      </div>

      <el-menu
        :default-active="$route.path"
        class="menu"
        background-color="transparent"
        text-color="#d7e1eb"
        active-text-color="#f4c88a"
        router
      >
        <el-menu-item index="/dashboard">概览</el-menu-item>
        <el-menu-item index="/indexing">批量提交收录</el-menu-item>
        <el-menu-item index="/inspection">批量查询收录</el-menu-item>
        <el-menu-item index="/duplicate-keywords">重复关键词筛选</el-menu-item>
        <el-menu-item index="/scenario-keyword-examples-article-generator">场景关键词示例文章生成</el-menu-item>
        <el-menu-item index="/scenario-keyword-expansion">场景关键词拓展</el-menu-item>
        <el-menu-item index="/article-generation">文章生成</el-menu-item>
        <el-menu-item index="/template-schema-generator">模板 Schema 生成</el-menu-item>
        <el-menu-item index="/landing-projects">SEO 落地页生成</el-menu-item>
        <el-menu-item v-if="authStore.isAdmin" index="/settings">系统设置</el-menu-item>
        <el-menu-item v-if="authStore.isAdmin" index="/users">用户管理</el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <div class="account">账号: {{ authStore.user?.username || 'admin' }}</div>
        <el-button type="warning" plain @click="logout">退出登录</el-button>
        <div class="app-version">前端 v{{ appVersion }}</div>
        <div class="app-version">后端 {{ backendVersionText }}</div>
      </div>
    </aside>

    <main class="main-area">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import packageInfo from '../../package.json';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const appVersion = packageInfo.version;
const backendVersion = ref('--');
const backendVersionText = computed(() => (
  backendVersion.value === '--' ? '未获取到版本' : `v${backendVersion.value}`
));

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(async () => {
  try {
    const { data } = await client.get('/health');
    backendVersion.value = data?.version || '--';
  } catch {
    backendVersion.value = '--';
  }
});
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  align-self: flex-start;
  display: flex;
  flex: 0 0 260px;
  flex-direction: column;
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  height: 100vh;
  padding: 28px 18px;
  overflow-y: auto;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 20%),
    linear-gradient(180deg, #18222d 0%, #10171f 100%);
  color: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}

.brand strong {
  display: block;
  font-size: 16px;
}

.brand p {
  margin: 6px 0 0;
  color: #92a6b7;
  font-size: 12px;
}

.brand-mark {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: linear-gradient(135deg, #d98d43, #8d491f);
  box-shadow: 0 12px 28px rgba(208, 138, 63, 0.32);
}

.menu {
  border-right: none;
  flex: 1;
  min-height: 0;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 24px;
}

.app-version {
  margin-top: 14px;
  color: #6f8597;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.account {
  margin-bottom: 12px;
  color: #92a6b7;
}

.main-area {
  flex: 1;
  min-width: 0;
  padding: 28px;
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }

  .sidebar {
    position: static;
    top: auto;
    align-self: stretch;
    flex: none;
    width: 100%;
    min-width: 100%;
    max-width: 100%;
    height: auto;
    overflow-y: visible;
  }

  .sidebar-footer {
    margin-top: 18px;
    padding-top: 0;
  }
}
</style>
