// GitHub diff 테스트용


/**
 * 앱 전역 설정 상수
 * @readonly
 * @type {{APP_NAME: string, VERSION: string, RETRY_COUNT: number, ENABLE_CACHE: boolean, API: {BASE_URL: string, TIMEOUT: number}}}
 */

// 매직넘버 및 상수 분리
const DEFAULT_TTL = 5000;
const DEFAULT_API_PATH = "/items";
const DEFAULT_API_PARAMS = Object.freeze({ limit: 10, sort: "desc" });

const CONFIG = Object.freeze({
  APP_NAME: "DiffTester",
  VERSION: "1.0.0",
  RETRY_COUNT: 3,
  ENABLE_CACHE: true,
  API: Object.freeze({
    BASE_URL: "https://api.example.com",
    TIMEOUT: 3000,
  }),
});


/**
 * 간단한 메모리 캐시 매니저
 * @class
 */
/**
 * 캐시 인스턴스 (싱글톤)
 * @type {CacheManager}
 */
class CacheManager {
  constructor() {
    this._store = new Map();
  }


  set(key, value, ttl = DEFAULT_TTL) {
    if (!key) throw new Error("Cache key는 필수입니다.");
    if (ttl <= 0) throw new Error("TTL은 0보다 커야 합니다.");
    const expiresAt = Date.now() + ttl;
    this._store.set(key, { value, expiresAt });
  }

  get(key) {
    if (!key) return null;
    const item = this._store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return item.value;
  }

  clear() {
    this._store.clear();
  }
}


const cache = new CacheManager();


/**
 * API URL 생성 함수
 * @param {string} path - API 경로
 * @param {object} [params] - 쿼리 파라미터 객체
 * @returns {string} 완성된 URL
 */
function buildUrl(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `${CONFIG.API.BASE_URL}${path}${query ? `?${query}` : ''}`;
}


/**
 * API 요청 함수 (캐시, 재시도, 타임아웃 지원)
 * @param {string} path - API 경로
 * @param {object} [options] - 요청 옵션 (params 등)
 * @returns {Promise<any>} 응답 데이터
 */
async function request(path, options = {}) {
  const url = buildUrl(path, options.params);
  const cacheKey = `${path}:${JSON.stringify(options.params || {})}`;

  if (CONFIG.ENABLE_CACHE) {
    try {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log("Cache hit:", cacheKey);
        return cached;
      }
    } catch (e) {
      console.warn("캐시 조회 중 오류:", e.message);
    }
  }

  let attempts = 0;
  while (attempts < CONFIG.RETRY_COUNT) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);
      const response = await fakeFetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error("응답 데이터 형식 오류");
      if (CONFIG.ENABLE_CACHE) {
        try {
          cache.set(cacheKey, data);
        } catch (e) {
          console.warn("캐시 저장 실패:", e.message);
        }
      }
      return data;
    } catch (error) {
      attempts++;
      console.warn(`Request failed (${attempts}):`, error.message);
      if (attempts >= CONFIG.RETRY_COUNT) throw new Error("Max retry reached: " + error.message);
    }
  }
}


/**
 * 네트워크 대체용 더미 fetch 함수
 * @param {string} url - 요청 URL
 * @returns {Promise<{ok: boolean, status: number, json: function(): Promise<object>}>}
 */
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


/**
 * 활성 아이템만 필터링
 * @param {Array<{id:number, name:string, active:boolean}>} items
 * @returns {Array<{id:number, name:string, active:boolean}>}
 */
function filterActiveItems(items) {
  return items.filter((item) => item.active);
}

/**
 * 아이템 이름을 대문자로 변환
 * @param {Array<{id:number, name:string, active:boolean}>} items
 * @returns {Array<string>}
 */
function mapItemNames(items) {
  return items.map((item) => item.name.toUpperCase());
}

/**
 * 아이템 요약 정보 반환
 * @param {Array<{id:number, name:string, active:boolean}>} items
 * @returns {{total: number, activeCount: number}}
 */
function summarize(items) {
  return {
    total: items.length,
    activeCount: items.filter((i) => i.active).length,
  };
}


/**
 * 앱 상태 관리 객체
 * @type {{loading: boolean, error: string|null, data: Array<string>}}
 */
const state = {
  loading: false,
  error: null,
  data: [],
};


/**
 * 아이템 목록을 불러와 상태에 반영
 * @returns {Promise<void>}
 */
async function loadItems() {
  state.loading = true;
  state.error = null;
  try {
    const result = await request(DEFAULT_API_PATH, {
      params: DEFAULT_API_PARAMS,
    });
    if (!result || !Array.isArray(result.items)) {
      throw new Error("API 응답에 items 배열이 없습니다.");
    }
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


/**
 * 메인 실행 함수
 * @returns {Promise<void>}
 */
(async function main() {
  console.log(`${CONFIG.APP_NAME} v${CONFIG.VERSION} starting...`);
  await loadItems();
  // 캐시 테스트
  await loadItems();
  console.log("Final state:", state);
})();
