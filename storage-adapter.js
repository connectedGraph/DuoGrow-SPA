// Capacitor Storage 适配器 - 自动兼容浏览器和 Android
const isCapacitorAvailable = typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences;

let StorageAdapter;

if (isCapacitorAvailable) {
  // Android 环境：使用 Capacitor Preferences
  const { Preferences } = window.Capacitor.Plugins;

  StorageAdapter = {
    async getItem(key) {
      const { value } = await Preferences.get({ key });
      return value;
    },

    async setItem(key, value) {
      await Preferences.set({ key, value });
    },

    async removeItem(key) {
      await Preferences.remove({ key });
    },

    async clear() {
      await Preferences.clear();
    }
  };
} else {
  // 浏览器环境：降级为 localStorage
  StorageAdapter = {
    async getItem(key) {
      return localStorage.getItem(key);
    },

    async setItem(key, value) {
      localStorage.setItem(key, value);
    },

    async removeItem(key) {
      localStorage.removeItem(key);
    },

    async clear() {
      localStorage.clear();
    }
  };
}

export { StorageAdapter };
