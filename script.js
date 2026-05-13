// 本地持久化键名集中管理。
const STORAGE_KEYS = {
    config: "mom_english_config",
    expressions: "mom_english_expressions",
    currentLesson: "mom_english_current_lesson",
    savedLessons: "mom_english_saved_lessons",
    lessonCache: "mom_english_lesson_cache",
    audioCache: "mom_english_audio_cache",
    dailyMemoryCard: "mom_english_daily_memory_card"
};

const STORAGE_VERSION = 2;

// 本地持久化仓储规格映射。
const STORAGE_REPO_SPEC = {
    config: [STORAGE_KEYS.config, {}],
    lessons: [STORAGE_KEYS.savedLessons, []],
    expressions: [STORAGE_KEYS.expressions, []],
    current: [STORAGE_KEYS.currentLesson, null],
    lessonCache: [STORAGE_KEYS.lessonCache, {}],
    audioCache: [STORAGE_KEYS.audioCache, {}],
    memoryCard: [STORAGE_KEYS.dailyMemoryCard, {}]
};

// 本地持久化仓储统一处理 JSON 读写。
const StorageRepo = Object.fromEntries(
    Object.entries(STORAGE_REPO_SPEC).map(([name, [key, fallback]]) => [
        name,
        {
            load: () => storageGet(key, fallback),
            save: value => storageSet(key, value)
        }
    ])
);

// 保存课程仓储负责保存内容的列表和引用查询。
const SavedLessonRepo = {
    list: () => loadSavedLessons(),
    ref: value => String(value ?? ""),
    isSameRef: (lesson, ref) => {
        const target = SavedLessonRepo.ref(ref);
        return !!target && [lesson?.id, lesson?.key].some(value => SavedLessonRepo.ref(value) === target);
    },
    isSameLesson: (left, right) =>
        SavedLessonRepo.isSameRef(left, right?.id) || SavedLessonRepo.isSameRef(left, right?.key),
    findByRef: (ref, list = loadSavedLessons()) =>
        (list || []).find(item => SavedLessonRepo.isSameRef(item, ref)) || null
};

// 从本地存储读取 JSON 值并在失败时返回兜底值。
function storageGet(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
    } catch {
        return fallback;
    }
}

// 将 JSON 值写入本地存储。
function storageSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// 默认接口和模型配置。
const DEFAULT_CONFIG = {
    apiBase: "your_api_base_url",
    apiKey: "",
    ttsSecret: "",
    password: "",
    model: "gpt-5.4",
    fallbackModel: "gpt-5.4-mini",
};

// 生成内容要求的统一 JSON 结构。
const GENERATION_JSON_SCHEMA = `JSON 结构：
{
  "topic": "string",
  "target_count": 5,
  "input_type": "noun | scene | sentence | question | review",
  "level": "beginner",
  "core_word": {
    "english": "string",
    "chinese": "string",
    "phonics_hint": "string"
  },
  "expressions": [
    {
      "english": "string",
      "chinese": "string",
      "scene": "string",
      "note": "string"
    }
  ],
  "kid_activity": {
    "title": "string",
    "steps": ["string", "string", "string"]
  },
  "review_questions": [
    {
      "type": "zh_to_en | en_to_zh",
      "question": "string",
      "answer": "string"
    }
  ],
  "encouragement": "string"
}`;

// 生成模式配置集中承载提示词和数量。
const GENERATION_PROFILES = {
    compact: {
        mode: "compact",
        count: 5,
        shortName: "精简版亲子英语表达包",
        systemPrompt: `你是一个“妈妈亲子英语优先级筛选助手”，专门帮50多岁的中文妈妈从一个家庭场景里挑出最值得先学、最容易马上说出口的英语短句。

你的目标是少而准。不要铺开太多表达，不要同义重复，不要为了覆盖面牺牲顺口度。每一句都要像妈妈今天就能对孩子说出来的话，短、自然、生活化，适合幼儿场景。

你必须严格生成5个英文表达。5句之间要功能不同，形成最小可用组合：引入主题、简单描述、常用问句、互动动作、表扬或收束。

输出必须温暖、具体、可直接开口。严格输出 JSON，不要 Markdown，不要额外解释。For API compatibility, the final answer must be a valid json object.

${GENERATION_JSON_SCHEMA}`,
        buildUserPrompt: userInput => `用户今天想学：${userInput}

请为她生成一组“精简版亲子英语表达包”。

要求：
- 严格生成5个英文表达
- 这5句必须是这个主题下最值得优先学、最常用、最容易马上对小孩说出口的句子
- 适合50多岁中文妈妈学习
- 适合对小孩说
- 短句、自然、生活化
- 每句都要有中文意思和使用场景
- 5句之间尽量功能不同，不要高度重复
- 优先覆盖：
  1. 认物或引入主题
  2. 一个简单描述
  3. 一个常用问句
  4. 一个互动或动作句
  5. 一个表扬、回应或收束句
- 生成一个1分钟小游戏
- 生成3道简单复习题
- 严格输出JSON`
    },
    rich: {
        mode: "rich",
        count: 10,
        shortName: "丰富版亲子英语表达包",
        systemPrompt: `你是一个“亲子英语互动流程设计师”，专门帮50多岁的中文妈妈把一个家庭场景整理成一套可以连续使用的英语小脚本。

你的目标不是翻译词语，而是设计一组自然、不重复、能从开场用到收尾的亲子英语表达。每句都必须短、口语化、适合对幼儿说，不能出现考试式解释、复杂语法或成人化表达。

你必须严格生成10个英文表达。10句之间要承担不同功能，避免同义换皮、句式重复和场景重复。优先让句子组成一个小型互动流程：引入主题、观察描述、提问、动作互动、鼓励、回应、自然结束。

输出必须温暖、具体、可直接开口。严格输出 JSON，不要 Markdown，不要额外解释。For API compatibility, the final answer must be a valid json object.

${GENERATION_JSON_SCHEMA.replace('"target_count": 5', '"target_count": 10')}`,
        buildUserPrompt: userInput => `用户今天想学：${userInput}

请为她生成一组“丰富版亲子英语表达包”。

要求：
- 严格生成10个英文表达
- 这10句要围绕同一个主题，组成一套更完整的亲子互动语言库
- 适合50多岁中文妈妈学习
- 适合对小孩说
- 短句、自然、生活化
- 每句都要有中文意思和使用场景
- 不要为了凑数量而生成高度重复的句子
- 10句要尽量覆盖不同用途：
  1. 认物或引入主题
  2. 两个简单描述句
  3. 两个常用问句
  4. 两个动作或互动指令
  5. 一个鼓励句
  6. 一个简单回应句
  7. 一个自然收束句
- 如果主题很适合，可以让10句形成一个小型互动流程，从开始到结束都能用
- 生成一个1到2分钟亲子小游戏
- 生成5道简单复习题
- 严格输出JSON`
    }
};

// LLM 调用策略按顺序尝试。
const LLM_STRATEGIES = [
    messages => generateLessonWithResponses(messages),
    (messages, previousError) => generateLessonWithChatCompletions(messages, previousError)
];

// Sheet 弹层 DOM 与关闭清理配置。
const SHEETS = {
    settings: {
        overlay: "sheetOverlay",
        sheet: "settingsSheet"
    },
    guide: {
        overlay: "guideOverlay",
        sheet: "guideSheet"
    },
    image: {
        overlay: "imageOverlay",
        sheet: "imageSheet",
        cleanup: () => {
            elements.imagePreviewContent.innerHTML = "";
        }
    },
    delete: {
        overlay: "deleteOverlay",
        sheet: "deleteConfirmSheet",
        cleanup: () => {
            appState.pendingDeleteLessonId = "";
        }
    },
    doubao: {
        overlay: "doubaoOverlay",
        sheet: "doubaoSheet",
        cleanup: () => {
            appState.pendingDoubaoLessonId = "";
        }
    },
    github: {
        overlay: "githubOverlay",
        sheet: "githubSheet"
    }
};

// 课程 Sheet 打开器集中处理不同弹层的准备逻辑。
const LESSON_SHEET_OPENERS = {
    delete: lesson => {
        appState.pendingDeleteLessonId = String(lesson.id || lesson.key || "");
        elements.deleteConfirmTitle.textContent = `删除“${lesson.topic || "这组"}”？`;
        elements.deleteConfirmCopy.textContent = `会直接删除仓库里的这组内容和对应复习句子：${lesson.expressions.length} 句。这个操作不能在应用里恢复。`;
    },
    doubao: lesson => {
        appState.pendingDoubaoLessonId = String(lesson.id || lesson.key || "");
        elements.doubaoPromptText.value = buildDoubaoPrompt(lesson);
    }
};

// Toast 类型图标映射。
const TOAST_ICON = {
    success: "✅",
    error: "❌",
    info: "✨"
};

// 可通过 URL 进入的页面白名单。
const VALID_TABS = new Set(["learn", "book", "review", "play"]);

// 生成按钮加载态配置。
const GENERATE_BTN_CONFIG = [{
        nodeKey: "generateFiveBtn",
        mode: "compact",
        idle: "生成 5 句",
        busy: "生成 5 句中..."
    },
    {
        nodeKey: "generateTenBtn",
        mode: "rich",
        idle: "生成 10 句",
        busy: "生成 10 句中..."
    }
];

// 播放模式文案按范围和前后台模式集中管理。
const PLAYBACK_COPY = {
    warehouse: {
        foreground: {
            start: "开始循环听仓库，每句两遍，播完会从头再来。",
            stop: "仓库轮播已停止。",
            startLabel: "循环听仓库",
            stopLabel: "停止轮播语音"
        },
        background: {
            start: "开始后台听仓库。需要停止时请回到页面点停止，或清空应用后台。",
            stop: "后台听仓库已停止。",
            startLabel: "后台听仓库",
            stopLabel: "停止后台听"
        }
    },
    lesson: {
        foreground: {
            start: "开始循环听这一组，每句两遍。",
            stop: "这一组已停止。"
        },
        background: {
            start: "开始后台循环这一组。需要停止时请回到页面点停止，或清空应用后台。",
            stop: "这一组后台循环已停止。",
            startLabel: "后台循环播放",
            stopLabel: "停止后台循环"
        }
    }
};

// 图片预览中的加载和错误占位。
const IMAGE_PREVIEW_HTML = {
    loading: `<div class="empty-card"><strong>正在生成图片...</strong><p>稍等一下，马上就能长按保存。</p></div>`,
    error: `<div class="empty-card"><strong>图片生成失败了。</strong><p>可以稍后再试一次。</p></div>`
};

// 图片预览配置按来源集中构建。
const IMAGE_PREVIEW_BUILDERS = {
    memoryCard: ({
        card
    }) => ({
        title: "记忆卡片",
        copy: "长按下面这张图，保存到相册。卡片和旁白会一起保存，妈妈之后打开相册就能复看。",
        alt: "妈妈亲子英语记忆卡片",
        successMessage: "图片好了，长按保存到相册。",
        getCanvas: () => html2canvas(card, {
            backgroundColor: null,
            scale: 2
        })
    }),
    lesson: ({
        lesson
    }) => ({
        title: lesson.topic || "保存图片",
        copy: "长按下面这张图，保存到相册。之后回来复看，也可以在仓库里重复听。",
        alt: lesson.topic || "亲子英语保存图",
        successMessage: "图片好了，长按就能保存到相册。",
        getCanvas: () => renderLessonCanvas(lesson)
    })
};

// 仓库搜索字段统一列出可匹配的课程内容。
const WAREHOUSE_SEARCH_FIELDS = item => [
    item.topic,
    item.core_word?.english,
    item.core_word?.chinese,
    item.encouragement,
    ...(item.expressions || []).flatMap(expression => [
        expression.english,
        expression.chinese,
        expression.scene
    ])
];

// 复习选择题兜底选项。
const REVIEW_FALLBACK_OPTIONS = [
    "Good job!",
    "Let's play.",
    "Time to sleep.",
    "Look at this."
];

