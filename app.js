// app_v2.js
// GitHub diff 테스트용 복잡한 더미 파일 (v2)

const CONFIG = {
  appName: "DiffTester",
  version: "1.1.0", // 버전 변경
  retryCount: 2, // 재시도 횟수 감소
  enableCache: false, // 캐시 비활성화
  api: {
    baseUrl: "https://api.example.com/v2", // baseUrl 변경
    timeout: 2000, // timeout 감소
  },
};

class CacheManager {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttl = 3000) {
    const expiresAt = Date.now() + ttl;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      console.info("Cache expired:", key); // 로그 변경
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  remove(key) {
    // 신규 메서드
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const cache = new CacheManager();

function buildUrl(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  if (!query) return `${CONFIG.api.baseUrl}${path}`; // 조건 분기 추가
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

      return {
        ...data,
        fetchedAt: new Date().toISOString(), // 신규 필드
      };
    } catch (error) {
      attempts++;
      console.warn(`Retry ${attempts}/${CONFIG.retryCount}`, error.message);

      if (attempts >= CONFIG.retryCount) {
        return { error: true, message: "Request failed completely" }; // throw 대신 return
      }
    }
  }
}

// 더미 fetch (v2: 데이터 구조 변경)
async function fakeFetch(url) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        status: 200,
        json: async () => ({
          url,
          meta: {
            requestId: Math.random().toString(36).slice(2),
          },
          items: [
            { id: 1, name: "Alpha", active: true, score: 10 },
            { id: 2, name: "Beta", active: true, score: 5 },
            { id: 3, name: "Gamma", active: false, score: 1 },
          ],
        }),
      });
    }, Math.random() * 400);
  });
}

// 비즈니스 로직 변경
function filterActiveItems(items) {
  return items.filter((item) => item.active && item.score > 3); // 조건 추가
}

function mapItemNames(items) {
  return items.map((item) => `${item.name.toLowerCase()}-${item.score}`); // 포맷 변경
}

function summarize(items) {
  return {
    total: items.length,
    activeCount: items.filter((i) => i.active).length,
    maxScore: Math.max(...items.map((i) => i.score)), // 신규 필드
  };
}

// 신규 유틸 함수
function sortByScoreDesc(items) {
  return [...items].sort((a, b) => b.score - a.score);
}

// 상태 관리 객체
const state = {
  loading: false,
  error: null,
  data: [],
  lastUpdated: null, // 신규 필드
};

async function loadItems() {
  state.loading = true;
  state.error = null;

  const result = await request("/items", {
    params: { limit: 5, sort: "score" }, // params 변경
  });

  if (result.error) {
    state.error = result.message;
    state.loading = false;
    return;
  }

  const sorted = sortByScoreDesc(result.items);
  const activeItems = filterActiveItems(sorted);
  const names = mapItemNames(activeItems);

  state.data = names;
  state.lastUpdated = result.fetchedAt;

  console.log("Loaded items(v2):", names);
  console.log("Summary(v2):", summarize(result.items));

  state.loading = false;
}

// 실행
(async function main() {
  console.log(`${CONFIG.appName} v${CONFIG.version} booting...`);

  await loadItems();

  console.log("Final state(v2):", state);
})();
