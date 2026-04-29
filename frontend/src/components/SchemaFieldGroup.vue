<template>
  <div class="field-group">
    <template v-for="field in fields" :key="field.path">
      <section v-if="field.type === 'object'" class="field-section content-card">
        <div class="field-section__header">
          <h3>{{ formatLabel(field) }}</h3>
          <p v-if="field.description">{{ field.description }}</p>
        </div>
        <SchemaFieldGroup :fields="field.fields" :model="model[field.key]" />
      </section>

      <el-form-item v-else :label="formatLabel(field)" class="field-item">
        <el-select
          v-if="field.type === 'enum'"
          v-model="model[field.key]"
          class="field-control"
          placeholder="请选择"
        >
          <el-option v-for="option in field.enum" :key="option" :label="option" :value="option" />
        </el-select>

        <el-input
          v-else
          v-model="model[field.key]"
          :type="shouldUseTextarea(field) ? 'textarea' : 'text'"
          :rows="shouldUseTextarea(field) ? 4 : undefined"
          :placeholder="field.example || buildPlaceholder(field)"
        />

        <div v-if="field.description" class="field-hint">{{ field.description }}</div>
      </el-form-item>
    </template>
  </div>
</template>

<script setup>
defineOptions({
  name: 'SchemaFieldGroup'
});

const props = defineProps({
  fields: {
    type: Array,
    required: true
  },
  model: {
    type: Object,
    required: true
  }
});

function formatLabel(field) {
  return field.required ? `${field.label} *` : field.label;
}

function shouldUseTextarea(field) {
  return ['desc', 'subtitle', 'answer', 'notes', 'headline', 'question', 'title', 'value', 'sub'].some((keyword) => (
    field.key.includes(keyword) || field.path.includes(keyword)
  ));
}

function buildPlaceholder(field) {
  if (field.type === 'url') {
    return 'https://';
  }
  return '请输入内容';
}
</script>

<style scoped>
.field-group {
  display: grid;
  gap: 18px;
}

.field-section {
  padding: 20px;
}

.field-section__header {
  margin-bottom: 16px;
}

.field-section__header h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.field-section__header p {
  margin: 0;
  color: #617181;
  line-height: 1.6;
}

.field-item {
  margin-bottom: 0;
}

.field-control {
  width: 100%;
}

.field-hint {
  margin-top: 8px;
  color: #728292;
  font-size: 12px;
  line-height: 1.6;
}
</style>