// 凭证清洗的公共基础步骤。
const NORMALIZE_BASE = value =>
    String(value ?? "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/^[`'"]+|[`'"]+$/g, "")
        .replace(/^Authorization:\s*/i, "")
        .replace(/^Bearer\s+/i, "")
        .replace(/[\s\u00A0\u3000]+/g, "")
        .trim();

// 有道读音服务配置。
const YOUDAO_TTS_CONFIG = {
    endpoint: "https://openapi.youdao.com/ttsapi",
    appKey: "299f0ae312ba957c",
};

// 读音重试次数和间隔配置。
const AUDIO_RETRY_CONFIG = {
    maxAttempts: 30,
    interval: 1000
};

// 可重试的 HTTP 状态集合。
const RETRYABLE_HTTP = new Set([408, 429]);

// 可重试的有道错误码集合。
const RETRYABLE_CODE = new Set(["411", "412"]);

// 可重试的错误文案关键词。
const RETRYABLE_WORDS = ["too many", "rate", "timeout", "network", "failed to fetch", "load failed", "太忙", "频繁", "限速"];

// 有道错误码的用户可读文案。
const YOUDAO_ERROR_MSG = {
    "102": "读音文字太长了。",
    "202": "读音密码不对，或者这个应用还没有开通读音服务。",
    "207": "读音文字不能为空。",
    "411": "读音服务今天太忙了，请稍后再试。",
    "412": "读音服务请求太频繁了，请稍后再试。"
};

// GitHub 仓库展示配置。
const GITHUB_REPO_CONFIG = {
    owner: "connectedGraph",
    repo: "AIED-DuoGrow-SaaS",
    slug: "connectedGraph/AIED-DuoGrow-SaaS",
    url: "https://github.com/connectedGraph/AIED-DuoGrow-SaaS",
    apiUrl: "https://api.github.com/repos/connectedGraph/AIED-DuoGrow-SaaS"
};

// 移动端解锁音频播放用的静音音频。
const SILENT_AUDIO_URL = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

// 快捷主题按钮配置。
const quickTopics = [{
        icon: "🛁",
        label: "洗澡",
        featured: true
    },
    {
        icon: "🛏",
        label: "哄睡",
        featured: false
    },
    {
        icon: "🍎",
        label: "吃水果",
        featured: true
    },
    {
        icon: "👟",
        label: "穿鞋",
        featured: false
    },
    {
        icon: "🌳",
        label: "去公园",
        featured: false
    },
    {
        icon: "📚",
        label: "读绘本",
        featured: true
    },
    {
        icon: "🧸",
        label: "玩玩具",
        featured: false
    },
    {
        icon: "👏",
        label: "表扬宝宝",
        featured: false
    }
];

// 各页面使用引导的展示文案。
const usageGuides = {
    learn: {
        tabName: "学习",
        icon: "✨",
        title: "5 句先开口，10 句多储备",
        heading: "把日常动作，变成宝宝听得懂的英语时刻。",
        copy: "输入一个词、动作或场景，可以生成精简 5 句，也可以生成丰富 10 句。短句、自然、不会有学习压力。",
        steps: [{
                icon: "1",
                title: "移动端优先",
                copy: "单手就能完成输入、收藏、复习。"
            },
            {
                icon: "2",
                title: "直接能说",
                copy: "每句都带中文和使用场景。"
            },
            {
                icon: "3",
                title: "轻复习",
                copy: "收藏后就能抽题，慢慢变顺口。"
            }
        ]
    },
    book: {
        tabName: "仓库",
        icon: "📦",
        title: "仓库",
        heading: "保存好的主题，随时回来复看。",
        copy: "保存可以复看，重复听。也可以打开图片，长按保存到相册。",
        steps: [{
                icon: "1",
                title: "整组保存",
                copy: "把一个主题里的 5 句或 10 句话一次留住。"
            },
            {
                icon: "2",
                title: "重复听",
                copy: "保存后读音会留在本地，反复听也少花钱。"
            },
            {
                icon: "3",
                title: "长按存图",
                copy: "打开保存图，长按就能放进相册。"
            }
        ]
    },
    review: {
        tabName: "复习",
        icon: "🎯",
        title: "轻复习",
        heading: "不背书，用熟悉的节奏把句子留住。",
        copy: "这轮会优先抽你保存过、又比较值得重复的表达。答错也没关系，重点是形成反应。",
        steps: [{
                icon: "1",
                title: "先保存",
                copy: "复习题会从仓库保存过的句子里抽，先攒一组最常用的。"
            },
            {
                icon: "2",
                title: "凭感觉选",
                copy: "看到中文先选一遍，再听正确答案找回口感。"
            },
            {
                icon: "3",
                title: "慢慢变熟",
                copy: "系统会记录答题情况，错过的句子会更容易再次出现。"
            }
        ]
    },
    play: {
        tabName: "卡片",
        icon: "🖼",
        title: "记忆卡片",
        heading: "把今天最想说的一句，做成一张可保存的卡片。",
        copy: "点开保存图，长按存到相册，随手翻一翻就能提醒自己开口。",
        steps: [{
                icon: "1",
                title: "选一句",
                copy: "优先选择今天最想对宝宝说出口的表达。"
            },
            {
                icon: "2",
                title: "做成图",
                copy: "卡片会保留英文、中文和使用场景，方便反复看。"
            },
            {
                icon: "3",
                title: "放在手边",
                copy: "保存到相册，睡前、吃饭前或出门前看一眼。"
            }
        ]
    }
};

// 应用运行态集中记录当前页面、播放和复习状态。
const appState = {
    config: loadConfig(),
    currentLesson: loadCurrentLesson(),
    activeTab: getInitialTab(),
    loading: false,
    audio: null,
    speaking: false,
    audioUnlocked: false,
    audioPlayToken: "",
    audioStopResolver: null,
    warehouseIndex: 0,
    warehouseLoopPlaying: false,
    warehouseLessonLoopId: "",
    warehousePlaybackMode: "",
    warehousePlaybackToken: "",
    pendingDeleteLessonId: "",
    pendingDoubaoLessonId: "",
    audioWarmupQueue: Promise.resolve(),
    reviewItems: [],
    reviewIndex: 0,
    reviewAnswered: false
};

// DOM 节点代理按需读取并缓存页面元素。
const elements = new Proxy({}, {
    get(target, prop) {
        if (prop in target) {
            return target[prop];
        }

        if (prop === "navButtons") {
            target[prop] = Array.from(document.querySelectorAll(".nav-btn"));
            return target[prop];
        }
        if (prop === "panels") {
            target[prop] = Array.from(document.querySelectorAll(".panel"));
            return target[prop];
        }

        const el = document.getElementById(prop);
        if (el) {
            target[prop] = el;
        }
        return el;
    }
});

let toastTimer = null;
let searchTimer = null;
const memoryAudioCache = new Map();

init();

// 处理 init 函数。
function init() {
    hydrateConfigInputs();
    renderQuickChips();
    bindEvents();
    renderCurrentLesson();
    renderBook();
    refreshReviewPanel();
    renderPlay();
    updateUsageGuideButton();
    migrateSavedWarehouseData();

    if (appState.activeTab !== "learn") {
        switchTab(appState.activeTab, {
            keepScroll: true
        });
    }
}

// 处理 bindEvents 函数。
function bindEvents() {
    document.addEventListener("click", handleActionClick);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    elements.topicInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleGenerate("compact");
        }
    });

    elements.searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            appState.warehouseIndex = 0;
            renderBook();
        }, 180);
    });

    elements.topicFilter.addEventListener("change", () => {
        appState.warehouseIndex = 0;
        renderBook();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            Object.keys(SHEETS).forEach(closeSheet);
        }
    });

}

// 处理 handleVisibilityChange 函数。
function handleVisibilityChange() {
    if (document.visibilityState !== "hidden") return;
    if (!isWarehouseForegroundPlaybackActive()) return;

    stopWarehousePlayback({
        message: "页面切到后台，已停止仓库循环播放。需要后台听请点“后台听仓库”。",
        type: "info"
    });
}

// 点击事件代理根据 data-action 分发到具体处理函数。
const actionHandlers = {
    "generate": (trigger) => handleGenerate(trigger.dataset.mode || "compact"),
    "switch-tab": (trigger) => trigger.dataset.tab && switchTab(trigger.dataset.tab),
    "open-github": () => openGithubSheet(),
    "close-github": () => closeSheet("github"),
    "open-github-repo": () => openGithubRepo(),
    "open-guide": () => openSheet("guide", renderUsageGuide),
    "close-guide": () => closeSheet("guide"),
    "close-image-preview": () => closeSheet("image"),
    "open-settings": () => openSheet("settings", hydrateConfigInputs),
    "close-settings": () => closeSheet("settings"),
    "save-config": () => unlockConfigFromInputs(),
    "fill-topic": (trigger) => fillTopic(decodeData(trigger.dataset.topic)),
    "favorite-all": () => favoriteAllCurrentExpressions(),
    "save-lesson": (trigger) => saveCurrentLessonToWarehouse(trigger),
    "append-current-lesson": (trigger) => appendCurrentLesson(trigger),
    "warehouse-prev": () => moveWarehouseCard(-1),
    "warehouse-next": () => moveWarehouseCard(1),
    "append-saved-lesson": (trigger) => appendSavedLesson(trigger.dataset.id, trigger),
    "request-delete-lesson": (trigger) => openDeleteConfirm(trigger.dataset.id),
    "open-doubao-training": (trigger) => openDoubaoTraining(trigger.dataset.id),
    "close-doubao": () => closeSheet("doubao"),
    "copy-open-doubao": (trigger) => copyPromptAndOpenDoubao(trigger),
    "close-delete-confirm": () => closeSheet("delete"),
    "confirm-delete-lesson": () => deletePendingLesson(),
    "speak-lesson": (trigger) => playSavedLessonOnce(trigger.dataset.id, trigger),
    "loop-lesson": (trigger) => loopSavedLesson(trigger.dataset.id, trigger, "foreground"),
    "background-loop-lesson": (trigger) => loopSavedLesson(trigger.dataset.id, trigger, "background"),
    "toggle-warehouse-loop": (trigger) => toggleWarehouseLoop(trigger, trigger.dataset.mode || "foreground"),
    "toggle-favorite": (trigger) => toggleFavoriteFromLesson(Number(trigger.dataset.index), trigger),
    "remove-favorite": (trigger) => trigger.dataset.id && removeFavorite(trigger.dataset.id),
    "speak": (trigger) => speak(decodeData(trigger.dataset.text), Number(trigger.dataset.rate || 1), trigger),
    "speak-memory-card": (trigger) => speakCurrentMemoryCard(trigger),
    "start-review": () => startReview(),
    "review-lesson": (trigger) => startLessonReview(trigger.dataset.id),
    "answer-review": (trigger) => answerReview(trigger),
    "next-review": () => nextReviewQuestion(),
    "open-memory-card-image": (trigger) => openMemoryCardPreview(trigger),
    "open-lesson-image": (trigger) => openLessonImagePreview(trigger.dataset.id, trigger),
};
// 处理 handleActionClick 函数。
function handleActionClick(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger || trigger.disabled) return;

    const action = trigger.dataset.action;
    actionHandlers[action]?.(trigger);
}

// 处理 renderQuickChips 函数。
function renderQuickChips() {
    elements.quickChips.innerHTML = quickTopics
        .map(item => {
            const featuredClass = item.featured ? " is-suggested" : "";
            return `
            <button
              class="chip-btn${featuredClass}"
              type="button"
              data-action="fill-topic"
              data-topic="${encodeData(item.label)}"
            >
              <span>${escapeHtml(item.icon)}</span>
              <span>${escapeHtml(item.label)}</span>
            </button>
          `;
        })
        .join("");
}

// 处理 handleGenerate 函数。
async function handleGenerate(mode = "compact") {
    if (appState.loading) return;

    const generationMode = normalizeGenerationMode(mode);
    const profile = getGenerationProfile(generationMode);
    const userInput = elements.topicInput.value.trim();
    if (!userInput) {
        showToast("先输入一个生活场景，比如“洗澡”或“哄睡”。", "error");
        elements.topicInput.focus();
        return;
    }

    appState.config = readConfigFromInputs();
    hydrateConfigInputs();

    if (!appState.config.apiKey) {
        openSheet("settings", hydrateConfigInputs);
        showToast("先填写我给你的密码，才能生成今日表达。", "error");
        return;
    }

    const previousLesson = appState.currentLesson;
    setLoading(true, generationMode);
    const cacheKey = buildLessonCacheKey(userInput, generationMode);
    const cachedLesson = getCachedLesson(cacheKey);
    showToast(cachedLesson ? `已找到本地保存过的${profile.shortName}，马上打开。` : `正在为你准备${profile.shortName}。`, "info");

    try {
        const lesson = cachedLesson || await generateLesson(userInput, generationMode);
        appState.currentLesson = normalizeLesson(lesson, userInput);
        if (!cachedLesson) {
            saveCachedLesson(cacheKey, appState.currentLesson);
        }
        saveCurrentLesson(appState.currentLesson);
        renderCurrentLesson();
        renderPlay();
        refreshReviewPanel();
        if (appState.activeTab === "learn") {
            switchTab("learn", {
                keepScroll: false
            });
        }
        showToast(
            appState.activeTab === "learn" ?
            (cachedLesson ? "这个主题已从本地打开，可以继续复看复听。" : `新的 ${profile.count} 句表达已经准备好了。`) :
            (cachedLesson ? "这个主题已从本地打开，回学习页就能看。" : `新的 ${profile.count} 句表达已经准备好了，回学习页就能看。`),
            "success"
        );
    } catch (error) {
        console.error(error);
        appState.currentLesson = previousLesson;
        renderCurrentLesson();
        renderPlay();
        showToast("生成失败了，可以再试一次。", "error");
    } finally {
        setLoading(false, generationMode);
    }
}

// 处理 generateLesson 函数。
async function generateLesson(userInput, mode = "compact") {
    const profile = getGenerationProfile(mode);
    const systemPrompt = profile.systemPrompt;
    const userPrompt = profile.buildUserPrompt(userInput);

    const messages = [{
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: userPrompt
        }
    ];

    return await callLLM(messages);
}

// 规范化生成模式，避免外部传入无效模式。
function normalizeGenerationMode(mode) {
    return mode === "rich" ? "rich" : "compact";
}

// 读取生成模式对应的固定配置。
function getGenerationProfile(mode) {
    return GENERATION_PROFILES[normalizeGenerationMode(mode)];
}

// 处理 generateExpansionLesson 函数。
async function generateExpansionLesson(lesson) {
    const normalized = normalizeLesson(lesson, lesson?.topic || "亲子英语");
    const existingLines = normalized.expressions.slice(0, 5).map((expression, index) => {
        return `${index + 1}. ${expression.english}｜${expression.chinese}｜场景：${expression.scene}`;
    }).join("\n");

    const systemPrompt = `你是一个“亲子英语表达扩展编辑”。你的任务不是重新生成一套表达，而是在已有5句基础上继续扩展5句。

你必须先理解已有5句分别承担的功能，然后生成新的5句。新句子必须和原有5句在语义、用途、动作、问法和互动功能上明显不同，不能做同义改写，不能只替换一个词，不能重复原句的交际目的。

新增5句仍然要适合50多岁中文妈妈学习，适合对幼儿说，短句、自然、生活化、可以立刻开口。新增内容要把主题进一步推广到更完整的亲子互动：新的描述、新的问法、新的动作、新的回应、新的收束或鼓励。

严格只输出新增的5个英文表达，不要重复输出原有5句。输出必须是严格 JSON，不要 Markdown，不要额外解释。For API compatibility, the final answer must be a valid json object.

JSON 结构：
{
  "topic": "string",
  "target_count": 5,
  "input_type": "noun | scene | sentence | question | review",
  "level": "beginner",
  "core_word": {
    "english": "string",
    "chinese": "string",
    "phonics_hint": "string"
  },
  "expressions": [
    {
      "english": "string",
      "chinese": "string",
      "scene": "string",
      "note": "string"
    }
  ],
  "kid_activity": {
    "title": "string",
    "steps": ["string", "string", "string"]
  },
  "review_questions": [
    {
      "type": "zh_to_en | en_to_zh",
      "question": "string",
      "answer": "string"
    }
  ],
  "encouragement": "string"
}`;

    const userPrompt = `用户今天想学：${normalized.topic}

已有5句表达如下，新增内容必须避开它们的语义和功能：
${existingLines}

请继续生成“追加版亲子英语表达包”。

要求：
- 严格只生成5个新的英文表达
- 新的5句必须和已有5句语义不重复、功能不重复、场景不高度重叠
- 不要把已有句子改写成近义句
- 新的5句要做进一步推广，补足已有5句没有覆盖到的互动用途
- 优先补充新的描述、问句、动作指令、回应、鼓励或自然收束
- 适合50多岁中文妈妈学习
- 适合对小孩说
- 短句、自然、生活化
- 每句都要有中文意思和使用场景
- 生成一个可以串起10句的1到2分钟亲子小游戏
- 生成5道简单复习题
- 严格输出JSON`;

    const messages = [{
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: userPrompt
        }
    ];

    return await callLLM(messages);
}

// 按策略链依次调用 LLM，前一路失败后自动尝试下一路。
async function callLLM(messages) {
    let lastError = null;
    for (const strategy of LLM_STRATEGIES) {
        try {
            return await strategy(messages, lastError);
        } catch (error) {
            lastError = error;
            console.warn("LLM strategy failed, next:", error);
        }
    }

    throw lastError || new Error("生成失败了。");
}

// 请求结构化 JSON 并统一处理 API 错误和内容解析。
async function requestStructuredJson({
    url,
    body,
    emptyContentMessage
}) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${appState.config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(buildApiErrorMessage(response.status, text));
    }

    const data = await response.json();
    const content = extractApiText(data);
    if (!content) {
        const message = typeof emptyContentMessage === "function" ? emptyContentMessage(data) : emptyContentMessage;
        throw new Error(message);
    }

    return safeJsonParse(content);
}

// 处理 generateLessonWithResponses 函数。
async function generateLessonWithResponses(messages) {
    return requestStructuredJson({
        url: `${normalizeBaseUrl(appState.config.apiBase)}/responses`,
        body: {
            model: DEFAULT_CONFIG.model,
            input: messages.map(message => ({
                role: message.role,
                content: message.content
            })),
            text: {
                format: {
                    type: "json_object"
                }
            }
        },
        emptyContentMessage: data => "Responses API 没有返回可解析文本：" + summarizeApiShape(data)
    });
}

// 处理 generateLessonWithChatCompletions 函数。
async function generateLessonWithChatCompletions(messages, previousError = null) {
    const models = [DEFAULT_CONFIG.model];

    let lastError = previousError;
    for (const model of models) {
        try {
            return await requestStructuredJson({
                url: `${normalizeBaseUrl(appState.config.apiBase)}/chat/completions`,
                body: {
                    model,
                    messages,
                    temperature: 0.7,
                    max_tokens: 2200,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    stream: false
                },
                emptyContentMessage: data => `Chat Completions 没有返回可解析文本：${summarizeApiShape(data)}`
            });
        } catch (error) {
            lastError = error;
        }
    }

    if (previousError && lastError && lastError !== previousError) {
        throw new Error(`Responses 失败：${friendlyError(previousError)}；Chat fallback 也失败：${friendlyError(lastError)}`);
    }

    throw lastError || new Error("生成失败了。");
}

// 处理 safeJsonParse 函数。
function safeJsonParse(content) {
    try {
        return JSON.parse(content);
    } catch (error) {
        const match = String(content).match(/\{[\s\S]*\}/);
        if (!match) throw error;
        return JSON.parse(match[0]);
    }
}

// 处理 extractApiText 函数。
function extractApiText(data) {
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
        return data.output_text;
    }

    const message = data?.choices?.[0]?.message;
    const chatContent = normalizeApiContent(message?.content);
    if (chatContent) {
        return chatContent;
    }

    const reasoningContent = normalizeApiContent(message?.reasoning_content);
    if (reasoningContent) {
        return reasoningContent;
    }

    const toolContent = extractToolCallText(message);
    if (toolContent) {
        return toolContent;
    }

    const output = Array.isArray(data?.output) ? data.output : [];
    for (const item of output) {
        const content = normalizeApiContent(item?.content) ||
            normalizeApiContent(item?.text) ||
            normalizeApiContent(item?.output_text);
        if (content) return content;
    }

    return findJsonLikeText(data);
}

// 处理 normalizeApiContent 函数。
function normalizeApiContent(content) {
    if (typeof content === "string") {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map(part => {
                if (typeof part === "string") return part;
                return part?.text || part?.content || part?.value || part?.output_text || part?.arguments || "";
            })
            .filter(Boolean)
            .join("\n")
            .trim();
    }

    if (content && typeof content === "object") {
        return content.text || content.content || content.value || content.output_text || content.arguments || "";
    }

    return "";
}

// 处理 extractToolCallText 函数。
function extractToolCallText(message) {
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    for (const call of toolCalls) {
        const args = call?.function?.arguments || call?.arguments;
        const normalized = normalizeApiContent(args);
        if (normalized) return normalized;
    }

    return normalizeApiContent(message?.function_call?.arguments);
}

// 处理 findJsonLikeText 函数。
function findJsonLikeText(value, seen = new Set()) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^[\[{]/.test(trimmed) || trimmed.includes('"expressions"') || trimmed.includes('"topic"')) {
            return trimmed;
        }
        return "";
    }

    if (!value || typeof value !== "object" || seen.has(value)) {
        return "";
    }

    seen.add(value);
    const priorityKeys = [
        "output_text",
        "content",
        "text",
        "reasoning_content",
        "arguments",
        "value"
    ];

    for (const key of priorityKeys) {
        if (key in value) {
            const found = findJsonLikeText(value[key], seen);
            if (found) return found;
        }
    }

    const entries = Array.isArray(value) ?
        value.map((item, index) => [index, item]) :
        Object.entries(value);

    for (const [, child] of entries) {
        const found = findJsonLikeText(child, seen);
        if (found) return found;
    }

    return "";
}

// 处理 summarizeApiShape 函数。
function summarizeApiShape(data) {
    try {
        const keys = Object.keys(data || {}).slice(0, 8).join(", ");
        const messageKeys = data?.choices?.[0]?.message ? Object.keys(data.choices[0].message).join(", ") : "";
        const outputInfo = Array.isArray(data?.output) ? `output:${data.output.length}` : "";
        return [keys ? `keys=${keys}` : "", messageKeys ? `message=${messageKeys}` : "", outputInfo].filter(Boolean).join("; ") || "未知返回结构";
    } catch {
        return "未知返回结构";
    }
}

// 处理 normalizeLesson 函数。
function normalizeLesson(lesson, fallbackTopic) {
    const rawTargetCount = Number(lesson?.target_count || lesson?.expression_count || lesson?.expressions?.length || 5);
    const targetCount = rawTargetCount > 5 ? 10 : 5;
    const normalized = {
        topic: lesson?.topic || fallbackTopic,
        target_count: targetCount,
        input_type: lesson?.input_type || "scene",
        level: lesson?.level || "beginner",
        core_word: {
            english: lesson?.core_word?.english || fallbackTopic,
            chinese: lesson?.core_word?.chinese || fallbackTopic,
            phonics_hint: lesson?.core_word?.phonics_hint || ""
        },
        expressions: Array.isArray(lesson?.expressions) ?
            lesson.expressions
            .slice(0, 10)
            .map(item => ({
                english: String(item?.english || "").trim(),
                chinese: String(item?.chinese || "").trim(),
                scene: String(item?.scene || "适合在日常陪宝宝时说。").trim(),
                note: String(item?.note || "重复多说几次，妈妈会越来越顺口。").trim()
            }))
            .filter(item => item.english) : [],
        kid_activity: {
            title: lesson?.kid_activity?.title || "1分钟亲子小游戏",
            steps: Array.isArray(lesson?.kid_activity?.steps) && lesson.kid_activity.steps.length ?
                lesson.kid_activity.steps.slice(0, 5).map(step => String(step || "").trim()).filter(Boolean) : ["拿出相关物品。", "妈妈先说一句英语。", "宝宝有反应时记得夸一句 Good job!"]
        },
        review_questions: Array.isArray(lesson?.review_questions) ? lesson.review_questions.slice(0, targetCount > 5 ? 5 : 3) : [],
        encouragement: lesson?.encouragement || "今天学会其中一句，就已经很棒了。"
    };

    if (!normalized.expressions.length) {
        normalized.expressions = getDemoLesson().expressions;
    }

    return normalized;
}

// 处理 renderCurrentLesson 函数。
function renderCurrentLesson() {
    renderLearnSnapshot();

    if (!appState.currentLesson) {
        elements.lessonContainer.innerHTML = `
          <div class="empty-card">
            <strong>今天先从一个最常见的场景开始。</strong>
            <p>
              比如“洗澡”“吃水果”“哄睡”这种每天都可能重复出现的时刻。先学一两句，明天再换新的也完全来得及。
            </p>
          </div>
        `;
        return;
    }

    const lesson = appState.currentLesson;
    const favoriteCount = countLessonFavorites(lesson);
    const allFavorited = favoriteCount === lesson.expressions.length;

    elements.lessonContainer.innerHTML = `
        <div class="lesson-shell">
          <section class="lesson-banner">
            <div class="section-kicker">
              <span>🌿</span>
              <span>今日主题</span>
            </div>
            <h2>${escapeHtml(lesson.topic)}</h2>
            <p>${escapeHtml(lesson.encouragement)}</p>
            <div class="banner-actions">
              <span class="micro-chip accent">共 ${lesson.expressions.length} 句</span>
              <span class="micro-chip success" data-role="favorite-count">已收藏 ${favoriteCount} / ${lesson.expressions.length}</span>
              <span class="micro-chip">难度：${escapeHtml(lesson.level || "beginner")}</span>
            </div>
          </section>

          <section class="word-stage">
            <div class="word-label">核心词 / 场景锚点</div>
            <div class="word-main">${escapeHtml(lesson.core_word.english)}</div>
            <div class="word-sub">
              ${escapeHtml(lesson.core_word.chinese)}
              ${lesson.core_word.phonics_hint ? " · 发音提示：" + escapeHtml(lesson.core_word.phonics_hint) : ""}
            </div>
            <div class="action-row">
              <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(lesson.core_word.english)}" data-rate="0.72">慢速听</button>
              <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(lesson.core_word.english)}" data-rate="1">正常听</button>
            </div>
          </section>

          <section class="expression-list">
            ${lesson.expressions.map((expression, index) => renderExpressionCard(expression, lesson.topic, index)).join("")}
          </section>

          <section class="glass-block">
            <div class="action-row">
              <button class="btn btn-primary" type="button" data-action="save-lesson">
                保存到仓库
              </button>
              <button class="btn btn-primary" type="button" data-action="favorite-all" ${allFavorited ? "disabled" : ""}>
                ${allFavorited ? "这一组已全部收藏" : "一键收藏这一组"}
              </button>
              ${lesson.expressions.length === 5 ? `<button class="btn btn-ghost" type="button" data-action="append-current-lesson">再生成 5 句</button>` : ""}
              <button class="btn btn-secondary" type="button" data-action="switch-tab" data-tab="play">生成记忆卡片</button>
            </div>
            <p class="sheet-copy" style="margin: 12px 0 0;">保存可以复看，重复听。读音会留在本地，少花钱。</p>
          </section>

          ${renderActivityCard(lesson.kid_activity)}
        </div>
      `;

    syncLessonFavoriteIndicators();
}

// 处理 renderExpressionCard 函数。
function renderExpressionCard(expression, topic, index) {
    const favorited = isExpressionFavorited(expression, topic);
    const activeClass = favorited ? " favorited" : "";
    const starClass = favorited ? " is-active" : "";
    return `
        <article class="lesson-card expression-card${activeClass}" data-expression-index="${index}">
          <div class="expression-top">
            <span class="serial-chip">${String(index + 1).padStart(2, "0")}</span>
            <button
              class="star-toggle${starClass}"
              type="button"
              aria-label="${favorited ? "取消收藏" : "收藏这句"}"
              aria-pressed="${favorited ? "true" : "false"}"
              data-action="toggle-favorite"
              data-index="${index}"
            >
              <span class="star-glyph">${favorited ? "★" : "☆"}</span>
            </button>
          </div>

          <div class="expression-english">${escapeHtml(expression.english)}</div>
          <div class="expression-chinese">${escapeHtml(expression.chinese)}</div>

          <div class="meta-box">
            <span class="meta-label">适合什么时候说</span>
            <div class="meta-text">${escapeHtml(expression.scene)}</div>
          </div>

          <div class="meta-box">
            <span class="meta-label">给妈妈的小提示</span>
            <div class="meta-text">${escapeHtml(expression.note)}</div>
          </div>

          <div class="action-row">
            <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(expression.english)}" data-rate="0.72">慢速听</button>
            <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(expression.english)}" data-rate="1">正常听</button>
          </div>
        </article>
      `;
}

// 处理 renderActivityCard 函数。
function renderActivityCard(activity) {
    const steps = Array.isArray(activity?.steps) ? activity.steps.filter(Boolean) : [];
    return `
        <section class="activity-card">
          <div class="section-kicker">
            <span>🎈</span>
            <span>1 分钟互动</span>
          </div>
          <h3>${escapeHtml(activity?.title || "今天的小互动")}</h3>
          <div class="activity-list">
            ${steps
              .map((step, index) => {
                return `
                  <div class="activity-item">
                    <span class="activity-index">${index + 1}</span>
                    <div class="activity-text">${escapeHtml(step)}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
}

// 处理 renderLearnSnapshot 函数。
function renderLearnSnapshot() {
    if (!appState.currentLesson) {
        elements.learnSnapshot.classList.add("hidden");
        elements.learnSnapshot.innerHTML = "";
        return;
    }

    const lesson = appState.currentLesson;
    const favoriteCount = countLessonFavorites(lesson);
    elements.learnSnapshot.classList.remove("hidden");
    elements.learnSnapshot.innerHTML = `
        <div class="state-chip-grid">
          <div class="state-chip-group">
            <span class="micro-chip accent">主题：${escapeHtml(lesson.topic)}</span>
            <span class="micro-chip">核心词：${escapeHtml(lesson.core_word.english)}</span>
          </div>
          <div class="state-chip-group">
            <span class="micro-chip success">收藏 ${favoriteCount} / ${lesson.expressions.length}</span>
            <span class="micro-chip">${formatDate(new Date())}</span>
          </div>
        </div>
      `;
}

// 处理 favoriteAllCurrentExpressions 函数。
function favoriteAllCurrentExpressions() {
    const lesson = appState.currentLesson;
    if (!lesson?.expressions?.length) return;

    const list = loadExpressions();
    const added = addLessonExpressionsToList(list, lesson);

    if (!added) {
        showToast("这一组已经都在收藏里了。", "info");
        return;
    }

    saveExpressions(list);
    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    showToast(`已收藏 ${added} 句，后面就能直接复习。`, "success");
}

// 处理 addLessonExpressionsToList 函数。
function addLessonExpressionsToList(list, lesson) {
    let added = 0;
    lesson.expressions.forEach(expression => {
        const savedExpression = buildSavedExpression(lesson.topic, expression);
        if (!findSavedExpressionByKey(list, savedExpression.key)) {
            list.unshift(savedExpression);
            added += 1;
        }
    });
    return added;
}

// 处理 saveCurrentLessonToWarehouse 函数。
async function saveCurrentLessonToWarehouse(button = null) {
    const lesson = appState.currentLesson;
    if (!lesson?.expressions?.length) {
        showToast("先生成一组表达，再保存到仓库。", "error");
        return;
    }

    const originalLabel = button?.textContent || "保存到仓库";
    setButtonBusy(button, true, "保存中...");

    const savedLessons = SavedLessonRepo.list();
    const savedLesson = buildSavedLesson(lesson);
    const existingIndex = savedLessons.findIndex(item => SavedLessonRepo.isSameRef(item, savedLesson.key));
    if (existingIndex >= 0) {
        savedLessons[existingIndex] = {
            ...savedLessons[existingIndex],
            ...savedLesson,
            createdAt: savedLessons[existingIndex].createdAt || savedLesson.createdAt,
            updatedAt: new Date().toISOString()
        };
    } else {
        savedLessons.unshift(savedLesson);
    }

    saveSavedLessons(savedLessons);

    const list = loadExpressions();
    addLessonExpressionsToList(list, lesson);
    saveExpressions(list);
    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    showToast("已保存到仓库，正在把读音也存好。", "success");

    try {
        const audioResult = await queueAudioWarmup(() => warmAudio(savedLesson, progress => {
            setButtonBusy(button, true, `读音 ${progress.done}/${progress.total}...`);
        }));
        if (audioResult.failed.length) {
            showToast(`内容已保存，读音已尽力预存 ${audioResult.saved}/${audioResult.total} 条，稍后打开会继续缓存。`, "info");
        } else {
            markSavedLessonsAudioVersion([savedLesson.key || savedLesson.id]);
            showToast("这一组读音也存好了，之后重复听更省。", "success");
        }
    } catch (error) {
        console.error(error);
        showToast("内容已保存，读音预存失败也不影响使用：" + friendlyError(error), "error");
    } finally {
        setButtonBusy(button, false, originalLabel);
    }
}

// 追加课程用例统一处理校验、生成、合并和按钮状态。
async function appendLessonUseCase({
    lesson,
    button,
    persist,
    afterPersist,
    successMessage
}) {
    if (!lesson?.expressions?.length) return;
    if (lesson.expressions.length !== 5) {
        showToast("这一组已经不是 5 句了，不需要再追加。", "info");
        return;
    }

    appState.config = readConfigFromInputs();
    hydrateConfigInputs();
    if (!appState.config.apiKey) {
        openSheet("settings", hydrateConfigInputs);
        showToast("先填写我给你的密码，才能追加生成。", "error");
        return;
    }

    const originalLabel = button?.textContent || "再生成 5 句";
    setButtonBusy(button, true, "追加中...");

    try {
        const expansion = await generateExpansionLesson(lesson);
        const merged = mergeExpandedLesson(lesson, expansion);
        const persisted = await persist(merged);
        const nextLesson = persisted || merged;
        await afterPersist?.(nextLesson);
        showToast(successMessage, "success");
        return nextLesson;
    } catch (error) {
        console.error(error);
        showToast("追加生成失败了，可以再试一次。", "error");
    } finally {
        setButtonBusy(button, false, originalLabel);
    }
}

// 处理 appendCurrentLesson 函数。
async function appendCurrentLesson(button = null) {
    return appendLessonUseCase({
        lesson: appState.currentLesson,
        button,
        persist: async merged => {
            appState.currentLesson = merged;
            saveCurrentLesson(merged);
            saveCachedLesson(buildLessonCacheKey(merged.topic, "rich"), merged);
            return merged;
        },
        afterPersist: async () => {
            renderCurrentLesson();
            renderPlay();
        },
        successMessage: "已经追加 5 句，这一组现在是 10 句。"
    });
}

// 处理 appendSavedLesson 函数。
async function appendSavedLesson(id, button = null) {
    const savedLessons = SavedLessonRepo.list();
    const lesson = SavedLessonRepo.findByRef(id, savedLessons);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    return appendLessonUseCase({
        lesson,
        button,
        persist: async merged => {
            let savedMerged = merged;
            const nextSavedLessons = savedLessons.map(item => {
                if (!SavedLessonRepo.isSameLesson(item, lesson)) return item;
                savedMerged = normalizeSavedLesson({
                    ...item,
                    ...merged,
                    id: item.id,
                    key: item.key,
                    createdAt: item.createdAt,
                    updatedAt: new Date().toISOString(),
                    storageVersion: STORAGE_VERSION,
                    audioVersion: 0
                });
                return savedMerged;
            });

            saveSavedLessons(nextSavedLessons);
            return savedMerged;
        },
        afterPersist: async merged => {
            const expressions = loadExpressions();
            addLessonExpressionsToList(expressions, merged);
            saveExpressions(expressions);

            if (appState.currentLesson && buildLessonKey(appState.currentLesson.topic) === (lesson.key || lesson.id)) {
                appState.currentLesson = merged;
                saveCurrentLesson(merged);
                renderCurrentLesson();
                renderPlay();
            }

            refreshReviewPanel();
            renderBook();
            queueAudioWarmup(() => warmAudio(merged))
                .then(result => {
                    if (!result.failed.length) {
                        markSavedLessonsAudioVersion([merged.key || merged.id]);
                    }
                })
                .catch(error => console.warn("Append audio warmup skipped:", error));
        },
        successMessage: "仓库这组已经追加到 10 句。"
    });
}

// 处理 mergeExpandedLesson 函数。
function mergeExpandedLesson(baseLesson, expansionLesson) {
    const base = normalizeLesson(baseLesson, baseLesson?.topic || "亲子英语");
    const expansion = normalizeLesson(expansionLesson, base.topic);
    const seen = new Set();
    const expressions = [];

    [...base.expressions, ...expansion.expressions].forEach(expression => {
        const key = buildExpressionKey(expression);
        if (!key || seen.has(key)) return;
        seen.add(key);
        expressions.push(expression);
    });

    return normalizeLesson({
        ...base,
        topic: base.topic,
        target_count: 10,
        expressions: expressions.slice(0, 10),
        kid_activity: expansion.kid_activity?.steps?.length ? expansion.kid_activity : base.kid_activity,
        review_questions: expansion.review_questions?.length ? expansion.review_questions : base.review_questions,
        encouragement: expansion.encouragement || base.encouragement
    }, base.topic);
}

// 处理 migrateSavedWarehouseData 函数。
function migrateSavedWarehouseData() {
    window.setTimeout(async () => {
        try {
            const savedLessons = loadSavedLessons();
            if (!savedLessons.length) return;

            let changed = false;
            const lessonsToWarm = [];
            const upgraded = savedLessons.map(lesson => {
                const normalized = normalizeSavedLesson(lesson);
                const needsDataUpgrade = Number(lesson?.storageVersion || 0) !== STORAGE_VERSION;
                const needsAudioUpgrade = Number(lesson?.audioVersion || 0) !== STORAGE_VERSION;
                if (needsDataUpgrade) {
                    changed = true;
                }
                if (needsDataUpgrade || needsAudioUpgrade) {
                    lessonsToWarm.push({
                        ...normalized,
                        storageVersion: STORAGE_VERSION
                    });
                }
                return {
                    ...normalized,
                    storageVersion: STORAGE_VERSION
                };
            });

            if (changed) {
                saveSavedLessons(upgraded);
            }

            const expressions = loadExpressions();
            let expressionChanged = false;
            upgraded.forEach(lesson => {
                expressionChanged = addLessonExpressionsToList(expressions, lesson) > 0 || expressionChanged;
            });

            if (expressionChanged) {
                saveExpressions(expressions);
                refreshReviewPanel();
            }

            renderBook();
            if (!lessonsToWarm.length) return;
            const audioResult = await queueAudioWarmup(() => warmAudio(lessonsToWarm, progress => {
                if (progress.done === progress.total && progress.total) {
                    console.info("Warehouse audio cache migrated:", progress);
                }
            }));
            if (!audioResult.failed.length) {
                markSavedLessonsAudioVersion(lessonsToWarm.map(lesson => lesson.key || lesson.id));
            }
        } catch (error) {
            console.warn("Warehouse migration skipped:", error);
        }
    }, 300);
}

// 处理 toggleFavoriteFromLesson 函数。
function toggleFavoriteFromLesson(index, trigger) {
    const lesson = appState.currentLesson;
    const expression = lesson?.expressions?.[index];
    if (!expression) return;

    const list = loadExpressions();
    const nextExpression = buildSavedExpression(lesson.topic, expression);
    const existing = findSavedExpressionByKey(list, nextExpression.key);

    let nextList;
    let isNowFavorite = false;

    if (existing) {
        nextList = list.filter(item => item.id !== existing.id);
    } else {
        nextList = [nextExpression, ...list];
        isNowFavorite = true;
    }

    saveExpressions(nextList);
    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    updateStarButtonState(trigger, isNowFavorite, true);

    if (navigator.vibrate) {
        navigator.vibrate(isNowFavorite ? 18 : 10);
    }

    showToast(isNowFavorite ? "已加入收藏本。" : "已从收藏本移出。", isNowFavorite ? "success" : "info");
}

// 处理 syncLessonFavoriteIndicators 函数。
function syncLessonFavoriteIndicators() {
    const lesson = appState.currentLesson;
    if (!lesson) return;

    const favoriteCount = countLessonFavorites(lesson);
    const counter = elements.lessonContainer.querySelector("[data-role='favorite-count']");
    if (counter) {
        counter.textContent = `已收藏 ${favoriteCount} / ${lesson.expressions.length}`;
    }

    const actionBtn = elements.lessonContainer.querySelector("[data-action='favorite-all']");
    if (actionBtn) {
        const allFavorited = favoriteCount === lesson.expressions.length;
        actionBtn.disabled = allFavorited;
        actionBtn.textContent = allFavorited ? "这一组已全部收藏" : "一键收藏这一组";
    }

    Array.from(elements.lessonContainer.querySelectorAll("[data-expression-index]")).forEach(card => {
        const index = Number(card.dataset.expressionIndex);
        const expression = lesson.expressions[index];
        const favorited = isExpressionFavorited(expression, lesson.topic);
        card.classList.toggle("favorited", favorited);

        const starBtn = card.querySelector(".star-toggle");
        if (starBtn) {
            updateStarButtonState(starBtn, favorited, false);
        }
    });
}

// 处理 updateStarButtonState 函数。
function updateStarButtonState(button, isActive, burst) {
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-label", isActive ? "取消收藏" : "收藏这句");
    const glyph = button.querySelector(".star-glyph");
    if (glyph) {
        glyph.textContent = isActive ? "★" : "☆";
    }

    if (burst) {
        button.classList.remove("is-burst");
        void button.offsetWidth;
        button.classList.add("is-burst");
        window.setTimeout(() => {
            button.classList.remove("is-burst");
        }, 520);
    }
}

// 按仓库搜索条件过滤保存课程。
function filterSavedLessons(list, {
    keyword = "",
    topic = "all"
} = {}) {
    const q = String(keyword || "").trim().toLowerCase();

    return (list || []).filter(item => {
        const matchesKeyword = !q || WAREHOUSE_SEARCH_FIELDS(item)
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(q));
        const matchesTopic = topic === "all" || item.topic === topic;
        return matchesKeyword && matchesTopic;
    });
}

// 处理 renderBook 函数。
function renderBook() {
    const list = SavedLessonRepo.list();
    renderTopicFilter(list);
    const filtered = filterSavedLessons(list, {
        keyword: elements.searchInput.value,
        topic: elements.topicFilter.value || "all"
    });

    renderBookSummary(list, filtered);

    if (!filtered.length) {
        appState.warehouseIndex = 0;
        elements.bookContainer.innerHTML = `
          <div class="empty-card">
            <strong>${list.length ? "没有匹配到这一组主题。" : "仓库还是空的。"}</strong>
            <p>
              ${list.length ? "换个关键词试试，或者把主题切回“全部”。" : "在学习页生成一组表达，再点“保存到仓库”，以后就能复看和重复听。"}
            </p>
          </div>
        `;
        return;
    }

    appState.warehouseIndex = clamp(appState.warehouseIndex, 0, filtered.length - 1);
    const current = filtered[appState.warehouseIndex];
    elements.bookContainer.innerHTML = `
        ${renderWarehousePlaybar(filtered)}
        <div class="warehouse-carousel">
          <button class="warehouse-arrow" type="button" aria-label="上一组主题" data-action="warehouse-prev" ${filtered.length <= 1 ? "disabled" : ""}>‹</button>
          ${renderWarehouseCard(current)}
          <button class="warehouse-arrow" type="button" aria-label="下一组主题" data-action="warehouse-next" ${filtered.length <= 1 ? "disabled" : ""}>›</button>
        </div>
        <div class="warehouse-position">第 ${appState.warehouseIndex + 1} / ${filtered.length} 组 · 点左右箭头切换主题</div>
      `;
}

// 处理 renderWarehousePlaybar 函数。
function renderWarehousePlaybar(list) {
    const sentenceCount = getWarehouseEnglishTexts(list).length;
    const isForegroundPlaying = appState.warehouseLoopPlaying && appState.warehousePlaybackMode !== "background";
    const isBackgroundPlaying = appState.warehouseLoopPlaying && appState.warehousePlaybackMode === "background";
    return `
        <div class="warehouse-playbar">
          <div class="warehouse-playbar-actions">
            <button
              class="btn ${isForegroundPlaying ? "btn-secondary" : "btn-primary"}"
              type="button"
              data-action="toggle-warehouse-loop"
              data-mode="foreground"
              ${sentenceCount ? "" : "disabled"}
            >${isForegroundPlaying ? PLAYBACK_COPY.warehouse.foreground.stopLabel : PLAYBACK_COPY.warehouse.foreground.startLabel}</button>
            <button
              class="btn ${isBackgroundPlaying ? "btn-secondary" : "btn-ghost"}"
              type="button"
              data-action="toggle-warehouse-loop"
              data-mode="background"
              ${sentenceCount ? "" : "disabled"}
            >${isBackgroundPlaying ? PLAYBACK_COPY.warehouse.background.stopLabel : PLAYBACK_COPY.warehouse.background.startLabel}</button>
          </div>
          <div class="warehouse-playbar-text">
            ${sentenceCount
              ? `普通循环会在页面不可见时自动停止。后台听按当前筛选顺序播放 ${sentenceCount} 句，每句两遍；需要停止时请回到页面处理，或清空应用后台。`
              : "仓库里还没有可播放的英文句子。"}
          </div>
        </div>
      `;
}

// 处理 renderBookSummary 函数。
function renderBookSummary(list, filtered) {
    const expressionCount = list.reduce((sum, item) => sum + (item.expressions?.length || 0), 0);
    elements.bookSummary.innerHTML = `
        <span class="mini-stat">共保存 ${list.length} 组</span>
        <span class="mini-stat">当前显示 ${filtered.length} 组</span>
        <span class="mini-stat">可复听 ${expressionCount} 句</span>
      `;
}

// 处理 renderWarehouseCard 函数。
function renderWarehouseCard(lesson) {
    const expressions = Array.isArray(lesson.expressions) ? lesson.expressions.slice(0, 10) : [];
    const lessonId = String(lesson.id || lesson.key || "");
    const isLessonLooping = appState.warehouseLessonLoopId === lessonId;
    const isLessonForegroundLooping = isLessonLooping && appState.warehousePlaybackMode !== "background";
    const isLessonBackgroundLooping = isLessonLooping && appState.warehousePlaybackMode === "background";
    return `
        <article class="warehouse-card">
          <div class="warehouse-top">
            <span class="topic-chip">${escapeHtml(formatDate(new Date(lesson.updatedAt || lesson.createdAt || Date.now())))}</span>
            <span class="mastery-chip">${expressions.length} 句</span>
          </div>
          <div class="warehouse-title-row">
            <div class="warehouse-title">${escapeHtml(lesson.topic || "亲子英语")}</div>
            <div class="warehouse-title-actions">
              <button
                class="icon-circle-btn warehouse-image-btn"
                type="button"
                aria-label="打开保存图"
                title="打开保存图"
                data-action="open-lesson-image"
                data-id="${escapeHtml(lesson.id)}"
              >${renderShareExportIcon()}</button>
              <button
                class="icon-circle-btn warehouse-speak-btn"
                type="button"
                aria-label="播放这一组读音"
                title="播放这一组读音"
                data-action="loop-lesson"
                data-id="${escapeHtml(lesson.id)}"
              >${isLessonForegroundLooping ? "⏸" : "🔊"}</button>
            </div>
          </div>
          <p class="warehouse-copy">${escapeHtml(lesson.encouragement || "保存可以复看，重复听。")}</p>
          <div class="warehouse-lines">
            ${expressions.map(expression => `
              <div class="warehouse-line">
                <div class="warehouse-line-text">
                  <strong>${escapeHtml(expression.english)}</strong>
                  ${escapeHtml(expression.chinese)}
                </div>
                <button
                  class="icon-circle-btn warehouse-line-speak"
                  type="button"
                  aria-label="播放这句读音"
                  title="播放这句读音"
                  data-action="speak"
                  data-text="${encodeData(expression.english)}"
                  data-rate="0.72"
                >🔊</button>
              </div>
            `).join("")}
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="button" data-action="open-doubao-training" data-id="${escapeHtml(lesson.id)}">去豆包提问</button>
            <button class="btn btn-secondary" type="button" data-action="speak-lesson" data-id="${escapeHtml(lesson.id)}">听这一组</button>
            <button class="btn ${isLessonBackgroundLooping ? "btn-secondary" : "btn-ghost"}" type="button" data-action="background-loop-lesson" data-id="${escapeHtml(lesson.id)}">${isLessonBackgroundLooping ? PLAYBACK_COPY.lesson.background.stopLabel : PLAYBACK_COPY.lesson.background.startLabel}</button>
            <button class="btn btn-secondary" type="button" data-action="review-lesson" data-id="${escapeHtml(lesson.id)}">去复习</button>
            ${expressions.length === 5 ? `<button class="btn btn-ghost" type="button" data-action="append-saved-lesson" data-id="${escapeHtml(lesson.id)}">再生成 5 句</button>` : ""}
            <button class="btn btn-ghost" type="button" data-action="request-delete-lesson" data-id="${escapeHtml(lesson.id)}">删除这组</button>
          </div>
        </article>
      `;
}

// 处理 renderShareExportIcon 函数。
function renderShareExportIcon() {
    return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3v12"></path>
          <path d="m7 8 5-5 5 5"></path>
          <path d="M5 13v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5"></path>
        </svg>
      `;
}

// 处理 buildDoubaoPrompt 函数。
function buildDoubaoPrompt(lesson) {
    const expressions = getLessonExpressionAudioTexts(lesson)
        .map((english, index) => {
            const item = (lesson.expressions || []).find(expression => String(expression?.english || "").trim() === english) || {};
            return `${index + 1}. 中文：${item.chinese || "请根据英文补充自然中文"}\n   英文：${english}\n   场景：${item.scene || lesson.topic || "亲子日常"}`;
        })
        .join("\n");
    const coreWord = lesson.core_word?.english ?
        `${lesson.core_word.english}（${lesson.core_word.chinese || "核心词"}）` :
        "请从表达里提炼一个当前场景的核心词";

    return `你现在是“妈妈亲子英语”的一对一陪练老师。请根据下面这组仓库句子，带我做中译英训练。

训练主题：${lesson.topic || "亲子日常"}
当前场景核心词：${coreWord}

可考察表达：
${expressions}

请严格按这些规则陪练：
1. 所有学习都拆成小任务，一次只给我一题，不要一次性把所有答案都列出来。
2. 每题用“中译英”形式出题，先给中文，让我回复英文；等我回答后再判断。
3. 如果我答对，先鼓励，再给一个更自然的表达小提醒。
4. 如果我答错，不要打击我。先肯定尝试，再给正确表达，拆开解释关键词，说明这句话适合在什么亲子场景里说。
5. 每一题讲完后，额外给我 1 个当前场景可用的小词或短语，并马上进入下一个小任务。
6. 语气要温柔、直接、像陪妈妈练开口；不要像考试，也不要讲太长。

请先从第 1 个小任务开始，只出一道题，等我回答。`;
}

// 处理 moveWarehouseCard 函数。
function moveWarehouseCard(delta) {
    const count = elements.bookContainer.querySelectorAll(".warehouse-card").length;
    const filtered = getFilteredSavedLessons();

    if (filtered.length <= 1 || !count) return;
    appState.warehouseIndex = (appState.warehouseIndex + delta + filtered.length) % filtered.length;
    renderBook();
}

// 处理 getFilteredSavedLessons 函数。
function getFilteredSavedLessons() {
    return filterSavedLessons(SavedLessonRepo.list(), {
        keyword: elements.searchInput.value,
        topic: elements.topicFilter.value || "all"
    });
}

// 处理 isWarehouseForegroundPlaybackActive 函数。
function isWarehouseForegroundPlaybackActive() {
    return (appState.warehouseLoopPlaying || !!appState.warehouseLessonLoopId) &&
        appState.warehousePlaybackMode !== "background";
}

// 处理 stopWarehousePlayback 函数。
function stopWarehousePlayback({
    render = true,
    message = "",
    type = "info"
} = {}) {
    appState.warehouseLoopPlaying = false;
    appState.warehouseLessonLoopId = "";
    appState.warehousePlaybackMode = "";
    appState.warehousePlaybackToken = "";
    stopCurrentAudio();

    if (render) {
        renderBook();
    }

    if (message) {
        showToast(message, type);
    }
}

// 处理 startWarehousePlayback 函数。
function startWarehousePlayback(mode, lessonId = "") {
    const token = createId();
    appState.warehouseLoopPlaying = !lessonId;
    appState.warehouseLessonLoopId = lessonId;
    appState.warehousePlaybackMode = mode === "background" ? "background" : "foreground";
    appState.warehousePlaybackToken = token;
    return token;
}

// 处理 isWarehousePlaybackTokenActive 函数。
function isWarehousePlaybackTokenActive(token) {
    return !!token && appState.warehousePlaybackToken === token;
}

// 处理 toggleWarehouseLoop 函数。
async function toggleWarehouseLoop(button, mode = "foreground") {
    const playbackMode = mode === "background" ? "background" : "foreground";
    if (appState.warehouseLoopPlaying && appState.warehousePlaybackMode === playbackMode) {
        stopWarehousePlayback({
            message: PLAYBACK_COPY.warehouse[playbackMode].stop
        });
        return;
    }

    stopWarehousePlayback({
        render: false
    });
    const texts = getWarehouseEnglishTexts(getFilteredSavedLessons());
    if (!texts.length) {
        showToast("仓库里还没有可播放的英文句子。", "error");
        return;
    }

    const unlockPromise = unlockAudioPlayback();
    const token = startWarehousePlayback(playbackMode);
    renderBook();
    showToast(PLAYBACK_COPY.warehouse[playbackMode].start, "info");

    try {
        await unlockPromise;
        await playWarehouseLoop(texts, 0.72, token);
    } catch (error) {
        if (isWarehousePlaybackTokenActive(token)) {
            console.error(error);
            showToast("仓库轮播播放失败了。错误：" + friendlyError(error), "error");
        }
    } finally {
        if (isWarehousePlaybackTokenActive(token)) {
            stopWarehousePlayback({
                message: ""
            });
        }
    }
}

// 循环播放一组文本并由外部状态决定何时停止。
async function playLoopAudioTexts({
    texts,
    rate = 0.72,
    isActive
}) {
    if (!texts.length) return;

    while (isActive()) {
        for (const text of texts) {
            for (let repeat = 0; repeat < 2; repeat += 1) {
                if (!isActive()) return;
                const audioUrl = await getOrFetchAudio(text, rate);
                if (!isActive()) return;
                stopCurrentAudio();
                await playAudioUrl(audioUrl);
            }
        }
    }
}

// 处理 playWarehouseLoop 函数。
async function playWarehouseLoop(texts, rate = 0.72, token = "") {
    return playLoopAudioTexts({
        texts,
        rate,
        isActive: () => appState.warehouseLoopPlaying && isWarehousePlaybackTokenActive(token)
    });
}

// 批量播放文本一次并统一处理按钮状态和提示。
async function playTextBatchOnce({
    texts,
    button,
    emptyMessage,
    playingLabel = "播放中...",
    successMessage,
    errorPrefix,
    beforePlay,
    rate = 0.72
}) {
    const batch = (texts || []).filter(Boolean);
    if (!batch.length) {
        showToast(emptyMessage, "error");
        return;
    }

    beforePlay?.();

    const originalLabel = button?.textContent || "播放";
    setButtonBusy(button, true, playingLabel);

    try {
        await unlockAudioPlayback();
        await playAudioTexts(batch, rate);
        showToast(successMessage, "success");
    } catch (error) {
        console.error(error);
        showToast(errorPrefix + friendlyError(error), "error");
    } finally {
        setButtonBusy(button, false, originalLabel);
    }
}

// 处理 playSavedLessonOnce 函数。
async function playSavedLessonOnce(id, button) {
    const lesson = SavedLessonRepo.findByRef(id);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    return playTextBatchOnce({
        texts: getLessonExpressionAudioTexts(lesson),
        button,
        emptyMessage: "这一组还没有可播放的英文句子。",
        successMessage: "这一组读完啦。",
        errorPrefix: "这一组读音播放失败了。错误：",
        beforePlay: () => stopWarehousePlayback({
            render: false
        })
    });
}

// 处理 loopSavedLesson 函数。
async function loopSavedLesson(id, button, mode = "foreground") {
    const lesson = SavedLessonRepo.findByRef(id);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    const lessonId = String(lesson.id || lesson.key || id);
    const playbackMode = mode === "background" ? "background" : "foreground";
    if (appState.warehouseLessonLoopId === lessonId && appState.warehousePlaybackMode === playbackMode) {
        stopWarehousePlayback({
            message: PLAYBACK_COPY.lesson[playbackMode].stop
        });
        return;
    }

    const texts = getLessonExpressionAudioTexts(lesson);
    if (!texts.length) return;

    stopWarehousePlayback({
        render: false
    });
    const token = startWarehousePlayback(playbackMode, lessonId);
    const unlockPromise = unlockAudioPlayback();
    renderBook();
    showToast(PLAYBACK_COPY.lesson[playbackMode].start, "info");

    try {
        await unlockPromise;
        await playLessonLoop(lessonId, texts, 0.72, token);
    } catch (error) {
        if (isWarehousePlaybackTokenActive(token)) {
            console.error(error);
            showToast("这一组读音播放失败了。错误：" + friendlyError(error), "error");
        }
    } finally {
        if (isWarehousePlaybackTokenActive(token)) {
            stopWarehousePlayback({
                message: ""
            });
        }
    }
}

// 处理 playLessonLoop 函数。
async function playLessonLoop(lessonId, texts, rate = 0.72, token = "") {
    return playLoopAudioTexts({
        texts,
        rate,
        isActive: () => appState.warehouseLessonLoopId === lessonId && isWarehousePlaybackTokenActive(token)
    });
}

// 处理 speakCurrentMemoryCard 函数。
async function speakCurrentMemoryCard(button) {
    const lesson = getDailyMemoryLesson(loadSavedLessons());
    const texts = getPosterExpressions(lesson, lesson?.expressions || []).map(item => item.english).filter(Boolean);
    return playTextBatchOnce({
        texts,
        button,
        emptyMessage: "仓库里还没有可播放的每日一记卡片。",
        successMessage: "这张卡片读完啦。",
        errorPrefix: "卡片读音播放失败了。错误："
    });
}

// 处理 renderFavoriteCard 函数。
function renderFavoriteCard(item) {
    return `
        <article class="favorite-card favorited">
          <div class="favorite-top">
            <span class="topic-chip">${escapeHtml(item.topic || "未分类")}</span>
            <button
              class="star-toggle is-active"
              type="button"
              aria-label="移出收藏"
              aria-pressed="true"
              data-action="remove-favorite"
              data-id="${escapeHtml(item.id)}"
            >
              <span class="star-glyph">★</span>
            </button>
          </div>

          <div class="expression-english">${escapeHtml(item.english)}</div>
          <div class="expression-chinese">${escapeHtml(item.chinese)}</div>

          <div class="meta-box">
            <span class="meta-label">适合什么时候说</span>
            <div class="meta-text">${escapeHtml(item.scene || "适合日常陪宝宝时说。")}</div>
          </div>

          <div class="favorite-meta">
            <span class="mini-stat">复习 ${(item.reviewCount || 0)} 次</span>
            <span class="mini-stat">错题 ${(item.wrongCount || 0)} 次</span>
            <span class="mini-stat">熟练度 ${(item.mastery || 0)}</span>
          </div>

          <div class="action-row">
            <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(item.english)}" data-rate="0.72">慢速听</button>
            <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(item.english)}" data-rate="1">正常听</button>
            <button class="btn btn-ghost" type="button" data-action="remove-favorite" data-id="${escapeHtml(item.id)}">移出收藏</button>
          </div>
        </article>
      `;
}

// 处理 renderTopicFilter 函数。
function renderTopicFilter(list) {
    const current = elements.topicFilter.value || "all";
    const topics = Array.from(new Set(list.map(item => item.topic).filter(Boolean)));
    elements.topicFilter.innerHTML = `<option value="all">全部主题</option>` +
        topics.map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join("");
    elements.topicFilter.value = topics.includes(current) ? current : "all";
}

// 处理 removeFavorite 函数。
function removeFavorite(id) {
    const list = loadExpressions();
    const next = list.filter(item => item.id !== id);
    saveExpressions(next);
    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    showToast("已从收藏本移出。", "info");
}

// 处理 deletePendingLesson 函数。
function deletePendingLesson() {
    const id = appState.pendingDeleteLessonId;
    if (!id) return;

    const savedLessons = SavedLessonRepo.list();
    const lesson = SavedLessonRepo.findByRef(id, savedLessons);
    if (!lesson) {
        closeSheet("delete");
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    const deletedKeys = new Set(getLessonExpressionAudioTexts(lesson).map(english => buildExpressionKey({
        english
    })));
    const remainingLessons = savedLessons.filter(item => !SavedLessonRepo.isSameLesson(item, lesson));
    const remainingKeys = new Set();
    remainingLessons.forEach(item => {
        getLessonExpressionAudioTexts(item).forEach(english => {
            remainingKeys.add(buildExpressionKey({
                english
            }));
        });
    });

    saveSavedLessons(remainingLessons);

    const nextExpressions = loadExpressions().filter(item => {
        const key = buildExpressionKey(item);
        return !deletedKeys.has(key) || remainingKeys.has(key);
    });
    saveExpressions(nextExpressions);

    if (appState.warehouseLessonLoopId === String(lesson.id || lesson.key || "")) {
        stopWarehousePlayback({
            render: false
        });
    }

    appState.warehouseIndex = clamp(appState.warehouseIndex, 0, Math.max(0, remainingLessons.length - 1));
    closeSheet("delete");
    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    showToast("这组已经从仓库删除。", "success");
}

// 处理 refreshReviewPanel 函数。
function refreshReviewPanel() {
    refreshReviewLaunchState();

    const total = loadExpressions().length;
    if (!total) {
        if (!appState.reviewItems.length) {
            elements.reviewContainer.innerHTML = `
            <div class="empty-card">
              <strong>复习区还没有题目。</strong>
              <p>先去“学习”页生成一组句子，点“保存到仓库”，就能从这些表达里轻复习。</p>
            </div>
          `;
        }
        return;
    }

    if (!appState.reviewItems.length) {
        elements.reviewContainer.innerHTML = `
          <div class="glass-block">
            <div class="section-kicker">
              <span>⏱</span>
              <span>轻量模式</span>
            </div>
            <h2 style="margin-top: 8px;">这轮只做 ${Math.min(5, total)} 题，保持轻一点。</h2>
            <p class="section-copy">
              让复习像翻便签，而不是考试。答错时也会把正确答案亮出来，方便你立刻再听一遍。
            </p>
          </div>
        `;
    }
}

// 处理 refreshReviewLaunchState 函数。
function refreshReviewLaunchState() {
    const total = loadExpressions().length;
    const reviewCount = Math.min(5, total);

    if (!total) {
        elements.reviewLaunchTitle.textContent = "先保存一组，再开始复习";
        elements.reviewLaunchCopy.textContent = "保存到仓库后会自动从高频表达里抽题。";
        elements.startReviewBtn.disabled = true;
        elements.startReviewBtn.textContent = "开始复习";
        return;
    }

    elements.reviewLaunchTitle.textContent = `仓库已有 ${total} 句，可开始 ${reviewCount} 题轻复习`;
    elements.reviewLaunchCopy.textContent = "会优先抽错题、久未复习句子和熟练度低的表达。";
    elements.startReviewBtn.disabled = false;
    elements.startReviewBtn.textContent = appState.reviewItems.length ? "重新来一组" : `开始 ${reviewCount} 题复习`;
}

// 处理 startReview 函数。
function startReview() {
    const list = loadExpressions();
    if (!list.length) {
        refreshReviewPanel();
        return;
    }

    appState.reviewItems = pickReviewItems(list, Math.min(5, list.length));
    appState.reviewIndex = 0;
    appState.reviewAnswered = false;
    renderReviewQuestion();
}

// 处理 startLessonReview 函数。
function startLessonReview(id) {
    const lesson = SavedLessonRepo.findByRef(id);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    const list = loadExpressions();
    const added = addLessonExpressionsToList(list, lesson);
    if (added) {
        saveExpressions(list);
    }

    const latest = loadExpressions();
    const lessonKeys = new Set(getLessonExpressionAudioTexts(lesson).map(english => buildExpressionKey({
        english
    })));
    const items = latest.filter(item => lessonKeys.has(buildExpressionKey(item)));

    if (!items.length) {
        showToast("这一组还没有可复习的句子。", "error");
        return;
    }

    stopWarehousePlayback({
        render: false
    });
    appState.reviewItems = pickReviewItems(items, Math.min(5, items.length));
    appState.reviewIndex = 0;
    appState.reviewAnswered = false;
    switchTab("review", {
        keepScroll: false
    });
    elements.reviewLaunchTitle.textContent = `正在复习：${lesson.topic || "这一组"}`;
    elements.reviewLaunchCopy.textContent = "这轮只抽当前仓库卡片里的句子，答对答错都会记录。";
    elements.startReviewBtn.disabled = false;
    elements.startReviewBtn.textContent = "重新抽全局复习";
    renderReviewQuestion();
}

// 处理 pickReviewItems 函数。
function pickReviewItems(list, count) {
    const now = Date.now();
    return [...list]
        .map(item => {
            const last = item.lastReviewedAt ? new Date(item.lastReviewedAt).getTime() : 0;
            const days = last ? Math.floor((now - last) / 86400000) : 30;
            const score = (item.wrongCount || 0) * 4 - (item.mastery || 0) + days * 0.6 - (item.reviewCount || 0) * 0.3;
            return {
                ...item,
                _score: score
            };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, count);
}

// 处理 renderReviewQuestion 函数。
function renderReviewQuestion() {
    const item = appState.reviewItems[appState.reviewIndex];
    if (!item) {
        appState.reviewItems = [];
        appState.reviewIndex = 0;
        appState.reviewAnswered = false;
        elements.reviewContainer.innerHTML = `
          <div class="glass-block">
            <div class="section-kicker">
              <span>🌟</span>
              <span>完成</span>
            </div>
            <h2 style="margin-top: 8px;">这一轮复习结束啦。</h2>
            <p class="section-copy">
              已经很好了。下一次继续用仓库里的句子慢慢加深熟悉度，不用一次背很多。
            </p>
          </div>
        `;
        refreshReviewLaunchState();
        renderBook();
        return;
    }

    const options = buildOptions(item, loadExpressions());
    elements.reviewContainer.innerHTML = `
        <article class="review-card">
          <span class="review-progress">第 ${appState.reviewIndex + 1} / ${appState.reviewItems.length} 题</span>
          <div class="review-question">“${escapeHtml(item.chinese)}” 用英语怎么说？</div>
          <p class="review-support">先凭感觉选，再点击“听正确答案”把口感找回来。</p>

          <div class="choices">
            ${options
              .map(option => {
                return `
                  <button
                    class="choice-btn"
                    type="button"
                    data-action="answer-review"
                    data-id="${escapeHtml(item.id)}"
                    data-answer="${encodeData(option)}"
                  >
                    ${escapeHtml(option)}
                  </button>
                `;
              })
              .join("")}
          </div>

          <div id="reviewFeedback" class="review-feedback"></div>

          <div class="action-row">
            <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(item.english)}" data-rate="0.72">听正确答案</button>
            <button class="btn btn-primary" type="button" data-action="next-review" disabled>下一题</button>
          </div>
        </article>
      `;
}

// 处理 buildOptions 函数。
function buildOptions(correctItem, all) {
    const wrongs = all
        .filter(item => item.id !== correctItem.id)
        .map(item => item.english)
        .filter(Boolean)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);

    const fallback = REVIEW_FALLBACK_OPTIONS
        .filter(text => text !== correctItem.english && !wrongs.includes(text));

    while (wrongs.length < 2 && fallback.length) {
        wrongs.push(fallback.shift());
    }

    return [correctItem.english, ...wrongs].sort(() => Math.random() - 0.5);
}

// 处理 answerReview 函数。
function answerReview(button) {
    if (appState.reviewAnswered) return;

    const item = appState.reviewItems[appState.reviewIndex];
    if (!item) return;

    const selected = decodeData(button.dataset.answer);
    const isCorrect = selected === item.english;
    appState.reviewAnswered = true;

    const optionButtons = Array.from(elements.reviewContainer.querySelectorAll(".choice-btn"));
    optionButtons.forEach(optionButton => {
        optionButton.classList.add("locked");
        const answer = decodeData(optionButton.dataset.answer);
        if (answer === item.english) {
            optionButton.classList.add("correct");
        } else if (optionButton === button) {
            optionButton.classList.add("wrong");
        }
    });

    const feedback = document.getElementById("reviewFeedback");
    if (feedback) {
        feedback.className = `review-feedback show ${isCorrect ? "good" : "bad"}`;
        feedback.textContent = isCorrect ?
            "答对了，这句已经开始变成你的自然反应。" :
            `没关系，正确答案是：${item.english}`;
    }

    const nextBtn = elements.reviewContainer.querySelector("[data-action='next-review']");
    if (nextBtn) {
        nextBtn.disabled = false;
    }

    updateReviewStats(item.id, isCorrect);
    renderBook();
    if (navigator.vibrate) {
        navigator.vibrate(isCorrect ? 24 : [14, 40, 14]);
    }
}

// 处理 nextReviewQuestion 函数。
function nextReviewQuestion() {
    if (!appState.reviewItems.length) return;
    appState.reviewIndex += 1;
    appState.reviewAnswered = false;
    renderReviewQuestion();
}

// 处理 updateReviewStats 函数。
function updateReviewStats(id, isCorrect) {
    const list = loadExpressions();
    const next = list.map(item => {
        if (item.id !== id) return item;
        return {
            ...item,
            reviewCount: (item.reviewCount || 0) + 1,
            wrongCount: (item.wrongCount || 0) + (isCorrect ? 0 : 1),
            mastery: Math.max(0, (item.mastery || 0) + (isCorrect ? 1 : -1)),
            lastReviewedAt: new Date().toISOString()
        };
    });
    saveExpressions(next);
}

// 处理 renderPlay 函数。
function renderPlay() {
    const lesson = getDailyMemoryLesson(loadSavedLessons());

    if (!lesson) {
        elements.playContainer.innerHTML = `
          <div class="empty-card">
            <strong>还没有可推送的每日一记。</strong>
            <p>先在学习页生成一组表达，并保存到仓库。这里会每天从仓库随机抽一组做成卡片。</p>
          </div>
        `;
        return;
    }

    const cardData = buildMemoryCardData(lesson, lesson.expressions || []);
    const activity = lesson?.kid_activity || buildLocalActivity(cardData.expressions);

    elements.playContainer.innerHTML = `
        <div class="poster-layout">
          <div class="memory-card-capture" id="memoryCardCapture">
            <div class="poster-card" id="memoryCard">
              <div>
                <span class="poster-date">${escapeHtml(formatDate(new Date()))} · 每日一记</span>
                <div class="poster-topic">${escapeHtml(cardData.topic)}</div>
                <div class="poster-word">${escapeHtml(cardData.coreWord)}</div>
              </div>

              <div class="poster-quote">
                ${renderPosterLines(cardData.expressions)}
              </div>

              <div class="poster-footer">${escapeHtml(cardData.footer)}</div>
            </div>

            <div class="activity-card">
              <div class="section-kicker">
                <span>📎</span>
                <span>卡片旁白</span>
              </div>
              <h3>${escapeHtml(activity.title)}</h3>
              <div class="activity-list">
                ${(activity.steps || [])
                  .map((step, index) => {
                    return `
                      <div class="activity-item">
                        <span class="activity-index">${index + 1}</span>
                        <div class="activity-text">${escapeHtml(step)}</div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="button" data-action="open-memory-card-image">打开保存图</button>
            <button class="btn btn-secondary" type="button" data-action="speak-memory-card">听这张卡片</button>
          </div>
        </div>
      `;
}

// 处理 getDailyMemoryLesson 函数。
function getDailyMemoryLesson(lessons) {
    const list = (lessons || []).filter(lesson => lesson?.expressions?.length);
    if (!list.length) return null;

    const today = buildDateKey(new Date());
    const stored = loadDailyMemoryPick();
    if (stored.date === today && stored.lessonKey) {
        const picked = list.find(lesson => String(lesson.key || lesson.id || "") === stored.lessonKey);
        if (picked) return picked;
    }

    const picked = list[Math.floor(Math.random() * list.length)];
    saveDailyMemoryPick({
        date: today,
        lessonKey: String(picked.key || picked.id || "")
    });
    return picked;
}

// 处理 loadDailyMemoryPick 函数。
function loadDailyMemoryPick() {
    const parsed = StorageRepo.memoryCard.load();
    return {
        date: String(parsed?.date || ""),
        lessonKey: String(parsed?.lessonKey || "")
    };
}

// 处理 saveDailyMemoryPick 函数。
function saveDailyMemoryPick(pick) {
    StorageRepo.memoryCard.save(pick);
}

// 处理 buildDateKey 函数。
function buildDateKey(date) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${safeDate.getFullYear()}-${month}-${day}`;
}

// 处理 buildMemoryCardData 函数。
function buildMemoryCardData(lesson, saved) {
    const expressions = getPosterExpressions(lesson, saved);
    const firstExpression = expressions[0] || getDemoLesson().expressions[0];
    return {
        topic: lesson?.topic || firstExpression.topic || "亲子英语",
        coreWord: lesson?.core_word?.english ?
            `${lesson.core_word.english} · ${lesson.core_word.chinese}` : "Baby English",
        expressions,
        footer: lesson?.encouragement || "今天会说一句，就已经很好了。"
    };
}

// 处理 getPosterExpressions 函数。
function getPosterExpressions(lesson, saved = []) {
    const source = lesson?.expressions?.length ? lesson.expressions : saved;
    const expressions = source
        .slice(0, 10)
        .map(item => ({
            english: String(item?.english || "").trim(),
            chinese: String(item?.chinese || "").trim()
        }))
        .filter(item => item.english);

    return expressions.length ? expressions : getDemoLesson().expressions.slice(0, 5);
}

// 处理 renderPosterLines 函数。
function renderPosterLines(expressions) {
    return expressions.slice(0, 10).map((expression, index) => `
        <div class="poster-line">
          <span class="poster-index">${index + 1}</span>
          <div>
            <strong>${escapeHtml(expression.english || "Good job!")}</strong>
            <span>${escapeHtml(expression.chinese || "真棒！")}</span>
          </div>
        </div>
      `).join("");
}

// 处理 buildLocalActivity 函数。
function buildLocalActivity(saved) {
    const picks = saved.slice(0, 3);
    if (!picks.length) return getDemoLesson().kid_activity;

    return {
        title: "三句话亲子互动",
        steps: [
            `妈妈先慢慢说：${picks[0].english}`,
            picks[1] ? `换一个动作或物品，再说：${picks[1].english}` : "让宝宝指一指、摸一摸或跟着说。",
            picks[2] ? `宝宝有反应后，表扬：${picks[2].english}` : "宝宝有反应后，说：Good job!"
        ]
    };
}

// 打开每日记忆卡片的图片预览。
async function openMemoryCardPreview(button) {
    const card = document.getElementById("memoryCardCapture");
    if (!card) return;

    return openPreviewWithBusyButton(button, () => IMAGE_PREVIEW_BUILDERS.memoryCard({
        card
    }));
}

// 打开仓库课程的图片预览。
async function openLessonImagePreview(id, button) {
    const lesson = SavedLessonRepo.findByRef(id);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    return openPreviewWithBusyButton(button, () => IMAGE_PREVIEW_BUILDERS.lesson({
        lesson
    }));
}

// 打开图片预览时统一处理触发按钮的忙碌态。
async function openPreviewWithBusyButton(button, buildConfig) {
    const isIconButton = button?.classList?.contains("warehouse-image-btn");
    const originalHtml = button?.innerHTML || "";
    const originalLabel = button?.textContent || "打开保存图";
    setButtonBusy(button, true, isIconButton ? "…" : "生成图片...");

    try {
        await openImagePreview(buildConfig());
    } finally {
        restoreImagePreviewButton(button, isIconButton, originalHtml, originalLabel);
    }
}

// 通用图片预览面板负责打开、渲染和错误提示。
async function openImagePreview({
    title,
    copy,
    alt = title,
    successMessage = "图片好了，长按保存到相册。",
    getCanvas
}) {
    openSheet("image", () => {
        elements.imageSheetTitle.textContent = title;
        elements.imageSheetCopy.textContent = copy;
        elements.imagePreviewContent.innerHTML = IMAGE_PREVIEW_HTML.loading;
    });

    try {
        const canvas = await getCanvas();
        const imageUrl = canvas.toDataURL("image/png");
        elements.imagePreviewContent.innerHTML = `<img src="${imageUrl}" alt="${escapeHtml(alt)}" />`;
        showToast(successMessage, "success");
    } catch (error) {
        console.error(error);
        elements.imagePreviewContent.innerHTML = IMAGE_PREVIEW_HTML.error;
        showToast("图片生成失败了，请稍后再试。", "error");
    }
}

// 恢复触发图片预览的按钮状态。
function restoreImagePreviewButton(button, isIconButton, originalHtml, originalLabel = "打开保存图") {
    if (isIconButton) {
        button.disabled = false;
        button.classList.remove("loading");
        button.innerHTML = originalHtml;
        return;
    }

    setButtonBusy(button, false, originalLabel);
}

// 将仓库课程渲染成可保存的图片画布。
async function renderLessonCanvas(lesson) {
    const stage = document.createElement("div");
    stage.className = "render-stage";
    stage.innerHTML = buildLessonPosterHtml(lesson);
    document.body.appendChild(stage);

    try {
        const card = stage.querySelector(".poster-card");
        const canvas = await html2canvas(card, {
            backgroundColor: null,
            scale: 2
        });
        return canvas;
    } finally {
        stage.remove();
    }
}

// 处理 buildLessonPosterHtml 函数。
function buildLessonPosterHtml(lesson) {
    const expressions = getPosterExpressions(lesson);
    return `
        <div class="poster-card">
          <div>
            <span class="poster-date">${escapeHtml(formatDate(new Date(lesson.updatedAt || lesson.createdAt || Date.now())))} · 仓库保存</span>
            <div class="poster-topic">${escapeHtml(lesson.topic || "亲子英语")}</div>
            <div class="poster-word">${escapeHtml(lesson.core_word?.english || "Baby English")} · ${escapeHtml(lesson.core_word?.chinese || "亲子英语")}</div>
          </div>
          <div class="poster-quote">
            ${renderPosterLines(expressions)}
          </div>
          <div class="poster-footer">${escapeHtml(lesson.encouragement || "保存可以复看，重复听。")}</div>
        </div>
      `;
}

// 处理 setLoading 函数。
function setLoading(loading, mode = "compact") {
    appState.loading = loading;
    const activeMode = normalizeGenerationMode(mode);
    GENERATE_BTN_CONFIG.forEach(item => {
        const node = elements[item.nodeKey];
        if (!node) return;
        const isActive = loading && item.mode === activeMode;
        node.disabled = loading;
        node.classList.remove("loading");
        const label = node.querySelector(".btn-label");
        if (label) {
            label.textContent = isActive ? item.busy : item.idle;
        }
    });

    elements.topicInput.disabled = loading;
    elements.loadingSkeleton.classList.toggle("show", loading);
    elements.lessonContainer.style.display = loading ? "none" : "";
}

// 处理 setButtonBusy 函数。
function setButtonBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle("loading", busy);
    button.textContent = label;
}

// 处理 switchTab 函数。
function switchTab(tab, options = {}) {
    appState.activeTab = tab;

    elements.navButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.tab === tab);
    });

    elements.panels.forEach(panel => {
        panel.classList.toggle("active", panel.id === `tab-${tab}`);
    });

    if (tab === "book") {
        renderBook();
    }

    if (tab === "review") {
        refreshReviewPanel();
    }

    if (tab === "play") {
        renderPlay();
    }

    if (tab === "learn") {
        renderCurrentLesson();
    }

    if (!options.keepScroll) {
        elements.mainScroll.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    if (navigator.vibrate) {
        navigator.vibrate(12);
    }

    updateUsageGuideButton();
}

