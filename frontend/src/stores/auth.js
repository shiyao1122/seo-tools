import { defineStore } from 'pinia';
import client from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    isAdmin: (state) => state.user?.role === 'admin'
  },
  actions: {
    async login(payload) {
      const { data } = await client.post('/auth/login', payload);
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});
