<template>
  <div class="login-shell">
    <div class="login-panel content-card">
      <div class="hero">
        <p class="eyebrow">Google Console Tools</p>
        <h1>站点收录任务后台</h1>
        <p class="desc">导入 Excel，批量提交 Google Indexing API，或批量查询 Search Console 收录状态。</p>
      </div>

      <el-form :model="form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" class="submit" size="large" @click="handleLogin" :loading="loading">
          登录
        </el-button>
        <p class="hint">默认账号: admin / 123456</p>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const form = reactive({ username: 'admin', password: '123456' });

async function handleLogin() {
  loading.value = true;
  try {
    await authStore.login(form);
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-panel {
  width: min(920px, 100%);
  padding: 38px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 36px;
}

.eyebrow {
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary);
  font-size: 12px;
}

.hero h1 {
  margin: 0 0 16px;
  font-size: 42px;
  line-height: 1.08;
}

.desc,
.hint {
  color: #655a4b;
}

.submit {
  width: 100%;
  background: var(--primary);
  border-color: var(--primary);
}

@media (max-width: 900px) {
  .login-panel {
    grid-template-columns: 1fr;
  }
}
</style>