// 处理 fillTopic 函数。
function fillTopic(topic) {
    elements.topicInput.value = topic;
    elements.topicInput.focus();
    elements.topicInput.setSelectionRange(topic.length, topic.length);
    showToast(`已填入“${topic}”。`, "info");
}

// 打开指定 Sheet 并执行可选准备逻辑。
function openSheet(name, setup = null) {
    const target = SHEETS[name];
    if (!target) return;

    Object.keys(SHEETS).forEach(closeSheet);
    setup?.();
    elements[target.overlay]?.classList.add("show");
    elements[target.sheet]?.classList.add("show");
}

// 关闭指定 Sheet 并执行对应清理逻辑。
function closeSheet(name) {
    const target = SHEETS[name];
    if (!target) return;

    elements[target.overlay]?.classList.remove("show");
    elements[target.sheet]?.classList.remove("show");
    target.cleanup?.();
}

// 打开指定课程相关 Sheet 并应用对应准备逻辑。
function openLessonSheet(name, id) {
    const setup = LESSON_SHEET_OPENERS[name];
    if (!setup) return;

    const lesson = SavedLessonRepo.findByRef(id);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    openSheet(name, () => setup(lesson));
}

// 打开仓库删除确认面板。
function openDeleteConfirm(id) {
    openLessonSheet("delete", id);
}

