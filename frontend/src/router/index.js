import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import MainLayout from '../components/MainLayout.vue';
import DashboardView from '../views/DashboardView.vue';
import IndexingView from '../views/IndexingView.vue';
import InspectionView from '../views/InspectionView.vue';
import DuplicateKeywordView from '../views/DuplicateKeywordView.vue';
import ScenarioKeywordExamplesArticleGeneratorView from '../views/ScenarioKeywordExamplesArticleGeneratorView.vue';
import ScenarioKeywordExpansionView from '../views/ScenarioKeywordExpansionView.vue';
import ArticleGenerationView from '../views/ArticleGenerationView.vue';
import TemplateSchemaGeneratorView from '../views/TemplateSchemaGeneratorView.vue';
import SettingsView from '../views/SettingsView.vue';
import UserManagementView from '../views/UserManagementView.vue';
import LandingProjects from '../views/LandingProjects.vue';
import LandingGenerator from '../views/LandingGenerator.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: DashboardView },
        { path: 'indexing', name: 'indexing', component: IndexingView },
        { path: 'inspection', name: 'inspection', component: InspectionView },
        { path: 'duplicate-keywords', name: 'duplicate-keywords', component: DuplicateKeywordView },
        {
          path: 'scenario-keyword-examples-article-generator',
          name: 'scenario-keyword-examples-article-generator',
          component: ScenarioKeywordExamplesArticleGeneratorView
        },
        {
          path: 'scenario-keyword-expansion',
          name: 'scenario-keyword-expansion',
          component: ScenarioKeywordExpansionView
        },
        {
          path: 'article-generation',
          name: 'article-generation',
          component: ArticleGenerationView
        },
        {
          path: 'template-schema-generator',
          name: 'template-schema-generator',
          component: TemplateSchemaGeneratorView
        },
        {
          path: 'landing-projects',
          name: 'landing-projects',
          component: LandingProjects
        },
        {
          path: 'landing-generator/:id',
          name: 'landing-generator',
          component: LandingGenerator
        },
        { path: 'settings', name: 'settings', component: SettingsView, meta: { requiresAdmin: true } },
        { path: 'users', name: 'users', component: UserManagementView, meta: { requiresAdmin: true } }
      ]
    }
  ]
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (to.path !== '/login' && !authStore.isLoggedIn) {
    return '/login';
  }
  if (to.path === '/login' && authStore.isLoggedIn) {
    return '/dashboard';
  }
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return '/dashboard';
  }
  return true;
});

export default router;
