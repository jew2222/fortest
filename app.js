// GitHub diff 테스트용

const CONFIG = {
  appName: "DiffTester",
  version: "1.0.0",
  retryCount: 3,
  enableCache: true,
  api: {
    baseUrl: "https://api.example.com",
    timeout: 3000,
  },
};

class CacheManager {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttl = 5000) {
    const expiresAt = Date.now() + ttl;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.store.clear();
  }
}

const cache = new CacheManager();

function buildUrl(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `${CONFIG.api.baseUrl}${path}?${query}`;
}

async function request(path, options = {}) {
  const url = buildUrl(path, options.params);
  const cacheKey = `${path}:${JSON.stringify(options.params || {})}`;

  if (CONFIG.enableCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log("Cache hit:", cacheKey);
      return cached;
    }
  }

  let attempts = 0;

  while (attempts < CONFIG.retryCount) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.api.timeout,
      );

      const response = await fakeFetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (CONFIG.enableCache) {
        cache.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      attempts++;
      console.warn(`Request failed (${attempts}):`, error.message);

      if (attempts >= CONFIG.retryCount) {
        throw new Error("Max retry reached");
      }
    }
  }
}

// 더미 fetch (실제 네트워크 없음)
async function fakeFetch(url) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        status: 200,
        json: async () => ({
          url,
          timestamp: Date.now(),
          items: [
            { id: 1, name: "Alpha", active: true },
            { id: 2, name: "Beta", active: false },
          ],
        }),
      });
    }, Math.random() * 500);
  });
}

// 비즈니스 로직
function filterActiveItems(items) {
  return items.filter((item) => item.active);
}

function mapItemNames(items) {
  return items.map((item) => item.name.toUpperCase());
}

function summarize(items) {
  return {
    total: items.length,
    activeCount: items.filter((i) => i.active).length,
  };
}

// 상태 관리 객체
const state = {
  loading: false,
  error: null,
  data: [],
};

async function loadItems() {
  state.loading = true;
  state.error = null;

  try {
    const result = await request("/items", {
      params: { limit: 10, sort: "desc" },
    });

    const activeItems = filterActiveItems(result.items);
    const names = mapItemNames(activeItems);

    state.data = names;

    console.log("Loaded items:", names);
    console.log("Summary:", summarize(result.items));
  } catch (err) {
    state.error = err.message;
    console.error("Load failed:", err.message);
  } finally {
    state.loading = false;
  }
}

// 실행
(async function main() {
  console.log(`${CONFIG.appName} v${CONFIG.version} starting...`);

  await loadItems();

  // 캐시 테스트
  await loadItems();

  console.log("Final state:", state);
})();