// 打开 GitHub 仓库信息面板。
function openGithubSheet() {
    openSheet("github", () => {
        elements.githubStarCount.textContent = "…";
        elements.githubStarHint.textContent = "正在读取 GitHub 信息";
        fetchGithubRepoInfo();
    });
}

// 跳转到项目 GitHub 仓库。
function openGithubRepo() {
    window.location.href = GITHUB_REPO_CONFIG.url;
}

// 拉取 GitHub 仓库基础展示信息。
async function fetchGithubRepoInfo() {
    try {
        const response = await fetch(GITHUB_REPO_CONFIG.apiUrl, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API ${response.status}`);
        }

        const data = await response.json();
        const stars = Number(data?.stargazers_count || 0);
        elements.githubStarCount.textContent = formatCount(stars);
        elements.githubStarHint.textContent = `${GITHUB_REPO_CONFIG.slug} · GitHub API`;
    } catch (error) {
        console.warn("GitHub repo info skipped:", error);
        elements.githubStarCount.textContent = "--";
        elements.githubStarHint.textContent = "网络暂时没读到，可直接打开仓库";
    }
}

// 打开豆包训练指令面板。
function openDoubaoTraining(id) {
    openLessonSheet("doubao", id);
}

// 复制豆包训练指令并尝试跳转。
async function copyPromptAndOpenDoubao(button) {
    const prompt = elements.doubaoPromptText.value.trim();
    if (!prompt) {
        showToast("还没有可复制的魔法指令。", "error");
        return;
    }

    const originalLabel = button?.textContent || "复制并跳转豆包";
    setButtonBusy(button, true, "正在复制...");

    try {
        await copyTextToClipboard(prompt);
        showToast("魔法指令已复制，打开豆包后直接粘贴。", "success");
        window.location.href = "doubao://";
    } catch (error) {
        console.error(error);
        showToast("复制失败了，可以长按上面的魔法指令手动复制。", "error");
    } finally {
        setButtonBusy(button, false, originalLabel);
    }
}

// 处理 copyTextToClipboard 函数。
async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
        const ok = document.execCommand("copy");
        if (!ok) throw new Error("复制失败");
    } finally {
        textarea.remove();
    }
}

// 处理 updateUsageGuideButton 函数。
function updateUsageGuideButton() {
    const guide = usageGuides[appState.activeTab] || usageGuides.learn;
    elements.usageGuideBtn.setAttribute("aria-label", `打开${guide.tabName}页使用介绍`);
    elements.usageGuideBtn.querySelector("span:last-child").textContent = `如何使用${guide.tabName}页？点我`;
}

// 处理 renderUsageGuide 函数。
function renderUsageGuide() {
    const guide = usageGuides[appState.activeTab] || usageGuides.learn;
    elements.guideTitle.textContent = `如何使用${guide.tabName}页`;
    elements.guideContent.innerHTML = `
        <div class="usage-guide-hero">
          <div class="usage-guide-kicker">
            <span>${escapeHtml(guide.icon)}</span>
            <span>${escapeHtml(guide.title)}</span>
          </div>
          <h2 class="usage-guide-title">${escapeHtml(guide.heading)}</h2>
          <p class="usage-guide-copy">${escapeHtml(guide.copy)}</p>
        </div>
        <div class="usage-guide-list">
          ${guide.steps.map(step => `
            <div class="usage-guide-item">
              <span class="usage-guide-icon">${escapeHtml(step.icon)}</span>
              <span class="usage-guide-text">
                <strong>${escapeHtml(step.title)}</strong>
                <span>${escapeHtml(step.copy)}</span>
              </span>
            </div>
          `).join("")}
        </div>
      `;
}

// 处理 unlockConfigFromInputs 函数。
function unlockConfigFromInputs() {
    const hasNewPassword = !!normalizeCredential(elements.apiKeyInput.value);
    appState.config = readConfigFromInputs();
    saveConfig(appState.config);
    hydrateConfigInputs();
    closeSheet("settings");
    showToast(hasNewPassword ? "完整密码已保存到这个浏览器。" : "已经保留原来的完整密码。", "success");
}

// 处理 speak 函数。
async function speak(text, rate = 1, button = null) {
    if (!text) return;

    const originalLabel = button?.textContent || "播放读音";
    const cachedAudio = getCachedAudio(buildAudioCacheKey(text, rate));
    const compactButton = button?.classList?.contains("warehouse-line-speak") || button?.classList?.contains("warehouse-speak-btn");
    setButtonBusy(button, true, compactButton ? "…" : (cachedAudio ? "播放中..." : "准备读音..."));

    try {
        await unlockAudioPlayback();
        const audioUrl = await getOrFetchAudio(text, rate);
        stopCurrentAudio();
        await playAudioUrl(audioUrl);
    } catch (error) {
        console.error(error);
        showToast("读音播放失败了，可以稍后再试。错误：" + friendlyError(error), "error");
    } finally {
        setButtonBusy(button, false, originalLabel);
    }
}

// 处理 playAudioTexts 函数。
async function playAudioTexts(texts, rate = 0.72) {
    for (const text of texts) {
        const audioUrl = await getOrFetchAudio(text, rate);
        stopCurrentAudio();
        await playAudioUrl(audioUrl);
    }
}

// 处理 getAudioPlayer 函数。
function getAudioPlayer() {
    if (!appState.audio) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.setAttribute("playsinline", "");
        audio.setAttribute("webkit-playsinline", "");
        appState.audio = audio;
    }

    return appState.audio;
}

// 处理 unlockAudioPlayback 函数。
async function unlockAudioPlayback() {
    if (appState.audioUnlocked) return;

    const audio = getAudioPlayer();
    const previousVolume = audio.volume;
    audio.src = SILENT_AUDIO_URL;
    audio.volume = 0;

    try {
        await audio.play();
        audio.pause();
        try {
            audio.currentTime = 0;
        } catch {}
        appState.audioUnlocked = true;
    } finally {
        audio.volume = previousVolume || 1;
    }
}

// 处理 playAudioUrl 函数。
function playAudioUrl(audioUrl) {
    return new Promise((resolve, reject) => {
        const audio = getAudioPlayer();
        const token = createId();
        let settled = false;
        appState.audioPlayToken = token;
        appState.audioUrl = audioUrl;

        const finish = () => {
            if (settled) return;
            settled = true;
            clearCurrentAudio(token);
            resolve();
        };
        const fail = error => {
            if (settled) return;
            settled = true;
            clearCurrentAudio(token);
            reject(error);
        };

        audio.onended = finish;
        appState.audioStopResolver = finish;
        audio.onerror = () => {
            fail(new Error("音频播放失败。"));
        };

        audio.volume = 1;
        audio.src = audioUrl;
        try {
            audio.currentTime = 0;
        } catch {}

        const playPromise = audio.play();
        if (playPromise?.catch) {
            playPromise.catch(error => {
                fail(error);
            });
        }
    });
}

// 处理 getOrFetchAudio 函数。
async function getOrFetchAudio(text, rate = 1) {
    const cacheKey = buildAudioCacheKey(text, rate);
    return getCachedAudio(cacheKey) || await fetchYoudaoSpeech(text, rate, cacheKey);
}

// 处理 stopCurrentAudio 函数。
function stopCurrentAudio() {
    if (appState.audio) {
        appState.audio.pause();
    }

    if (typeof appState.audioStopResolver === "function") {
        appState.audioStopResolver();
    }

    if (appState.audioUrl && appState.audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(appState.audioUrl);
        appState.audioUrl = "";
    }
}

// 处理 clearCurrentAudio 函数。
function clearCurrentAudio(token = "") {
    if (token && appState.audioPlayToken && appState.audioPlayToken !== token) {
        return;
    }

    if (appState.audioUrl && appState.audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(appState.audioUrl);
    }

    if (appState.audio) {
        appState.audio.onended = null;
        appState.audio.onerror = null;
    }

    appState.audioStopResolver = null;
    appState.audioPlayToken = "";
    appState.audioUrl = "";
}

// 处理 fetchYoudaoSpeech 函数。
async function fetchYoudaoSpeech(text, rate, cacheKey = "") {
    const q = String(text || "").trim();
    const appSecret = appState.config.ttsSecret || YOUDAO_TTS_CONFIG.fallbackSecret;

    if (!appSecret) {
        openSheet("settings", hydrateConfigInputs);
        throw new Error("请先填写完整密码。");
    }

    if (!window.crypto?.subtle || !window.TextEncoder) {
        throw new Error("当前浏览器不支持安全签名，请用 https 页面打开。");
    }

    let lastError = null;
    for (let attempt = 1; attempt <= AUDIO_RETRY_CONFIG.maxAttempts; attempt += 1) {
        try {
            const dataUrl = await fetchYoudaoSpeechOnce(q, rate, appSecret);
            saveCachedAudio(cacheKey || buildAudioCacheKey(text, rate), dataUrl);
            return dataUrl;
        } catch (error) {
            lastError = error;
            if (attempt >= AUDIO_RETRY_CONFIG.maxAttempts || !isRetryableAudioError(error)) {
                throw error;
            }

            console.warn(`TTS retry ${attempt}/${AUDIO_RETRY_CONFIG.maxAttempts}:`, error);
            await wait(getAudioRetryDelay());
        }
    }

    throw lastError || new Error("读音服务暂时不可用。");
}

// 处理 fetchYoudaoSpeechOnce 函数。
async function fetchYoudaoSpeechOnce(q, rate, appSecret) {
    const salt = createId();
    const curtime = Math.floor(Date.now() / 1000).toString();
    const input = buildYoudaoInput(q);
    const sign = await sha256Hex(`${YOUDAO_TTS_CONFIG.appKey}${input}${salt}${curtime}${appSecret}`);
    const body = new URLSearchParams({
        q,
        appKey: YOUDAO_TTS_CONFIG.appKey,
        salt,
        sign,
        signType: "v3",
        curtime,
        format: "mp3",
        speed: formatYoudaoSpeed(rate),
        volume: "1.00",
        voiceName: "youxiaomei"
    });

    const response = await fetch(YOUDAO_TTS_CONFIG.endpoint, {
        method: "POST",
        body
    });
    const contentType = response.headers.get("Content-Type") || "";

    if (response.ok && contentType.toLowerCase().includes("audio")) {
        const blob = await response.blob();
        return await blobToDataUrl(blob);
    }

    const errorText = await response.text();
    let message = errorText || `HTTP ${response.status}`;
    let errorCode = "";
    try {
        const payload = JSON.parse(errorText);
        if (payload.errorCode) {
            errorCode = String(payload.errorCode);
            message = YOUDAO_ERROR_MSG[errorCode] ?? `读音服务返回错误 ${errorCode}`;
        }
    } catch {}

    const error = new Error(message);
    error.status = response.status;
    error.errorCode = errorCode;
    throw error;
}

// 处理 isRetryableAudioError 函数。
function isRetryableAudioError(error) {
    const status = Number(error?.status ?? 0);
    const code = String(error?.errorCode ?? "");
    const message = String(error?.message ?? error ?? "").toLowerCase();

    return RETRYABLE_HTTP.has(status) ||
        status >= 500 ||
        RETRYABLE_CODE.has(code) ||
        RETRYABLE_WORDS.some(word => message.includes(word));
}

// 处理 getAudioRetryDelay 函数。
function getAudioRetryDelay() {
    return AUDIO_RETRY_CONFIG.interval;
}

// 处理 wait 函数。
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 处理 blobToDataUrl 函数。
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("音频缓存失败。"));
        reader.readAsDataURL(blob);
    });
}

// 处理 getLessonAudioTexts 函数。
function getLessonAudioTexts(lesson) {
    const texts = [];
    if (lesson?.core_word?.english) {
        texts.push(lesson.core_word.english);
    }

    (lesson?.expressions || []).forEach(expression => {
        if (expression?.english) {
            texts.push(expression.english);
        }
    });

    return Array.from(new Set(texts.map(text => String(text || "").trim()).filter(Boolean)));
}

// 处理 getLessonExpressionAudioTexts 函数。
function getLessonExpressionAudioTexts(lesson) {
    return (lesson?.expressions || [])
        .map(expression => String(expression?.english || "").trim())
        .filter(Boolean);
}

// 处理 getWarehouseEnglishTexts 函数。
function getWarehouseEnglishTexts(lessons) {
    const texts = [];
    (lessons || []).forEach(lesson => {
        (lesson?.expressions || []).forEach(expression => {
            if (expression?.english) {
                texts.push(expression.english);
            }
        });
    });

    return texts.map(text => String(text || "").trim()).filter(Boolean);
}

// 处理 queueAudioWarmup 函数。
function queueAudioWarmup(task) {
    const run = appState.audioWarmupQueue
        .catch(() => {})
        .then(task);

    appState.audioWarmupQueue = run.catch(error => {
        console.warn("Audio warmup failed:", error);
    });

    return run;
}

// 根据课程或课程列表构建读音预热任务。
function buildAudioJobs(target) {
    return (Array.isArray(target) ? target : [target])
        .filter(Boolean)
        .flatMap(lesson => getLessonExpressionAudioTexts(lesson))
        .flatMap(text => [{
            text,
            rate: 0.72
        },
        {
            text,
            rate: 1
        }
    ]);
}

// 执行统一的读音预热流程。
function warmAudio(target, onProgress = null) {
    return warmAudioJobs(buildAudioJobs(target), onProgress);
}

// 处理 warmAudioJobs 函数。
async function warmAudioJobs(jobs, onProgress = null) {
    const total = jobs.length;
    let done = 0;
    let saved = 0;
    const failed = [];
    onProgress?.({
        done,
        total,
        saved,
        failed: failed.length
    });

    for (const job of jobs) {
        try {
            await getOrFetchAudio(job.text, job.rate);
            saved += 1;
        } catch (error) {
            failed.push({
                ...job,
                error
            });
            console.warn("Audio warmup skipped:", job, error);
        } finally {
            done += 1;
            onProgress?.({
                done,
                total,
                saved,
                failed: failed.length
            });
        }
    }

    return {
        done,
        total,
        saved,
        failed
    };
}

// 处理 buildYoudaoInput 函数。
function buildYoudaoInput(q) {
    const chars = Array.from(q);
    if (chars.length <= 20) return q;
    return `${chars.slice(0, 10).join("")}${chars.length}${chars.slice(-10).join("")}`;
}

// 处理 formatYoudaoSpeed 函数。
function formatYoudaoSpeed(rate) {
    const speed = Math.max(0.5, Math.min(2, Number(rate) || 1));
    return String(Number(speed.toFixed(2)));
}

// 处理 sha256Hex 函数。
async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

// 处理 showToast 函数。
function showToast(message, type = "info") {
    elements.toastIcon.textContent = TOAST_ICON[type] ?? TOAST_ICON.info;
    elements.toastText.textContent = message;
    elements.toast.className = `toast show ${type}`;

    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        elements.toast.classList.remove("show");
    }, 2400);
}

// 处理 loadConfig 函数。
function loadConfig() {
    try {
        const saved = StorageRepo.config.load();
        const parsed = parseCombinedPassword(saved.password || saved.apiKey || "");
        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            ttsSecret: parsed.ttsSecret || normalizeCredential(saved.ttsSecret || ""),
            model: DEFAULT_CONFIG.model,
            fallbackModel: DEFAULT_CONFIG.fallbackModel,
            apiBase: DEFAULT_CONFIG.apiBase
        };
    } catch {
        return {
            ...DEFAULT_CONFIG
        };
    }
}

// 处理 saveConfig 函数。
function saveConfig(config) {
    const parsed = parseCombinedPassword(config?.password || config?.apiKey || "");
    StorageRepo.config.save({
        ...parsed
    });
}

// 处理 hydrateConfigInputs 函数。
function hydrateConfigInputs() {
    elements.apiKeyInput.value = "";
    elements.apiKeyInput.placeholder = appState.config.password ? "已保存，重新输入可替换" : "例如：sk-xxxxx-yyyy";
}

// 处理 readConfigFromInputs 函数。
function readConfigFromInputs() {
    const rawPassword = normalizeCredential(elements.apiKeyInput.value);
    const parsed = rawPassword ? parseCombinedPassword(rawPassword) : {
        password: appState.config.password || "",
        apiKey: appState.config.apiKey || "",
        ttsSecret: appState.config.ttsSecret || ""
    };

    return {
        apiBase: DEFAULT_CONFIG.apiBase,
        ...parsed,
        model: DEFAULT_CONFIG.model,
        fallbackModel: DEFAULT_CONFIG.fallbackModel
    };
}

// 处理 loadExpressions 函数。
function loadExpressions() {
    const raw = StorageRepo.expressions.load();
    if (!Array.isArray(raw)) return [];

    const map = new Map();
    raw.forEach(item => {
        const normalized = normalizeSavedExpression(item);
        if (!normalized.english) return;
        const key = normalized.key;
        if (!map.has(key)) {
            map.set(key, normalized);
        }
    });

    return Array.from(map.values()).sort((a, b) => {
        const left = new Date(b.favoriteAt || b.createdAt || 0).getTime();
        const right = new Date(a.favoriteAt || a.createdAt || 0).getTime();
        return left - right;
    });
}

// 处理 saveExpressions 函数。
function saveExpressions(list) {
    StorageRepo.expressions.save(list);
}

// 处理 loadSavedLessons 函数。
function loadSavedLessons() {
    const raw = StorageRepo.lessons.load();
    if (!Array.isArray(raw)) return [];
    return raw
        .map(normalizeSavedLesson)
        .filter(item => item.expressions.length)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

// 处理 saveSavedLessons 函数。
function saveSavedLessons(list) {
    StorageRepo.lessons.save(list.map(normalizeSavedLesson));
}

// 处理 markSavedLessonsAudioVersion 函数。
function markSavedLessonsAudioVersion(keys) {
    const keySet = new Set((keys || []).map(key => String(key || "")).filter(Boolean));
    if (!keySet.size) return;

    const next = loadSavedLessons().map(lesson => {
        const key = String(lesson.key || lesson.id || "");
        if (!keySet.has(key)) return lesson;
        return {
            ...lesson,
            audioVersion: STORAGE_VERSION,
            storageVersion: STORAGE_VERSION,
            updatedAt: lesson.updatedAt || new Date().toISOString()
        };
    });

    saveSavedLessons(next);
}

// 处理 buildSavedLesson 函数。
function buildSavedLesson(lesson) {
    const normalized = normalizeLesson(lesson, lesson?.topic || "亲子英语");
    const now = new Date().toISOString();
    return normalizeSavedLesson({
        ...normalized,
        id: buildLessonKey(normalized.topic),
        key: buildLessonKey(normalized.topic),
        createdAt: now,
        updatedAt: now,
        storageVersion: STORAGE_VERSION,
        audioVersion: 0
    });
}

// 处理 normalizeSavedLesson 函数。
function normalizeSavedLesson(lesson) {
    const normalized = normalizeLesson(lesson, lesson?.topic || "亲子英语");
    const key = String(lesson?.key || lesson?.id || buildLessonKey(normalized.topic));
    return {
        ...normalized,
        id: String(lesson?.id || key),
        key,
        createdAt: lesson?.createdAt || new Date().toISOString(),
        updatedAt: lesson?.updatedAt || lesson?.createdAt || new Date().toISOString(),
        storageVersion: Number(lesson?.storageVersion || 0),
        audioVersion: Number(lesson?.audioVersion || 0)
    };
}

// 处理 buildLessonKey 函数。
function buildLessonKey(topic) {
    return normalizeCacheText(topic || "亲子英语") || "lesson";
}

// 处理 loadLessonCache 函数。
function loadLessonCache() {
    const raw = StorageRepo.lessonCache.load();
    return raw && typeof raw === "object" ? raw : {};
}

// 处理 saveLessonCache 函数。
function saveLessonCache(cache) {
    StorageRepo.lessonCache.save(cache);
}

// 处理 buildLessonCacheKey 函数。
function buildLessonCacheKey(input, mode = "compact") {
    const normalized = normalizeCacheText(input);
    if (!normalized) return "";
    return `${normalizeGenerationMode(mode)}:${normalized}`;
}

// 处理 getCachedLesson 函数。
function getCachedLesson(key) {
    if (!key) return null;
    const cache = loadLessonCache();
    const item = cache[key];
    return item?.lesson ? item.lesson : null;
}

// 处理 saveCachedLesson 函数。
function saveCachedLesson(key, lesson) {
    if (!key || !lesson) return;
    const cache = loadLessonCache();
    cache[key] = {
        lesson,
        updatedAt: new Date().toISOString()
    };
    saveLessonCache(cache);
}

// 处理 normalizeCacheText 函数。
function normalizeCacheText(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// 处理 loadAudioCache 函数。
function loadAudioCache() {
    const raw = StorageRepo.audioCache.load();
    return raw && typeof raw === "object" ? raw : {};
}

// 处理 saveAudioCache 函数。
function saveAudioCache(cache) {
    try {
        StorageRepo.audioCache.save(cache);
    } catch (error) {
        console.warn("Audio cache skipped:", error);
    }
}

// 处理 buildAudioCacheKey 函数。
function buildAudioCacheKey(text, rate) {
    return `${normalizeCacheText(text)}|${formatYoudaoSpeed(rate)}|youxiaomei`;
}

// 处理 getCachedAudio 函数。
function getCachedAudio(cacheKey) {
    if (memoryAudioCache.has(cacheKey)) {
        return memoryAudioCache.get(cacheKey);
    }

    const cache = loadAudioCache();
    const dataUrl = cache[cacheKey]?.dataUrl;
    if (dataUrl) {
        memoryAudioCache.set(cacheKey, dataUrl);
        return dataUrl;
    }

    return "";
}

// 处理 saveCachedAudio 函数。
function saveCachedAudio(cacheKey, dataUrl) {
    if (!cacheKey || !dataUrl) return;
    memoryAudioCache.set(cacheKey, dataUrl);
    const cache = loadAudioCache();
    cache[cacheKey] = {
        dataUrl,
        updatedAt: new Date().toISOString()
    };
    saveAudioCache(cache);
}

// 处理 normalizeSavedExpression 函数。
function normalizeSavedExpression(item) {
    const english = String(item?.english || "").trim();
    const topic = String(item?.topic || "未分类").trim() || "未分类";
    return {
        id: String(item?.id || createId()),
        key: String(item?.key || buildExpressionKey({
            english
        })).trim(),
        topic,
        english,
        chinese: String(item?.chinese || "").trim(),
        scene: String(item?.scene || "适合日常陪宝宝时说。").trim(),
        note: String(item?.note || "重复多说几次，妈妈会越来越顺口。").trim(),
        createdAt: item?.createdAt || new Date().toISOString(),
        favoriteAt: item?.favoriteAt || item?.createdAt || new Date().toISOString(),
        lastReviewedAt: item?.lastReviewedAt || null,
        reviewCount: Number(item?.reviewCount || 0),
        wrongCount: Number(item?.wrongCount || 0),
        mastery: Number(item?.mastery || 0)
    };
}

// 处理 loadCurrentLesson 函数。
function loadCurrentLesson() {
    const raw = StorageRepo.current.load();
    if (!raw) return null;
    return normalizeLesson(raw, raw.topic || "今日主题");
}

// 处理 saveCurrentLesson 函数。
function saveCurrentLesson(lesson) {
    StorageRepo.current.save(lesson);
}

// 处理 buildSavedExpression 函数。
function buildSavedExpression(topic, expression) {
    const english = String(expression?.english || "").trim();
    return normalizeSavedExpression({
        id: createId(),
        key: buildExpressionKey({
            english
        }),
        topic,
        english,
        chinese: expression?.chinese || "",
        scene: expression?.scene || "",
        note: expression?.note || "",
        createdAt: new Date().toISOString(),
        favoriteAt: new Date().toISOString(),
        lastReviewedAt: null,
        reviewCount: 0,
        wrongCount: 0,
        mastery: 0
    });
}

// 处理 findSavedExpressionByKey 函数。
function findSavedExpressionByKey(list, key) {
    return list.find(item => item.key === key) || null;
}

// 处理 buildExpressionKey 函数。
function buildExpressionKey(item) {
    return String(item?.english || "")
        .trim()
        .toLowerCase();
}

// 处理 isExpressionFavorited 函数。
function isExpressionFavorited(expression, topic) {
    if (!expression?.english) return false;
    const key = buildExpressionKey({
        english: expression.english,
        topic
    });
    return !!findSavedExpressionByKey(loadExpressions(), key);
}

// 处理 countLessonFavorites 函数。
function countLessonFavorites(lesson) {
    if (!lesson?.expressions?.length) return 0;
    const list = loadExpressions();
    return lesson.expressions.filter(expression => findSavedExpressionByKey(list, buildExpressionKey({
        english: expression.english
    }))).length;
}

// 处理 normalizeBaseUrl 函数。
function normalizeBaseUrl(url) {
    let normalized = String(url || DEFAULT_CONFIG.apiBase).trim();
    normalized = normalized.replace(/\/+$/, "");
    normalized = normalized.replace(/\/chat\/completions$/i, "");
    if (!/\/v1$/i.test(normalized)) {
        normalized += "/v1";
    }
    return normalized;
}

// 处理 parseCombinedPassword 函数。
function parseCombinedPassword(value) {
    const password = normalizeCredential(value);
    const parts = password.split("-").filter(Boolean);
    const ttsSecret = parts.length >= 3 ? normalizeCredential(parts.pop()) : "";
    const apiKey = normalizeCredential(parts.length ? parts.join("-") : password, "apiKey");

    return {
        password,
        apiKey,
        ttsSecret
    };
}

// 处理 normalizeCredential 函数。
function normalizeCredential(value, mode = "raw") {
    const base = NORMALIZE_BASE(value);
    if (mode === "apiKey") {
        return base.match(/sk-[A-Za-z0-9_-]+/)?.[0] ?? base;
    }

    return base;
}

// 处理 createId 函数。
function createId() {
    return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 处理 clamp 函数。
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

// 处理 encodeData 函数。
function encodeData(value) {
    return encodeURIComponent(String(value ?? ""));
}

// 处理 decodeData 函数。
function decodeData(value) {
    try {
        return decodeURIComponent(String(value ?? ""));
    } catch {
        return String(value ?? "");
    }
}

// 处理 escapeHtml 函数。
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 处理 friendlyError 函数。
function friendlyError(error) {
    const text = String(error?.message || error || "未知错误");
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

// 处理 buildApiErrorMessage 函数。
function buildApiErrorMessage(status, text) {
    const raw = String(text || "");
    if (status === 400 && raw.includes("bad_response_status_code")) {
        return "API 400：模型或请求被服务商拒绝了。已改回可用的默认模型，刷新后再试一次。";
    }

    try {
        const payload = JSON.parse(raw);
        const message = payload?.error?.message || payload?.message;
        if (message) {
            return `API ${status}：${message}`;
        }
    } catch {}

    return `API ${status}: ${raw.slice(0, 240)}`;
}

// 处理 formatDate 函数。
function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        date = new Date();
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// 处理 formatCount 函数。
function formatCount(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count)) return "0";
    return count.toLocaleString("en-US");
}

// 处理 getInitialTab 函数。
function getInitialTab() {
    const tab = new URLSearchParams(location.search).get("tab");
    return VALID_TABS.has(tab) ? tab : "learn";
}

// 处理 getDemoLesson 函数。
function getDemoLesson() {
    return {
        topic: "苹果",
        input_type: "noun",
        level: "beginner",
        core_word: {
            english: "apple",
            chinese: "苹果",
            phonics_hint: "艾-pəl"
        },
        expressions: [{
                english: "This is an apple.",
                chinese: "这是一个苹果。",
                scene: "拿着苹果给宝宝看时说。",
                note: "This is... 是教宝宝认东西时最常用的句型。"
            },
            {
                english: "The apple is red.",
                chinese: "这个苹果是红色的。",
                scene: "教宝宝认颜色时说。",
                note: "可以一边指颜色，一边慢慢重复 red。"
            },
            {
                english: "Do you want an apple?",
                chinese: "你想要一个苹果吗？",
                scene: "问宝宝想不想吃苹果时说。",
                note: "Do you want...? 是非常高频的亲子问句。"
            },
            {
                english: "Let's eat the apple.",
                chinese: "我们吃这个苹果吧。",
                scene: "准备和宝宝一起吃苹果时说。",
                note: "Let's... 很适合带着孩子一起行动时用。"
            },
            {
                english: "Good job!",
                chinese: "真棒！",
                scene: "宝宝指对苹果或愿意跟读时说。",
                note: "表扬句越常用，孩子越愿意回应。"
            }
        ],
        kid_activity: {
            title: "找苹果小游戏",
            steps: [
                "先把苹果拿到宝宝眼前，慢慢说：This is an apple.",
                "再指一指颜色，说：The apple is red.",
                "最后让宝宝摸一摸或拿一拿，回应后立刻说：Good job!"
            ]
        },
        review_questions: [{
                type: "zh_to_en",
                question: "“这是一个苹果”用英语怎么说？",
                answer: "This is an apple."
            },
            {
                type: "zh_to_en",
                question: "“你想要一个苹果吗？”用英语怎么说？",
                answer: "Do you want an apple?"
            },
            {
                type: "en_to_zh",
                question: "Good job! 是什么意思？",
                answer: "真棒！"
            }
        ],
        encouragement: "今天先把最顺口的一句说出来，就已经是很好的开始。"
    };
}
