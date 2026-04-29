<template>
  <div class="users-page">
    <section class="content-card panel">
      <div class="intro">
        <p class="eyebrow">User Admin</p>
        <h2>用户管理</h2>
        <p>仅管理员可创建和删除账号。普通用户只能使用任务相关功能，不能访问系统设置和用户管理。</p>
      </div>

      <el-form label-position="top" :model="form" class="user-form">
        <div class="inline-fields">
          <el-form-item label="用户名">
            <el-input v-model="form.username" placeholder="例如 seo-operator" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
          </el-form-item>
          <el-form-item label="角色">
            <el-select v-model="form.role">
              <el-option label="普通用户" value="user" />
              <el-option label="管理员" value="admin" />
            </el-select>
          </el-form-item>
        </div>
        <el-button type="primary" :loading="creating" @click="handleCreateUser">创建用户</el-button>
      </el-form>
    </section>

    <section class="content-card panel">
      <div class="table-head">
        <h3>用户列表</h3>
        <el-button @click="fetchUsers">刷新</el-button>
      </div>
      <el-table :data="users" stripe>
        <el-table-column prop="username" label="用户名" min-width="180" />
        <el-table-column prop="role" label="角色" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="220">
          <template #default="{ row }">{{ formatBeijingTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-popconfirm
              title="确认删除这个用户吗？"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="handleDeleteUser(row)"
            >
              <template #reference>
                <el-button link type="danger" :disabled="row.username === 'admin' || row.id === authStore.user?.id">
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import client from '../api/client';
import { useAuthStore } from '../stores/auth';
import { formatBeijingTime } from '../utils/time';

const authStore = useAuthStore();
const users = ref([]);
const creating = ref(false);
const form = reactive({
  username: '',
  password: '',
  role: 'user'
});

async function fetchUsers() {
  const { data } = await client.get('/users');
  users.value = data;
}

async function handleCreateUser() {
  creating.value = true;
  try {
    await client.post('/users', form);
    ElMessage.success('用户已创建');
    form.username = '';
    form.password = '';
    form.role = 'user';
    await fetchUsers();
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '创建用户失败');
  } finally {
    creating.value = false;
  }
}

async function handleDeleteUser(row) {
  try {
    await client.delete(`/users/${row.id}`);
    ElMessage.success('用户已删除');
    await fetchUsers();
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '删除用户失败');
  }
}

onMounted(fetchUsers);
</script>

<style scoped>
.users-page {
  display: grid;
  gap: 20px;
}

.panel {
  padding: 24px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--primary);
  font-size: 12px;
}

.intro h2,
.table-head h3 {
  margin: 0 0 8px;
}

.user-form {
  margin-top: 20px;
}

.inline-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

@media (max-width: 960px) {
  .inline-fields {
    grid-template-columns: 1fr;
  }
}
</style>
