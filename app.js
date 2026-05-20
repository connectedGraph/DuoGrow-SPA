// 本地持久化键名集中管理。
const STORAGE_KEYS={config:"mom_english_config",expressions:"mom_english_expressions",currentLesson:"mom_english_current_lesson",savedLessons:"mom_english_saved_lessons",lessonCache:"mom_english_lesson_cache",audioCache:"mom_english_audio_cache",dailyMemoryCard:"mom_english_daily_memory_card",gamify:"mom_english_gamify"};

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

const SPEECH_SCORE_URL = "http://124.221.137.194/api/speech-score";

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
        systemPrompt: `你是一个"妈妈亲子英语优先级筛选助手"，专门帮50多岁的中文妈妈从一个家庭场景里挑出最值得先学、最容易马上说出口的英语短句。

你的目标是少而准。不要铺开太多表达，不要同义重复，不要为了覆盖面牺牲顺口度。每一句都要像妈妈今天就能对孩子说出来的话，短、自然、生活化，适合幼儿场景。

你必须严格生成5个英文表达。5句之间要功能不同，形成最小可用组合：引入主题、简单描述、常用问句、互动动作、表扬或收束。

输出必须温暖、具体、可直接开口。严格输出 JSON，不要 Markdown，不要额外解释。For API compatibility, the final answer must be a valid json object.

${GENERATION_JSON_SCHEMA}`,
        buildUserPrompt: userInput => `用户今天想学：${userInput}

请为她生成一组"精简版亲子英语表达包"。

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
        systemPrompt: `你是一个"亲子英语互动流程设计师"，专门帮50多岁的中文妈妈把一个家庭场景整理成一套可以连续使用的英语小脚本。

你的目标不是翻译词语，而是设计一组自然、不重复、能从开场用到收尾的亲子英语表达。每句都必须短、口语化、适合对幼儿说，不能出现考试式解释、复杂语法或成人化表达。

你必须严格生成10个英文表达。10句之间要承担不同功能，避免同义换皮、句式重复和场景重复。优先让句子组成一个小型互动流程：引入主题、观察描述、提问、动作互动、鼓励、回应、自然结束。

输出必须温暖、具体、可直接开口。严格输出 JSON，不要 Markdown，不要额外解释。For API compatibility, the final answer must be a valid json object.

${GENERATION_JSON_SCHEMA.replace('"target_count": 5', '"target_count": 10')}`,
        buildUserPrompt: userInput => `用户今天想学：${userInput}

请为她生成一组"丰富版亲子英语表达包"。

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
            var title = document.getElementById("deleteConfirmTitle");
            var copy = document.getElementById("deleteConfirmCopy");
            var confirmBtn = document.querySelector("#deleteConfirmSheet [data-action='confirm-exit-review']");
            if (confirmBtn) { confirmBtn.dataset.action = "confirm-delete-lesson"; confirmBtn.textContent = "确认删除"; confirmBtn.className = "btn btn-danger"; }
            if (title) title.textContent = "删除这组？";
            if (copy) copy.textContent = "删除后不能在应用里恢复。";
            var cancelBtn = document.querySelector("#deleteConfirmSheet [data-action='close-delete-confirm']");
            if (cancelBtn) cancelBtn.textContent = "保留";
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
    },
    sentence: {
        overlay: "sentenceOverlay",
        sheet: "sentenceSheet"
    }
};

// 课程 Sheet 打开器集中处理不同弹层的准备逻辑。
const LESSON_SHEET_OPENERS = {
    delete: lesson => {
        appState.pendingDeleteLessonId = String(lesson.id || lesson.key || "");
        elements.deleteConfirmTitle.textContent = `删除"${lesson.topic || "这组"}"？`;
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
const VALID_TABS = new Set(["learn", "book", "review", "play", "profile"]);

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
        tabName: "探索",
        icon: "⚡",
        title: "5 句先开口，10 句多储备",
        heading: "把日常动作，变成宝宝听得懂的英语时刻。",
        copy: "输入一个词、动作或场景，可以生成精简 5 句，也可以生成丰富 10 句。短句、自然、不会有学习压力。",
        steps: [{
                icon: "1",
                title: "输入场景",
                copy: "输入一个日常场景（洗澡、哄睡、穿鞋等），生成5句或10句亲子表达。"
            },
            {
                icon: "2",
                title: "保存到仓库",
                copy: "觉得好用就保存，之后可以在仓库反复听、复习。"
            },
            {
                icon: "3",
                title: "收藏单句",
                copy: "每句旁边有收藏星标，收藏的句子会进入轻练习题库。"
            }
        ]
    },
    book: {
        tabName: "仓库",
        icon: "📦",
        title: "仓库",
        heading: "保存好的主题，随时回来复看。",
        copy: "整组保存、循环播放、追加5句扩展、长按图片存相册。",
        steps: [{
                icon: "1",
                title: "整组保存与追加",
                copy: "5句的组可以点+5追加到10句，读音自动缓存到本地。"
            },
            {
                icon: "2",
                title: "循环听与后台听",
                copy: "点播放可逐句循环，切到后台也能持续播放。"
            },
            {
                icon: "3",
                title: "长按存图",
                copy: "打开保存图，长按就能放进相册。"
            }
        ]
    },
    review: {
        tabName: "竞技",
        icon: "⚔️",
        title: "轻练习 + PK 竞技",
        heading: "三种模式练句子，排位赛升段位。",
        copy: "上方三个按钮进入轻练习（速答/听力/翻译），下方进入PK竞技对战机器人。",
        steps: [{
                icon: "1",
                title: "轻练习三模式",
                copy: "速答看中文选英文，听力听读音选句子，翻译看英文选中文。"
            },
            {
                icon: "2",
                title: "PK竞技",
                copy: "限时10秒对战机器人，速度越快得分越高，连胜有段位分加成。"
            },
            {
                icon: "3",
                title: "体力与赛季",
                copy: "每局消耗1体力，60秒回复1把，上限30把。连胜3局×2，5局×3。"
            }
        ]
    },
    play: {
        tabName: "消息",
        icon: "💬",
        title: "每日推送",
        heading: "每天自动推送一组新表达，打开就能看。",
        copy: "进入应用后自动生成今日推送，也可以手动生成新推送。",
        steps: [{
                icon: "1",
                title: "自动推送",
                copy: "填写密码后，每天进入会自动生成一组今日推荐表达。"
            },
            {
                icon: "2",
                title: "存图与存仓库",
                copy: "推送卡片可以存图保存到相册，也可以一键存入仓库。"
            },
            {
                icon: "3",
                title: "新推送",
                copy: "点新推送按钮可以随机生成一组新的学习内容。"
            }
        ]
    },
    profile: {
        tabName: "我的",
        icon: "👤",
        title: "个人中心",
        heading: "查看成就、管理收藏、调整设置。",
        copy: "等级、段位、勋章、收藏本都在这里。",
        steps: [{
                icon: "1",
                title: "收藏本",
                copy: "点击收藏本查看所有收藏句子，可逐句移除。"
            },
            {
                icon: "2",
                title: "字号调整",
                copy: "拖动字号滑块放大内容区域，适合不同视力需求。"
            },
            {
                icon: "3",
                title: "勋章成就",
                copy: "学习、收藏、竞技达到一定量后解锁对应勋章等级。"
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
    reviewAnswered: false,
    reviewMode: null,
    _dailyPushGenerating: false,
    _newPushGenerating: false,
    _showFavorites: false,
    _favoritesPage: 0
};

// ===== Gamification System =====
const LEVELS = [
    { name: "新手妈妈", xp: 0 },
    { name: "学习新星", xp: 50 },
    { name: "口语达人", xp: 150 },
    { name: "英语勇者", xp: 300 },
    { name: "亲子大师", xp: 500 },
    { name: "语言冠军", xp: 800 },
    { name: "传奇妈妈", xp: 1200 }
];
const XP_REWARDS = { generate: 10, save: 5, reviewCorrect: 8, reviewWrong: 2, streak: 3 };
const gamifyState = loadGamifyState();

function loadGamifyState() {
    const saved = storageGet(STORAGE_KEYS.gamify, null);
    const defaults = { xp: 0, streak: 0, lastActiveDate: null, totalReviews: 0, totalCorrect: 0 };
    if (!saved) return defaults;
    return { ...defaults, ...saved };
}
function saveGamifyState() { storageSet(STORAGE_KEYS.gamify, gamifyState); }
function addXP(amount) {
    gamifyState.xp += amount;
    saveGamifyState();
    updateGamifyUI();
    showXPFloat(amount);
}
function updateStreak() {
    const today = new Date().toDateString();
    if (gamifyState.lastActiveDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (gamifyState.lastActiveDate === yesterday) {
        gamifyState.streak += 1;
        addXP(XP_REWARDS.streak * gamifyState.streak);
    } else if (gamifyState.lastActiveDate !== today) {
        gamifyState.streak = 1;
    }
    gamifyState.lastActiveDate = today;
    saveGamifyState();
    updateGamifyUI();
}
function getCurrentLevel() {
    let level = LEVELS[0];
    for (const l of LEVELS) { if (gamifyState.xp >= l.xp) level = l; else break; }
    return level;
}
function getNextLevel() {
    const idx = LEVELS.indexOf(getCurrentLevel());
    return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}
function getLevelProgress() {
    const current = getCurrentLevel();
    const next = getNextLevel();
    if (!next) return 100;
    return Math.min(100, Math.round(((gamifyState.xp - current.xp) / (next.xp - current.xp)) * 100));
}
function updateGamifyUI() {
    const xpEl = document.getElementById("xpValue");
    const streakEl = document.getElementById("streakValue");
    const levelFill = document.getElementById("levelFill");
    const levelText = document.getElementById("levelText");
    if (xpEl) xpEl.textContent = gamifyState.xp;
    if (streakEl) streakEl.textContent = gamifyState.streak;
    if (levelFill) levelFill.style.width = getLevelProgress() + "%";
    const lvl = getCurrentLevel();
    const lvlIdx = LEVELS.indexOf(lvl) + 1;
    if (levelText) levelText.textContent = "Lv." + lvlIdx + " " + lvl.name;
}
function showXPFloat(amount) {
    const el = document.createElement("div");
    el.className = "xp-float";
    el.textContent = "+" + amount + " XP";
    el.style.cssText = "left:50%;top:80px;transform:translateX(-50%)";
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1300);
    const badge = document.getElementById("xpBadge");
    if (badge) { badge.classList.add("pulse"); setTimeout(function() { badge.classList.remove("pulse"); }, 600); }
}
function fireConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ["#7c3aed", "#2dd4bf", "#f472b6", "#fbbf24", "#60a5fa"];
    for (let i = 0; i < 60; i++) {
        particles.push({ x: canvas.width/2 + (Math.random()-0.5)*200, y: canvas.height/2, vx: (Math.random()-0.5)*12, vy: -Math.random()*14-4, size: Math.random()*8+4, color: colors[Math.floor(Math.random()*colors.length)], rotation: Math.random()*360, rotSpeed: (Math.random()-0.5)*10 });
    }
    let frame = 0;
    (function animate() {
        if (frame > 80) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.rotation += p.rotSpeed; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation*Math.PI/180); ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6); ctx.restore(); }
        frame++;
        requestAnimationFrame(animate);
    })();
}
function toggleTheme() {
    const isLight = document.documentElement.classList.toggle("theme-light");
    localStorage.setItem("mom_english_theme", isLight ? "light" : "dark");
    const icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = isLight ? "☀️" : "🌙";
}
(function initTheme() {
    if (localStorage.getItem("mom_english_theme") === "light") {
        document.documentElement.classList.add("theme-light");
        var icon = document.getElementById("themeIcon");
        if (icon) icon.textContent = "☀️";
    }
})();

function getFontScale() {
    var v = parseFloat(localStorage.getItem("mom_english_font_scale"));
    return (v >= 1 && v <= 1.3) ? v : 1;
}
function applyFontScale(scale) {
    document.documentElement.style.setProperty("--font-scale", scale);
}
function setFontScale(scale) {
    localStorage.setItem("mom_english_font_scale", scale);
    applyFontScale(scale);
}
applyFontScale(getFontScale());

// ===== Badge / Achievement System (Tiered) =====
const BADGE_CATEGORIES = [
    {
        id: "save", name: "收藏", icon: "📦",
        tiers: [
            { level: 1, name: "初学收藏", req: 1, desc: "保存1组" },
            { level: 2, name: "收藏家", req: 3, desc: "保存3组" },
            { level: 3, name: "仓库达人", req: 10, desc: "保存10组" },
            { level: 4, name: "知识宝库", req: 25, desc: "保存25组" },
            { level: 5, name: "收藏大师", req: 50, desc: "保存50组" }
        ],
        getValue: function(g, a, s) { return s; }
    },
    {
        id: "streak", name: "连续", icon: "🔥",
        tiers: [
            { level: 1, name: "初次坚持", req: 2, desc: "连续2天" },
            { level: 2, name: "三连击", req: 3, desc: "连续3天" },
            { level: 3, name: "周冠军", req: 7, desc: "连续7天" },
            { level: 4, name: "半月达人", req: 15, desc: "连续15天" },
            { level: 5, name: "月度传奇", req: 30, desc: "连续30天" }
        ],
        getValue: function(g) { return g.streak; }
    },
    {
        id: "xp", name: "经验", icon: "⚡",
        tiers: [
            { level: 1, name: "起步", req: 20, desc: "累计20 XP" },
            { level: 2, name: "百分学者", req: 100, desc: "累计100 XP" },
            { level: 3, name: "学霸", req: 300, desc: "累计300 XP" },
            { level: 4, name: "知识精英", req: 600, desc: "累计600 XP" },
            { level: 5, name: "学神", req: 1200, desc: "累计1200 XP" }
        ],
        getValue: function(g) { return g.xp; }
    },
    {
        id: "arena", name: "竞技", icon: "⚔️",
        tiers: [
            { level: 1, name: "初胜", req: 1, desc: "赢1场" },
            { level: 2, name: "竞技新秀", req: 5, desc: "赢5场" },
            { level: 3, name: "竞技老手", req: 15, desc: "赢15场" },
            { level: 4, name: "竞技高手", req: 30, desc: "赢30场" },
            { level: 5, name: "竞技王者", req: 50, desc: "赢50场" }
        ],
        getValue: function(g, a) { return a.wins; }
    },
    {
        id: "rank", name: "段位", icon: "🏆",
        tiers: [
            { level: 1, name: "白银之路", req: 100, desc: "达到100分" },
            { level: 2, name: "黄金选手", req: 300, desc: "达到300分" },
            { level: 3, name: "铂金精英", req: 600, desc: "达到600分" },
            { level: 4, name: "钻石之路", req: 1000, desc: "达到1000分" },
            { level: 5, name: "王者荣耀", req: 1500, desc: "达到1500分" }
        ],
        getValue: function(g, a) { return a.score; }
    },
    {
        id: "gen", name: "生成", icon: "✨",
        tiers: [
            { level: 1, name: "初次生成", req: 10, desc: "获得10 XP" },
            { level: 2, name: "探索者", req: 50, desc: "获得50 XP" },
            { level: 3, name: "创造者", req: 150, desc: "获得150 XP" },
            { level: 4, name: "灵感大师", req: 400, desc: "获得400 XP" },
            { level: 5, name: "亲子大师", req: 800, desc: "获得800 XP" }
        ],
        getValue: function(g) { return g.xp; }
    }
];

function getBadgeTier(cat) {
    var savedCount = (loadSavedLessons() || []).length;
    var val = cat.getValue(gamifyState, arenaState, savedCount);
    var reached = 0;
    for (var i = 0; i < cat.tiers.length; i++) {
        if (val >= cat.tiers[i].req) reached = i + 1;
    }
    return reached;
}

function renderBadgeWall() {
    var savedCount = (loadSavedLessons() || []).length;
    var totalTiers = 0, unlockedTiers = 0;
    var html = BADGE_CATEGORIES.map(function(cat) {
        var tier = getBadgeTier(cat);
        totalTiers += cat.tiers.length;
        unlockedTiers += tier;
        var currentName = tier > 0 ? cat.tiers[tier - 1].name : "未解锁";
        var tierDots = cat.tiers.map(function(t, i) {
            return '<span class="tier-dot ' + (i < tier ? "filled" : "") + '"></span>';
        }).join("");
        return '<div class="badge-item ' + (tier > 0 ? "unlocked" : "locked") + '" data-action="open-badge-detail" data-badge="' + cat.id + '">' +
            '<span class="badge-icon">' + (tier > 0 ? cat.icon : "🔒") + '</span>' +
            '<span class="badge-name">' + (tier > 0 ? currentName : cat.name) + '</span>' +
            '<div class="badge-tiers">' + tierDots + '</div>' +
        '</div>';
    }).join("");
    return '<div class="badge-wall"><div class="badge-wall-title">🏆 成就徽章 <span class="badge-count">' + unlockedTiers + '/' + totalTiers + '</span></div><div class="badge-grid">' + html + '</div></div>';
}

function openBadgeDetail(badgeId) {
    var cat = BADGE_CATEGORIES.find(function(c) { return c.id === badgeId; });
    if (!cat) return;
    var tier = getBadgeTier(cat);
    var savedCount = (loadSavedLessons() || []).length;
    var currentVal = cat.getValue(gamifyState, arenaState, savedCount);
    var tiersHtml = cat.tiers.map(function(t, i) {
        var reached = i < tier;
        return '<div class="bd-tier ' + (reached ? "reached" : "pending") + '">' +
            '<span class="bd-tier-level">Lv.' + t.level + '</span>' +
            '<span class="bd-tier-name">' + t.name + '</span>' +
            '<span class="bd-tier-desc">' + t.desc + '</span>' +
            '<span class="bd-tier-status">' + (reached ? "✓" : (currentVal + "/" + t.req)) + '</span>' +
        '</div>';
    }).join("");
    var overlay = document.createElement("div");
    overlay.className = "badge-detail-overlay";
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = '<div class="badge-detail-card">' +
        '<div class="bd-header"><span class="bd-icon">' + cat.icon + '</span><span class="bd-cat-name">' + cat.name + '</span><span class="bd-current">当前 Lv.' + tier + '</span></div>' +
        '<div class="bd-tiers">' + tiersHtml + '</div>' +
        '<button class="btn btn-primary" onclick="this.closest(\'.badge-detail-overlay\').remove()">关闭</button>' +
    '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add("show"); }, 30);
}


// ===== Rank Promotion Animation =====
function checkRankPromotion(oldScore, newScore) {
    var oldRank = null, newRank = null;
    for (var i = 0; i < ARENA_RANKS.length; i++) {
        if (oldScore >= ARENA_RANKS[i].minScore) oldRank = ARENA_RANKS[i];
        if (newScore >= ARENA_RANKS[i].minScore) newRank = ARENA_RANKS[i];
    }
    if (newRank && oldRank && ARENA_RANKS.indexOf(newRank) > ARENA_RANKS.indexOf(oldRank)) {
        showRankPromotion(newRank);
    }
}

function showRankPromotion(rank) {
    var overlay = document.createElement("div");
    overlay.className = "rank-promo-overlay";
    overlay.innerHTML = '<div class="rank-promo-card">' +
        '<div class="rank-promo-icon">' + rank.icon + '</div>' +
        '<div class="rank-promo-title">段位晋级!</div>' +
        '<div class="rank-promo-name">' + rank.name + '</div>' +
        '<button class="btn btn-primary" onclick="this.closest(\'.rank-promo-overlay\').remove()">继续</button>' +
    '</div>';
    document.body.appendChild(overlay);
    fireConfetti();
    setTimeout(function() { overlay.classList.add("show"); }, 50);
}


// ===== Daily Card Push Flow =====
function renderPlayAsPush() {
    var now = new Date();
    var timeStr = APP_CONFIG.pushTimeDisplay || "08:00";
    var msgs = APP_CONFIG.pushMessages || [];
    var html = '<div class="push-flow"><div class="push-date">' + escapeHtml(formatDate(now)) + '</div>';

    // Render static notices
    var shownNotices = storageGet("mom_english_shown_notices", []);
    msgs.forEach(function(msg) {
        if (msg.type === "daily") return;
        if (msg.showOnce && shownNotices.indexOf(msg.id) >= 0) return;
        html += '<div class="push-msg bot-msg"><div class="push-avatar">' + msg.avatar + '</div><div class="push-bubble bot"><strong>' + escapeHtml(msg.title) + '</strong><p>' + escapeHtml(msg.content) + '</p></div><span class="push-time">' + timeStr + '</span></div>';
        if (msg.showOnce) { shownNotices.push(msg.id); storageSet("mom_english_shown_notices", shownNotices); }
    });

    // Render daily lesson push (from topicNouns, cached in localStorage)
    var dailyTopic = getDailyTopicNoun();
    var dailyCache = loadDailyPushCache();
    var todayKey = getDailyPushKey();

    if (dailyCache && dailyCache.key === todayKey && dailyCache.lesson) {
        // Already generated today, show cached
        var lesson = dailyCache.lesson;
        appState._pushLesson = lesson;
        var cardData = buildMemoryCardData(lesson, lesson.expressions || []);
        var exprsHtml = cardData.expressions.slice(0, 6).map(function(expr) {
            return '<div class="push-expr"><span class="push-expr-en">' + escapeHtml(expr.english) + '</span><span class="push-expr-zh">' + escapeHtml(expr.chinese) + '</span></div>';
        }).join("");
        html += '<div class="push-msg system-msg"><div class="push-bubble system">每日学习推送 ✨ <span class="push-time-inline">' + timeStr + '</span></div></div>';
        html += '<div class="push-msg bot-msg"><div class="push-avatar">🤖</div><div class="push-bubble bot">' +
            '<div class="push-card" id="memoryCardCapture"><div class="push-card-head" id="memoryCard">' +
            '<span class="push-card-badge">DAILY</span><span class="push-card-topic">' + escapeHtml(cardData.topic) + '</span><span class="push-card-word">' + escapeHtml(cardData.coreWord) + '</span></div>' +
            '<div class="push-card-body">' + exprsHtml + '</div>' +
            '<div class="push-card-actions"><button class="btn btn-primary btn-sm" type="button" data-action="speak-memory-card">🔊 听</button><button class="btn btn-ghost btn-sm" type="button" data-action="open-memory-card-image">📷 存图</button><button class="btn btn-ghost btn-sm" type="button" data-action="save-push-lesson">📦 存仓库</button><button class="btn btn-primary btn-sm push-new-btn" type="button" data-action="new-push">✨ 新推送</button></div>' +
            '</div></div></div>';
    } else if (appState._dailyPushGenerating) {
        html += '<div class="push-msg system-msg"><div class="push-bubble system">每日学习推送 ✨ <span class="push-time-inline">' + timeStr + '</span></div></div>';
        html += '<div class="push-msg bot-msg" id="dailyPushSlot"><div class="push-avatar">🤖</div><div class="push-bubble bot">今日主题：<strong>' + escapeHtml(dailyTopic) + '</strong><br><div class="pulse-dot"></div> 正在生成今日推送...</div></div>';
    } else {
        html += '<div class="push-msg system-msg"><div class="push-bubble system">每日学习推送 ✨ <span class="push-time-inline">' + timeStr + '</span></div></div>';
        html += '<div class="push-msg bot-msg" id="dailyPushSlot"><div class="push-avatar">🤖</div><div class="push-bubble bot push-new-btn-wrap">今日推荐词：<strong>' + escapeHtml(dailyTopic) + '</strong><br>填写密码后可自动生成每日推送。<br><button class="btn btn-primary btn-sm push-new-btn" type="button" data-action="new-push" style="margin-top:8px">✨ 手动生成</button></div></div>';
    }

    html += '</div>';
    elements.playContainer.innerHTML = html;
}

function getDailyPushKey() {
    var today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function loadDailyPushCache() {
    return storageGet("mom_english_daily_push", null);
}

function saveDailyPushCache(key, lesson) {
    storageSet("mom_english_daily_push", { key: key, lesson: lesson, savedAt: new Date().toISOString() });
}

async function generateDailyPush(topic, todayKey) {
    if (appState._dailyPushGenerating) return;
    appState._dailyPushGenerating = true;
    if (appState.activeTab === "play") renderPlayAsPush();
    try {
        var config = loadConfig();
        if (!config.apiKey) {
            appState._dailyPushGenerating = false;
            if (appState.activeTab === "play") renderPlayAsPush();
            return;
        }
        var lesson = await generateLesson(topic, "compact");
        var normalized = normalizeLesson(lesson, topic);
        saveDailyPushCache(todayKey, normalized);
    } catch (error) {
        console.error("Daily push generation failed:", error);
    } finally {
        appState._dailyPushGenerating = false;
        if (appState.activeTab === "play") renderPlayAsPush();
    }
}


// 基于天时间戳的确定性随机选取
function getDailyTopicNoun() {
    var allWords = getAllTopicNouns();
    if (!allWords.length) return "water";
    var today = new Date();
    var dayStamp = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    var seed = hashCode(APP_CONFIG.dailySeed + "topic" + String(dayStamp));
    return allWords[Math.abs(seed) % allWords.length];
}

function getRandomTopicNoun() {
    var allWords = getAllTopicNouns();
    if (!allWords.length) return "fruit";
    return allWords[Math.floor(Math.random() * allWords.length)];
}

function getAllTopicNouns() {
    if (typeof topicNouns === "undefined" || !topicNouns.scenarios) return [];
    var all = [];
    Object.keys(topicNouns.scenarios).forEach(function(key) {
        var arr = topicNouns.scenarios[key];
        if (Array.isArray(arr)) all = all.concat(arr);
    });
    return all;
}

function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return hash;
}

// "新推送" - 调用 LLM 生成随机学习内容并追加到消息流
async function handleNewPush(button) {
    if (!appState.config.apiKey) {
        showToast("先在设置里填写密码才能生成。", "error");
        return;
    }
    if (appState._newPushGenerating) {
        showToast("正在生成中，请稍等。", "info");
        return;
    }
    appState._newPushGenerating = true;
    setButtonBusy(button, true, "生成中...");

    // 追加一条"发送中"的用户消息
    var flow = document.querySelector(".push-flow");
    if (flow) {
        var sendingMsg = document.createElement("div");
        sendingMsg.className = "push-msg user-msg";
        sendingMsg.innerHTML = '<div class="push-bubble user">帮我随机推送一组新的学习内容 ✨</div>';
        flow.appendChild(sendingMsg);

        var loadingMsg = document.createElement("div");
        loadingMsg.className = "push-msg bot-msg";
        loadingMsg.id = "pushLoading";
        loadingMsg.innerHTML = '<div class="push-avatar">🤖</div><div class="push-bubble bot"><div class="pulse-dot"></div> 正在生成...</div>';
        flow.appendChild(loadingMsg);
    }

    try {
        var topic = getRandomTopicNoun();
        var profile = GENERATION_PROFILES.compact;
        var lesson = await generateLesson(topic, "compact");
        var normalized = normalizeLesson(lesson, topic);

        // Store as push lesson for save action
        appState._pushLesson = normalized;

        // Remove loading, render result
        var loadEl = document.getElementById("pushLoading");
        if (loadEl) loadEl.remove();

        var cardData = buildMemoryCardData(normalized, normalized.expressions || []);
        var exprsHtml = cardData.expressions.slice(0, 6).map(function(expr) {
            return '<div class="push-expr"><span class="push-expr-en">' + escapeHtml(expr.english) + '</span><span class="push-expr-zh">' + escapeHtml(expr.chinese) + '</span></div>';
        }).join("");

        var resultMsg = document.createElement("div");
        resultMsg.className = "push-msg bot-msg";
        resultMsg.innerHTML = '<div class="push-avatar">🤖</div><div class="push-bubble bot">' +
            '<div class="push-card"><div class="push-card-head">' +
            '<span class="push-card-badge">NEW</span><span class="push-card-topic">' + escapeHtml(cardData.topic) + '</span><span class="push-card-word">' + escapeHtml(cardData.coreWord) + '</span></div>' +
            '<div class="push-card-body">' + exprsHtml + '</div>' +
            '<div class="push-card-actions"><button class="btn btn-primary btn-sm" type="button" data-action="speak-memory-card">🔊 听</button><button class="btn btn-ghost btn-sm" type="button" data-action="save-push-lesson">📦 存仓库</button></div>' +
            '</div></div>';

        if (flow) flow.appendChild(resultMsg);
        addXP(XP_REWARDS.generate);
    } catch (error) {
        var loadEl2 = document.getElementById("pushLoading");
        if (loadEl2) loadEl2.innerHTML = '<div class="push-avatar">🤖</div><div class="push-bubble bot">生成失败了：' + escapeHtml(friendlyError(error)) + '</div>';
        showToast("生成失败，可以再试。", "error");
    } finally {
        appState._newPushGenerating = false;
        setButtonBusy(button, false, "✨ 新推送");
    }
}

// 保存当前推送的 lesson 到仓库
function savePushLessonToWarehouse() {
    var dailyCache = loadDailyPushCache();
    var lesson = appState._pushLesson || (dailyCache && dailyCache.lesson) || null;
    if (!lesson) {
        showToast("没有可保存的内容。", "error");
        return;
    }
    // Check if already saved
    if (SavedLessonRepo.findByRef(lesson.key || lesson.id)) {
        showToast("这组已经在仓库里了。", "info");
        return;
    }
    var savedLesson = Object.assign({}, lesson, {
        id: createId(),
        key: lesson.key || createId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storageVersion: STORAGE_VERSION
    });
    var list = loadSavedLessons();
    list.unshift(savedLesson);
    StorageRepo.lessons.save(list);
    renderBook();
    refreshReviewPanel();
    addXP(XP_REWARDS.save);
    showToast("已保存到仓库。", "success");
}

// ===== Immersive Mode =====
function enterImmersive() {
    document.querySelector(".app-header").classList.add("immersive-hidden");
    document.querySelector(".level-bar-wrap").classList.add("immersive-hidden");
    document.querySelector(".bottom-nav").classList.add("immersive-hidden");
    document.querySelector(".review-launch").classList.add("immersive-hidden");
}
function exitImmersive() {
    document.querySelectorAll(".immersive-hidden").forEach(function(el) { el.classList.remove("immersive-hidden"); });
}

function quitArena() {
    var st = appState._arenaRound;
    clearTimeout(appState._arenaRobotTimer);
    clearInterval(appState._arenaTimerInterval);
    if (st && st.mc) {
        var penalty = -Math.round(st.mc.scoreBase * 1.5);
        arenaState.score = Math.max(0, arenaState.score + penalty);
        arenaState.losses++;
        arenaState.streak = 0;
        saveArenaState();
        showToast("退出竞技，扣除 " + Math.abs(penalty) + " 段位分。", "error");
    }
    appState._arenaRound = null;
    exitImmersive();
    renderArena();
}

// ===== PK Arena System =====
const ARENA_RANKS = [
    { name: "青铜", icon: "🥉", minScore: 0, robotTimeMin: 7, robotTimeMax: 8, winRate: 0.40 },
    { name: "白银", icon: "🥈", minScore: 100, robotTimeMin: 6, robotTimeMax: 7, winRate: 0.50 },
    { name: "黄金", icon: "🥇", minScore: 300, robotTimeMin: 5, robotTimeMax: 6, winRate: 0.60 },
    { name: "铂金", icon: "💎", minScore: 600, robotTimeMin: 4, robotTimeMax: 5, winRate: 0.72 },
    { name: "钻石", icon: "👑", minScore: 1000, robotTimeMin: 3, robotTimeMax: 4, winRate: 0.85 },
    { name: "王者", icon: "🏆", minScore: 1500, robotTimeMin: 2, robotTimeMax: 3, winRate: 1.0 }
];
const ARENA_MODES = [
    { id: "speed", name: "速答", icon: "⚡", desc: "看中文选英文", scoreBase: 12 },
    { id: "listen", name: "听力", icon: "🎧", desc: "听读音选句子", scoreBase: 15 },
    { id: "translate", name: "翻译", icon: "📝", desc: "看英文选中文", scoreBase: 10 }
];
const ROBOT_NAMES = ["Amy", "Max", "Luna", "Leo", "Mia", "Kai", "Zoe", "Rex"];
const ARENA_ROUND_TIMEOUT = 10;
const ARENA_SCORE_MAX = 200;
const ARENA_SCORE_MIN = 10;
const ARENA_STAMINA_MAX = 30;
const ARENA_STAMINA_REGEN_MS = 60000;
const arenaState = loadArenaState();

function trueRandom() {
    return ((Date.now() * 9301 + 49297) % 233280) / 233280 * 0.5 + Math.random() * 0.5;
}

function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(trueRandom() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

function loadArenaState() {
    var saved = storageGet("mom_english_arena", null);
    var defaults = { score: 0, wins: 0, losses: 0, totalMatches: 0, streak: 0, stamina: ARENA_STAMINA_MAX, lastStaminaTime: Date.now() };
    if (!saved) return defaults;
    return Object.assign({}, defaults, saved);
}
function saveArenaState() { storageSet("mom_english_arena", arenaState); }

function regenStamina() {
    var now = Date.now();
    var elapsed = now - (arenaState.lastStaminaTime || now);
    var regen = Math.floor(elapsed / ARENA_STAMINA_REGEN_MS);
    if (regen > 0) {
        arenaState.stamina = Math.min(ARENA_STAMINA_MAX, (arenaState.stamina || 0) + regen);
        arenaState.lastStaminaTime = now;
        saveArenaState();
    }
}

function getArenaRank() {
    var rank = ARENA_RANKS[0];
    for (var i = 0; i < ARENA_RANKS.length; i++) { if (arenaState.score >= ARENA_RANKS[i].minScore) rank = ARENA_RANKS[i]; else break; }
    return rank;
}
function getNextRank() {
    var idx = ARENA_RANKS.indexOf(getArenaRank());
    return idx < ARENA_RANKS.length - 1 ? ARENA_RANKS[idx + 1] : null;
}
function generateRobot() {
    var name = ROBOT_NAMES[Math.floor(trueRandom() * ROBOT_NAMES.length)];
    var rankIdx = ARENA_RANKS.indexOf(getArenaRank());
    var matchIdx = rankIdx;
    if (arenaState.streak >= 3 && rankIdx < ARENA_RANKS.length - 1) matchIdx = rankIdx + 1;
    var lo = Math.max(0, matchIdx - 1);
    var hi = Math.min(ARENA_RANKS.length - 1, matchIdx + 1);
    var possible = ARENA_RANKS.slice(lo, hi + 1);
    var rRank = possible[Math.floor(trueRandom() * possible.length)];
    return { name: name, rank: rRank };
}

function calcRoundScore(elapsedSec) {
    if (elapsedSec >= ARENA_ROUND_TIMEOUT) return 0;
    var t = Math.max(0, Math.min(elapsedSec, ARENA_ROUND_TIMEOUT));
    return Math.round(ARENA_SCORE_MAX - (ARENA_SCORE_MAX - ARENA_SCORE_MIN) * (t / ARENA_ROUND_TIMEOUT));
}

function getStreakMultiplier() {
    if (arenaState.streak >= 5) return 3;
    if (arenaState.streak >= 3) return 2;
    return 1;
}

function renderArena() {
    regenStamina();
    var rank = getArenaRank();
    var next = getNextRank();
    var pct = next ? Math.round(((arenaState.score - rank.minScore) / (next.minScore - rank.minScore)) * 100) : 100;
    var rankDisplay = rank.name;
    if (!next && arenaState.score >= rank.minScore) {
        var starsAbove = Math.floor((arenaState.score - rank.minScore) / 200);
        if (starsAbove > 0) rankDisplay += " " + "★".repeat(Math.min(starsAbove, 10));
    }
    var streakMult = getStreakMultiplier();
    var streakHtml = arenaState.streak >= 2 ? '<div class="ar-streak">🔥 ' + arenaState.streak + '连胜' + (streakMult > 1 ? ' ×' + streakMult : '') + '</div>' : '';
    var staminaHtml = '<div class="ar-stamina">⚡ 体力 ' + arenaState.stamina + '/' + ARENA_STAMINA_MAX + '</div>';
    var modesHtml = ARENA_MODES.map(function(m) {
        return '<button class="arena-mode-btn" type="button" data-action="arena-match" data-mode="' + m.id + '"><span class="am-icon">' + m.icon + '</span><span class="am-name">' + m.name + '</span><span class="am-desc">' + m.desc + '</span><span class="am-score">' + m.desc + '</span></button>';
    }).join("");
    var bulletinHtml =
        '<div class="arena-bulletin">' +
            '<div class="ab-title">📢 S1 赛季公告</div>' +
            '<div class="ab-body">' +
                '<p>⏱ 限时10秒作答，速度越快得分越高(200→10分)</p>' +
                '<p>🔥 连胜3局段位分×2，连胜5局段位分×3</p>' +
                '<p>🤖 连胜状态将匹配更高段位机器人</p>' +
                '<p>⚡ 体力上限' + ARENA_STAMINA_MAX + '把，每60秒回复1把</p>' +
                '<p>📋 赛后展示对战详情，方便复习</p>' +
            '</div>' +
        '</div>';
    elements.reviewContainer.innerHTML =
        '<div class="arena-shell">' +
        bulletinHtml +
        '<div class="arena-rank-card"><div class="ar-icon">' + rank.icon + '</div><div class="ar-info"><div class="ar-name">' + rankDisplay + ' ' + arenaState.score + '分</div><div class="ar-bar"><div class="ar-fill" style="width:' + pct + '%"></div></div><div class="ar-next">' + (next ? '距' + next.name + '还需' + (next.minScore - arenaState.score) + '分' : '最高段位 · 无限星级') + '</div>' + streakHtml + staminaHtml + '</div><div class="ar-stats">' + arenaState.wins + '胜' + arenaState.losses + '负</div></div>' +
        '<div class="arena-modes">' + modesHtml + '</div></div>';
}

function startArenaMatch(mode) {
    regenStamina();
    if (arenaState.stamina <= 0) {
        showToast("体力不足，请等待恢复（每60秒回复1把）。", "error");
        return;
    }
    var mc = ARENA_MODES.find(function(m) { return m.id === mode; }) || ARENA_MODES[0];
    var robot = generateRobot();
    var exprs = loadExpressions();
    if (exprs.length < 4) { showToast("仓库至少需要4句表达才能竞技。", "error"); return; }
    arenaState.stamina = Math.max(0, arenaState.stamina - 1);
    saveArenaState();
    enterImmersive();
    elements.reviewContainer.innerHTML = '<div class="arena-matching"><div class="matching-spinner"></div><div class="matching-text">正在匹配对手...</div><div class="matching-mode">' + mc.icon + ' ' + mc.name + '</div></div>';
    var delay = 1500 + trueRandom() * 2000;
    setTimeout(function() {
        elements.reviewContainer.innerHTML = '<div class="arena-matched"><div class="matched-vs"><div class="matched-player"><div class="matched-avatar">🧑</div><div class="matched-name">你</div><div class="matched-rank">' + getArenaRank().icon + '</div></div><div class="matched-vs-text">VS</div><div class="matched-player"><div class="matched-avatar">🤖</div><div class="matched-name">' + robot.name + '</div><div class="matched-rank">' + robot.rank.icon + '</div></div></div><div class="matched-countdown" id="arenaCountdown">3</div></div>';
        var count = 3;
        var ci = setInterval(function() {
            count--;
            var el = document.getElementById("arenaCountdown");
            if (el) el.textContent = count > 0 ? count : "GO!";
            if (count <= 0) { clearInterval(ci); setTimeout(function() { runArenaRound(mc, robot, exprs, 0, 0, 0, []); }, 500); }
        }, 800);
    }, delay);
}

function runArenaRound(mc, robot, allExprs, round, myScore, robotScore, roundLog) {
    if (round >= 5) { finishArenaMatch(mc, robot, myScore, robotScore, roundLog); return; }
    var items = shuffleArray(allExprs).slice(0, 4);
    var correct = items[0];
    var opts = shuffleArray(items);
    var question, optHtml;
    if (mc.id === "translate") {
        question = correct.english;
        optHtml = opts.map(function(o) { return '<button class="arena-option" type="button" data-action="arena-answer" data-answer="' + encodeData(o.chinese) + '" data-correct="' + encodeData(correct.chinese) + '">' + escapeHtml(o.chinese) + '</button>'; }).join("");
    } else {
        question = correct.chinese;
        optHtml = opts.map(function(o) { return '<button class="arena-option" type="button" data-action="arena-answer" data-answer="' + encodeData(o.english) + '" data-correct="' + encodeData(correct.english) + '">' + escapeHtml(o.english) + '</button>'; }).join("");
    }
    var rRank = robot.rank;
    var robotTimeBase = rRank.robotTimeMin + trueRandom() * (rRank.robotTimeMax - rRank.robotTimeMin);
    if (mc.id === "listen") robotTimeBase += 1;
    var robotCorrect = trueRandom() < rRank.winRate;
    var robotTimePts = robotCorrect ? calcRoundScore(robotTimeBase) : 0;
    appState._arenaRound = { mc: mc, robot: robot, allExprs: allExprs, round: round, myScore: myScore, robotScore: robotScore, robotCorrect: robotCorrect, robotTimePts: robotTimePts, robotAnswered: false, answered: false, startTime: Date.now(), roundLog: roundLog, correctExpr: correct };
    elements.reviewContainer.innerHTML =
        '<div class="arena-round"><div class="arena-round-hdr"><span>第' + (round+1) + '/5题</span><span class="arena-timer" id="arenaTimer">⏱ ' + ARENA_ROUND_TIMEOUT + 's</span><span class="arena-live-score">🧑' + myScore + ' : ' + robotScore + '🤖</span><button class="arena-quit-btn" type="button" data-action="arena-quit">退出</button></div>' +
        '<div class="arena-question">' + escapeHtml(question) + '</div><div class="arena-options">' + optHtml + '</div>' +
        '<div class="arena-robot-status" id="arenaRobotStatus">🤖 ' + robot.name + ' 思考中...</div></div>';

    var timerStart = Date.now();
    appState._arenaTimerInterval = setInterval(function() {
        var st = appState._arenaRound;
        if (!st) { clearInterval(appState._arenaTimerInterval); return; }
        var elapsed = (Date.now() - timerStart) / 1000;
        var remain = Math.max(0, ARENA_ROUND_TIMEOUT - elapsed);
        var timerEl = document.getElementById("arenaTimer");
        if (timerEl) {
            timerEl.textContent = "⏱ " + Math.ceil(remain) + "s";
            if (remain <= 3) timerEl.classList.add("danger");
        }
        if (remain <= 0 && !st.answered) {
            st.answered = true;
            st.userCorrect = false;
            st.userTimePts = 0;
            elements.reviewContainer.querySelectorAll(".arena-option").forEach(function(btn) {
                btn.disabled = true;
                var correctAns = decodeData(btn.dataset.correct);
                if (decodeData(btn.dataset.answer) === correctAns) btn.classList.add("correct");
            });
            showToast("超时了！", "error");
            clearInterval(appState._arenaTimerInterval);
            if (st.robotAnswered) {
                setTimeout(function() { advanceArenaRound(); }, 1000);
            }
        }
    }, 200);

    appState._arenaRobotTimer = setTimeout(function() {
        var st = appState._arenaRound;
        if (!st) return;
        st.robotAnswered = true;
        var s = document.getElementById("arenaRobotStatus");
        if (s) { s.textContent = "🤖 " + robot.name + (robotCorrect ? " 答对了!" : " 答错了"); s.className = "arena-robot-status " + (robotCorrect ? "correct" : "wrong"); }
        if (st.answered) {
            setTimeout(function() { advanceArenaRound(); }, 1000);
        }
    }, robotTimeBase * 1000);
}

function handleArenaAnswer(button) {
    var st = appState._arenaRound;
    if (!st || st.answered) return;
    st.answered = true;
    var elapsed = (Date.now() - st.startTime) / 1000;
    var selected = decodeData(button.dataset.answer);
    var correctAns = decodeData(button.dataset.correct);
    var isCorrect = selected === correctAns;
    st.userCorrect = isCorrect;
    st.userTimePts = isCorrect ? calcRoundScore(elapsed) : 0;
    clearInterval(appState._arenaTimerInterval);
    elements.reviewContainer.querySelectorAll(".arena-option").forEach(function(btn) {
        btn.disabled = true;
        if (decodeData(btn.dataset.answer) === correctAns) btn.classList.add("correct");
        else if (btn === button && !isCorrect) btn.classList.add("wrong");
    });
    if (isCorrect) addXP(Math.round(st.mc.scoreBase * 0.5));
    if (st.robotAnswered) {
        setTimeout(function() { advanceArenaRound(); }, 1000);
    }
}

function advanceArenaRound() {
    var st = appState._arenaRound;
    if (!st) return;
    clearTimeout(appState._arenaRobotTimer);
    clearInterval(appState._arenaTimerInterval);
    var myPts = st.userTimePts || 0;
    var robotPts = st.robotTimePts || 0;
    var log = (st.roundLog || []).slice();
    log.push({
        question: st.mc.id === "translate" ? st.correctExpr.english : st.correctExpr.chinese,
        answer: st.mc.id === "translate" ? st.correctExpr.chinese : st.correctExpr.english,
        userCorrect: !!st.userCorrect,
        userPts: myPts,
        robotCorrect: !!st.robotCorrect,
        robotPts: robotPts
    });
    appState._arenaRound = null;
    runArenaRound(st.mc, st.robot, st.allExprs, st.round + 1, st.myScore + myPts, st.robotScore + robotPts, log);
}

function finishArenaMatch(mc, robot, myScore, robotScore, roundLog) {
    exitImmersive();
    var won = myScore > robotScore;
    var draw = myScore === robotScore;
    var baseDelta = won ? mc.scoreBase * 2 : (draw ? mc.scoreBase : -Math.round(mc.scoreBase * 0.5));
    if (won) {
        arenaState.streak = (arenaState.streak || 0) + 1;
    } else {
        arenaState.streak = 0;
    }
    var mult = won ? getStreakMultiplier() : 1;
    var delta = baseDelta * mult;
    var oldArenaScore = arenaState.score;
    arenaState.score = Math.max(0, arenaState.score + delta);
    checkRankPromotion(oldArenaScore, arenaState.score);
    arenaState.totalMatches++;
    if (won) arenaState.wins++; else if (!draw) arenaState.losses++;
    saveArenaState();
    updateGamifyUI();
    if (won) { addXP(mc.scoreBase * 3); fireConfetti(); }
    var rank = getArenaRank();

    var logHtml = '<div class="arena-log"><div class="al-title">📋 对战详情</div>';
    (roundLog || []).forEach(function(r, i) {
        logHtml += '<div class="al-row">' +
            '<span class="al-num">' + (i+1) + '</span>' +
            '<span class="al-q">' + escapeHtml(r.question) + '</span>' +
            '<span class="al-a">' + escapeHtml(r.answer) + '</span>' +
            '<span class="al-result ' + (r.userCorrect ? 'correct' : 'wrong') + '">' + (r.userCorrect ? '✓' + r.userPts : '✗') + '</span>' +
        '</div>';
    });
    logHtml += '</div>';

    var streakInfo = arenaState.streak >= 2 ? '<div class="arena-result-streak">🔥 ' + arenaState.streak + '连胜' + (mult > 1 ? '（段位分×' + mult + '）' : '') + '</div>' : '';
    var staminaInfo = '<div class="arena-result-stamina">⚡ 体力 ' + arenaState.stamina + '/' + ARENA_STAMINA_MAX + '</div>';

    elements.reviewContainer.innerHTML =
        '<div class="arena-result">' +
            '<div class="arena-result-title">' + (won ? "🎉 胜利!" : (draw ? "🤝 平局" : "😤 惜败")) + '</div>' +
            '<div class="arena-result-score">🧑 ' + myScore + ' : ' + robotScore + ' 🤖 ' + robot.name + '</div>' +
            '<div class="arena-result-delta">' + (delta >= 0 ? "+" : "") + delta + ' 段位分</div>' +
            streakInfo +
            '<div class="arena-result-rank">' + rank.icon + ' ' + rank.name + ' ' + arenaState.score + '分</div>' +
            staminaInfo +
            logHtml +
            '<div class="arena-result-actions"><button class="btn btn-primary" type="button" data-action="arena-again" data-mode="' + mc.id + '">再来一局</button><button class="btn btn-ghost" type="button" data-action="arena-back">返回</button></div>' +
        '</div>';
}




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
    if (appState.currentLesson) collapseLearnInput();
    renderBook();
    refreshReviewPanel();
    renderPlay();
    updateUsageGuideButton();
    migrateSavedWarehouseData();
    updateGamifyUI();
    updateStreak();
    updateGamifyUI();
    updateStreak();

    // Background auto-generate daily push on startup
    var dailyCache = loadDailyPushCache();
    var todayKey = getDailyPushKey();
    if (!dailyCache || dailyCache.key !== todayKey || !dailyCache.lesson) {
        var dailyTopic = getDailyTopicNoun();
        generateDailyPush(dailyTopic, todayKey);
    }

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

    document.addEventListener("input", event => {
        if (event.target.id === "fontScaleSlider") {
            var v = Number(event.target.value) / 100;
            setFontScale(v);
            var label = document.getElementById("fontScaleValue");
            if (label) label.textContent = Math.round(v * 100) + "%";
        }
    });

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
        message: "页面切到后台，已停止仓库循环播放。需要后台听请点「后台听仓库」。",
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
    "toggle-theme": () => toggleTheme(),
    "toggle-learn-input": () => toggleLearnInput(),
    "fill-topic": (trigger) => fillTopic(decodeData(trigger.dataset.topic)),
    "learn-card-prev": () => { appState._learnCardIndex = (appState._learnCardIndex || 0) - 1; renderCurrentLesson(); },
    "learn-card-next": () => { appState._learnCardIndex = (appState._learnCardIndex || 0) + 1; renderCurrentLesson(); },
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
    "remove-favorite": (trigger) => trigger.dataset.id && removeFavorite(decodeData(trigger.dataset.id)),
    "speak": (trigger) => speak(decodeData(trigger.dataset.text), Number(trigger.dataset.rate || 1), trigger),
    "record-score": (trigger) => startRecordAndScore(decodeData(trigger.dataset.text), trigger),
    "speak-memory-card": (trigger) => speakCurrentMemoryCard(trigger),
    "start-review": (trigger) => startReview(trigger.dataset.mode || "speed"),
    "review-lesson": (trigger) => startLessonReview(trigger.dataset.id, trigger.dataset.mode || "speed"),
    "answer-review": (trigger) => answerReview(trigger),
    "next-review": () => nextReviewQuestion(),
    "exit-review": () => confirmExitReview(),
    "confirm-exit-review": () => executeExitReview(),
    "arena-match": (trigger) => startArenaMatch(trigger.dataset.mode),
    "arena-answer": (trigger) => handleArenaAnswer(trigger),
    "arena-again": (trigger) => startArenaMatch(trigger.dataset.mode),
    "arena-back": () => refreshReviewPanel(),
    "arena-quit": () => quitArena(),
    "new-push": (trigger) => handleNewPush(trigger),
    "save-push-lesson": () => savePushLessonToWarehouse(),
    "open-badge-detail": (trigger) => openBadgeDetail(trigger.dataset.badge),
    "open-sentence-detail": (trigger) => openSentenceDetail(trigger),
    "close-sentence-detail": () => closeSheet("sentence"),
    "open-memory-card-image": (trigger) => openMemoryCardPreview(trigger),
    "open-lesson-image": (trigger) => openLessonImagePreview(trigger.dataset.id, trigger),
    "open-favorites": () => { appState._showFavorites = true; appState._favoritesPage = 0; renderProfile(); },
    "close-favorites": () => { appState._showFavorites = false; renderProfile(); },
    "fav-prev": () => { appState._favoritesPage = Math.max(0, (appState._favoritesPage || 0) - 1); renderFavoritesPage(); },
    "fav-next": () => { appState._favoritesPage = (appState._favoritesPage || 0) + 1; renderFavoritesPage(); },
    "open-lesson-recorder": (trigger) => openLessonRecorder(trigger.dataset.id),
    "exit-lesson-recorder": () => closeLessonRecorder(),
    "lesson-record-toggle": (trigger) => toggleLessonRecording(decodeData(trigger.dataset.text), trigger),
    "fav-remove-confirm": (trigger) => handleFavRemoveConfirm(trigger),
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
              class="chip${featuredClass}"
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

function toggleLearnInput() {
    const wrap = document.getElementById("learnInputWrap");
    if (!wrap) return;
    wrap.classList.toggle("collapsed");
    const arrow = document.getElementById("learnInputArrow");
    if (arrow) arrow.textContent = wrap.classList.contains("collapsed") ? "▸" : "▾";
}

function collapseLearnInput() {
    const wrap = document.getElementById("learnInputWrap");
    if (!wrap || wrap.classList.contains("collapsed")) return;
    wrap.classList.add("collapsed");
    const arrow = document.getElementById("learnInputArrow");
    if (arrow) arrow.textContent = "▸";
}

// 处理 handleGenerate 函数。
async function handleGenerate(mode = "compact") {
    if (appState.loading) return;

    const generationMode = normalizeGenerationMode(mode);
    const profile = getGenerationProfile(generationMode);
    const userInput = elements.topicInput.value.trim();
    if (!userInput) {
        showToast("先输入一个生活场景，比如「洗澡」或「哄睡」。", "error");
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
        appState._learnCardIndex = 0;
        if (!cachedLesson) {
            saveCachedLesson(cacheKey, appState.currentLesson);
        }
        saveCurrentLesson(appState.currentLesson);
        renderCurrentLesson();
        collapseLearnInput();
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
        if (!cachedLesson) { addXP(XP_REWARDS.generate); fireConfetti(); }
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

    const systemPrompt = `你是一个"亲子英语表达扩展编辑"。你的任务不是重新生成一套表达，而是在已有5句基础上继续扩展5句。

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

请继续生成"追加版亲子英语表达包"。

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
        elements.lessonContainer.innerHTML = '<div class="empty-card"><strong>输入一个场景开始学习。</strong></div>';
        elements.learnCoreWord.classList.add("hidden");
        elements.learnCoreWord.innerHTML = "";
        return;
    }

    const lesson = appState.currentLesson;
    if (appState._learnCardIndex === undefined) appState._learnCardIndex = 0;
    appState._learnCardIndex = clamp(appState._learnCardIndex, 0, lesson.expressions.length - 1);
    const idx = appState._learnCardIndex;
    const expr = lesson.expressions[idx];
    const favorited = isExpressionFavorited(expr, lesson.topic);
    const allFavorited = countLessonFavorites(lesson) === lesson.expressions.length;

    var coreEn = lesson.core_word?.english || "";
    var coreCn = lesson.core_word?.chinese || "";
    if (coreEn) {
        elements.learnCoreWord.classList.remove("hidden");
        elements.learnCoreWord.innerHTML = '<span class="lcw-topic">' + escapeHtml(lesson.topic || "") + '</span>' +
            '<span class="lcw-word">' + escapeHtml(coreEn) + '</span>' +
            (coreCn ? '<span class="lcw-zh">' + escapeHtml(coreCn) + '</span>' : '');
    } else {
        elements.learnCoreWord.classList.add("hidden");
        elements.learnCoreWord.innerHTML = "";
    }

    elements.lessonContainer.innerHTML = `
        <div class="learn-card-view">
          <div class="learn-card-single">
            <div class="lcs-top">
              <span class="lcs-idx">${idx + 1} / ${lesson.expressions.length}</span>
              <button class="speak-toggle" type="button" data-action="speak" data-text="${encodeData(expr.english)}" data-rate="0.72">🔊</button>
              <button class="speak-toggle record-btn" type="button" data-action="record-score" data-text="${encodeData(expr.english)}">🎤</button>
              <button class="star-toggle${favorited ? ' is-active' : ''}" type="button" data-action="toggle-favorite" data-index="${idx}">
                <span class="star-glyph">${favorited ? '★' : '☆'}</span>
              </button>
            </div>
            <div class="lcs-english">${escapeHtml(expr.english)}</div>
            <div class="lcs-chinese">${escapeHtml(expr.chinese)}</div>
            <div class="lcs-scene">${escapeHtml(expr.scene)}</div>
            ${expr.note ? '<div class="lcs-note">' + escapeHtml(expr.note) + '</div>' : ''}
            <div class="learn-card-nav">
              <button class="wh-nav-btn" type="button" data-action="learn-card-prev"${idx <= 0 ? ' disabled' : ''}>‹ 上一句</button>
              <span class="wh-nav-pos">${idx + 1} / ${lesson.expressions.length}</span>
              <button class="wh-nav-btn" type="button" data-action="learn-card-next"${idx >= lesson.expressions.length - 1 ? ' disabled' : ''}>下一句 ›</button>
            </div>
            <div class="learn-card-actions">
              <button class="btn btn-primary btn-sm" type="button" data-action="save-lesson">📦 保存仓库</button>
              <button class="btn btn-ghost btn-sm" type="button" data-action="favorite-all"${allFavorited ? ' disabled' : ''}>${allFavorited ? '已全部收藏' : '一键收藏'}</button>
              ${lesson.expressions.length === 5 ? '<button class="btn btn-ghost btn-sm" type="button" data-action="append-current-lesson">+5句</button>' : ''}
            </div>
          </div>
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
        <article class="expression-card${activeClass}" data-expression-index="${index}">
          <div class="expression-top">
            <span class="serial-chip">${String(index + 1).padStart(2, "0")}</span>
            <div class="expression-top-actions">
              <button class="speak-toggle" type="button" aria-label="播放" data-action="speak" data-text="${encodeData(expression.english)}" data-rate="0.72">🔊</button>
              <button class="star-toggle${starClass}" type="button" aria-label="${favorited ? "取消收藏" : "收藏这句"}" aria-pressed="${favorited ? "true" : "false"}" data-action="toggle-favorite" data-index="${index}">
                <span class="star-glyph">${favorited ? "★" : "☆"}</span>
              </button>
            </div>
          </div>
          <div class="expression-english">${escapeHtml(expression.english)}</div>
          <div class="expression-chinese">${escapeHtml(expression.chinese)}</div>
          <div class="meta-box">
            <span class="meta-label">场景</span>
            <div class="meta-text">${escapeHtml(expression.scene)}</div>
          </div>
          ${expression.note ? `<div class="meta-box"><span class="meta-label">提示</span><div class="meta-text">${escapeHtml(expression.note)}</div></div>` : ""}
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
    elements.learnSnapshot.classList.add("hidden");
    elements.learnSnapshot.innerHTML = "";
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

    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    showToast("已保存到仓库，正在把读音也存好。", "success");
    addXP(XP_REWARDS.save);

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

                const expressions = loadExpressions();
                let expressionChanged = false;
                upgraded.forEach(lesson => {
                    expressionChanged = addLessonExpressionsToList(expressions, lesson) > 0 || expressionChanged;
                });

                if (expressionChanged) {
                    saveExpressions(expressions);
                    refreshReviewPanel();
                }
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
        elements.bookContainer.innerHTML = '<div class="empty-card"><strong>' + (list.length ? '没有匹配的主题。' : '仓库还是空的。') + '</strong><p>' + (list.length ? '换个关键词试试。' : '先保存一组表达到仓库。') + '</p></div>';
        return;
    }
    appState.warehouseIndex = clamp(appState.warehouseIndex, 0, filtered.length - 1);
    var current = filtered[appState.warehouseIndex];
    var playbarHtml = renderWarehousePlaybar(filtered);
    elements.bookContainer.innerHTML = playbarHtml +
        renderWarehouseCard(current) +
        '<div class="wh-nav-bar">' +
            '<button class="wh-nav-btn" type="button" data-action="warehouse-prev"' + (filtered.length <= 1 ? ' disabled' : '') + '>‹ 上一组</button>' +
            '<span class="wh-nav-pos">' + (appState.warehouseIndex + 1) + ' / ' + filtered.length + '</span>' +
            '<button class="wh-nav-btn" type="button" data-action="warehouse-next"' + (filtered.length <= 1 ? ' disabled' : '') + '>下一组 ›</button>' +
        '</div>';
}

// 处理 renderWarehousePlaybar 函数。
function renderWarehousePlaybar(list) {
    const sentenceCount = getWarehouseEnglishTexts(list).length;
    const isPlaying = appState.warehouseLoopPlaying;
    if (!sentenceCount) return "";
    return '<div class="wh-playbar">' +
      '<button class="wh-playbar-btn ' + (isPlaying ? 'active' : '') + '" type="button" data-action="toggle-warehouse-loop" data-mode="foreground">' + (isPlaying ? '⏸ 停止' : '▶ 循环听 ' + sentenceCount + ' 句') + '</button>' +
      '<button class="wh-playbar-mode" type="button" data-action="toggle-warehouse-loop" data-mode="background">' + (appState.warehousePlaybackMode === "background" && isPlaying ? '🔇 停止后台' : '🎧 后台听') + '</button>' +
      '</div>';
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
    var canAppend = expressions.length === 5;
    var appendBtn = canAppend ? '<button class="wh-action-btn" type="button" data-action="append-saved-lesson" data-id="' + escapeHtml(lessonId) + '" title="+5句">➕</button>' : '';
    return '<article class="wh-card">' +
      '<div class="wh-card-head">' +
        '<div class="wh-card-title">' + escapeHtml(lesson.topic || "亲子英语") + '</div>' +
        '<span class="wh-card-count">' + expressions.length + ' 句</span>' +
      '</div>' +
      '<div class="wh-card-lines">' +
        expressions.map(function(expr, i) {
          var exprData = encodeData(JSON.stringify({
            english: expr.english,
            chinese: expr.chinese,
            scene: expr.scene || "",
            note: expr.note || "",
            topic: lesson.topic || ""
          }));
          return '<div class="wh-line" data-action="open-sentence-detail" data-expr="' + exprData + '">' +
            '<span class="wh-line-idx">' + (i + 1) + '</span>' +
            '<div class="wh-line-text"><span class="wh-line-en">' + escapeHtml(expr.english) + '</span><span class="wh-line-zh">' + escapeHtml(expr.chinese) + '</span></div>' +
            '<button class="wh-line-speak" type="button" data-action="speak" data-text="' + encodeData(expr.english) + '" data-rate="0.72">🔊</button>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="wh-card-foot">' +
        '<button class="wh-action-btn ' + (isLessonLooping ? 'active' : '') + '" type="button" data-action="loop-lesson" data-id="' + escapeHtml(lessonId) + '" title="循环听">' + (isLessonLooping ? "⏸" : "▶") + '</button>' +
        '<button class="wh-action-btn" type="button" data-action="open-lesson-recorder" data-id="' + escapeHtml(lessonId) + '" title="口语评测">🎤</button>' +
        appendBtn +
        '<button class="wh-action-btn" type="button" data-action="open-lesson-image" data-id="' + escapeHtml(lessonId) + '" title="保存图">📷</button>' +
        '<button class="wh-action-btn" type="button" data-action="review-lesson" data-id="' + escapeHtml(lessonId) + '" title="复习">🎯</button>' +
        '<button class="wh-action-btn danger" type="button" data-action="request-delete-lesson" data-id="' + escapeHtml(lessonId) + '" title="删除">🗑</button>' +
      '</div>' +
    '</article>';
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

    return `你现在是"妈妈亲子英语"的一对一陪练老师。请根据下面这组仓库句子，带我做中译英训练。

训练主题：${lesson.topic || "亲子日常"}
当前场景核心词：${coreWord}

可考察表达：
${expressions}

请严格按这些规则陪练：
1. 所有学习都拆成小任务，一次只给我一题，不要一次性把所有答案都列出来。
2. 每题用"中译英"形式出题，先给中文，让我回复英文；等我回答后再判断。
3. 如果我答对，先鼓励，再给一个更自然的表达小提醒。
4. 如果我答错，不要打击我。先肯定尝试，再给正确表达，拆开解释关键词，说明这句话适合在什么亲子场景里说。
5. 每一题讲完后，额外给我 1 个当前场景可用的小词或短语，并马上进入下一个小任务。
6. 语气要温柔、直接、像陪妈妈练开口；不要像考试，也不要讲太长。

请先从第 1 个小任务开始，只出一道题，等我回答。`;
}

// 处理 moveWarehouseCard 函数。
function moveWarehouseCard(delta) {
    const filtered = getFilteredSavedLessons();
    if (filtered.length <= 1) return;
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
    setButtonBusy(button, true, isCompactAudioButton(button) ? "…" : playingLabel);

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
              data-id="${encodeData(item.key)}"
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
            <button class="btn btn-ghost" type="button" data-action="remove-favorite" data-id="${encodeData(item.key)}">移出收藏</button>
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
    const next = list.filter(item => item.key !== id && item.id !== id);
    saveExpressions(next);
    renderBook();
    refreshReviewPanel();
    renderPlay();
    renderLearnSnapshot();
    syncLessonFavoriteIndicators();
    if (appState._showFavorites) renderFavoritesPage();
    else renderProfile();
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
            elements.reviewContainer.innerHTML = '<div class="empty-card"><strong>还没有题目。</strong><p>先保存一组表达到仓库。</p></div>';
        }
        return;
    }

    if (!appState.reviewItems.length) {
        renderArena();
    }
}

// 处理 refreshReviewLaunchState 函数。
function refreshReviewLaunchState() {
    const total = loadExpressions().length;
    var btns = document.querySelectorAll(".review-mode-btn");
    btns.forEach(function(btn) { btn.disabled = !total; });
}

const REVIEW_MODES = {
    speed:     { id: "speed",     name: "速答", icon: "⚡", questionFn: function(item) { return '"' + escapeHtml(item.chinese) + '" 用英语怎么说？'; }, answerKey: "english", optionKey: "english", hint: "先凭感觉选，再点击听正确答案。" },
    listen:    { id: "listen",    name: "听力", icon: "🎧", questionFn: function(item) { return '听读音，选出对应的句子。'; }, answerKey: "english", optionKey: "english", hint: "点击上方播放，听后选择。", autoSpeak: true },
    translate: { id: "translate", name: "翻译", icon: "📝", questionFn: function(item) { return '"' + escapeHtml(item.english) + '" 是什么意思？'; }, answerKey: "chinese", optionKey: "chinese", hint: "看英文选中文，锻炼理解力。" }
};

// 处理 startReview 函数。
function startReview(mode) {
    const list = loadExpressions();
    if (!list.length) {
        refreshReviewPanel();
        return;
    }
    var rm = REVIEW_MODES[mode] || REVIEW_MODES.speed;
    enterImmersive();
    appState.reviewItems = pickReviewItems(list, Math.min(5, list.length));
    appState.reviewIndex = 0;
    appState.reviewAnswered = false;
    appState.reviewMode = rm;
    renderReviewQuestion();
}

// 处理 startLessonReview 函数。
function startLessonReview(id, mode) {
    const lesson = SavedLessonRepo.findByRef(id);
    if (!lesson) {
        showToast("没有找到这组保存内容。", "error");
        return;
    }

    const items = (lesson.expressions || []).map(function(expr) {
        return buildSavedExpression(lesson.topic, expr);
    });

    if (!items.length) {
        showToast("这一组还没有可复习的句子。", "error");
        return;
    }

    stopWarehousePlayback({
        render: false
    });
    var rm = REVIEW_MODES[mode] || REVIEW_MODES.speed;
    appState.reviewItems = pickReviewItems(items, Math.min(5, items.length));
    appState.reviewIndex = 0;
    appState.reviewAnswered = false;
    appState.reviewMode = rm;
    switchTab("review", {
        keepScroll: false
    });
    elements.reviewLaunchTitle.textContent = `正在复习：${lesson.topic || "这一组"}`;
    elements.reviewLaunchCopy.textContent = "这轮只抽当前仓库卡片里的句子，答对答错都会记录。";
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
        exitImmersive();
        renderArena();
        renderBook();
        return;
    }

    var rm = appState.reviewMode || REVIEW_MODES.speed;
    const options = buildReviewOptions(item, loadExpressions(), rm);
    var questionHtml = rm.questionFn(item);
    var listenBtn = rm.autoSpeak ? '<button class="btn btn-ghost review-listen-btn" type="button" data-action="speak" data-text="' + encodeData(item.english) + '" data-rate="0.72">🔊 播放题目</button>' : '';

    elements.reviewContainer.innerHTML = `
        <article class="review-card">
          <div class="review-card-hdr">
            <span class="review-progress">${rm.icon} ${rm.name} · 第 ${appState.reviewIndex + 1} / ${appState.reviewItems.length} 题</span>
          </div>
          <div class="review-question">${questionHtml}</div>
          ${listenBtn}
          <p class="review-support">${rm.hint}</p>

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
            <button class="btn btn-ghost" type="button" data-action="exit-review">🚪 退出</button>
            <button class="btn btn-secondary" type="button" data-action="speak" data-text="${encodeData(item.english)}" data-rate="0.72">🔊 听正确答案</button>
            <button class="btn btn-primary" type="button" data-action="next-review" disabled>下一题</button>
          </div>
        </article>
      `;

    if (rm.autoSpeak) {
        setTimeout(function() { speak(item.english, 0.72); }, 400);
    }
}

// 处理 buildReviewOptions 函数。
function buildReviewOptions(correctItem, all, rm) {
    var key = rm.optionKey || "english";
    var correctAnswer = correctItem[key];
    const wrongs = all
        .filter(item => item.id !== correctItem.id && item[key] !== correctAnswer)
        .map(item => item[key])
        .filter(Boolean)
        .sort(() => trueRandom() - 0.5)
        .slice(0, 2);

    var fallback;
    if (key === "chinese") {
        fallback = ["做得好！", "我们来玩。", "该睡觉了。", "看看这个。"]
            .filter(text => text !== correctAnswer && !wrongs.includes(text));
    } else {
        fallback = REVIEW_FALLBACK_OPTIONS
            .filter(text => text !== correctAnswer && !wrongs.includes(text));
    }

    while (wrongs.length < 2 && fallback.length) {
        wrongs.push(fallback.shift());
    }

    return [correctAnswer, ...wrongs].sort(() => trueRandom() - 0.5);
}

// 处理 answerReview 函数。
function answerReview(button) {
    if (appState.reviewAnswered) return;

    const item = appState.reviewItems[appState.reviewIndex];
    if (!item) return;

    var rm = appState.reviewMode || REVIEW_MODES.speed;
    var answerKey = rm.answerKey || "english";
    var correctAnswer = item[answerKey];

    const selected = decodeData(button.dataset.answer);
    const isCorrect = selected === correctAnswer;
    appState.reviewAnswered = true;

    const optionButtons = Array.from(elements.reviewContainer.querySelectorAll(".choice-btn"));
    optionButtons.forEach(optionButton => {
        optionButton.classList.add("locked");
        const answer = decodeData(optionButton.dataset.answer);
        if (answer === correctAnswer) {
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
            `没关系，正确答案是：${correctAnswer}`;
    }

    const nextBtn = elements.reviewContainer.querySelector("[data-action='next-review']");
    if (nextBtn) {
        nextBtn.disabled = false;
    }

    updateReviewStats(item.id, isCorrect);
    renderBook();
    addXP(isCorrect ? XP_REWARDS.reviewCorrect : XP_REWARDS.reviewWrong);
    if (isCorrect) fireConfetti();
    if (navigator.vibrate) {
        navigator.vibrate(isCorrect ? 24 : [14, 40, 14]);
    }
}

function confirmExitReview() {
    openSheet("delete", () => {
        elements.deleteConfirmTitle.textContent = "退出练习？";
        document.getElementById("deleteConfirmCopy").textContent = "练习退出不扣分，当前进度不会保存。";
        document.querySelector("[data-action='confirm-delete-lesson']").textContent = "确认退出";
        document.querySelector("[data-action='confirm-delete-lesson']").dataset.action = "confirm-exit-review";
        document.querySelector("[data-action='close-delete-confirm']").textContent = "继续练习";
    });
}

function executeExitReview() {
    closeSheet("delete");
    appState.reviewItems = [];
    appState.reviewIndex = 0;
    appState.reviewAnswered = false;
    exitImmersive();
    refreshReviewPanel();
    showToast("已退出练习。", "info");
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
function renderPlay() { return renderPlayAsPush(); }
function renderPlayOld() {
    const lesson = getDailyMemoryLesson(loadSavedLessons());
    if (!lesson) {
        elements.playContainer.innerHTML = '<div class="empty-card"><strong>还没有每日卡片。</strong><p>先保存一组表达到仓库，这里会每天随机抽一组。</p></div>';
        return;
    }
    const cardData = buildMemoryCardData(lesson, lesson.expressions || []);
    const activity = lesson.kid_activity || buildLocalActivity(cardData.expressions);
    const exprsHtml = cardData.expressions.slice(0, 6).map(function(expr, i) {
        return '<div class="mpc-line"><span class="mpc-idx">' + (i+1) + '</span><div class="mpc-text"><div class="mpc-en">' + escapeHtml(expr.english) + '</div><div class="mpc-zh">' + escapeHtml(expr.chinese) + '</div></div></div>';
    }).join("");
    const stepsHtml = (activity.steps || []).map(function(step, i) {
        return '<div class="activity-step-item"><span class="step-num">' + (i+1) + '</span><span class="step-text">' + escapeHtml(step) + '</span></div>';
    }).join("");
    elements.playContainer.innerHTML =
        '<div class="memory-layout">' +
          '<div class="memory-card-capture" id="memoryCardCapture">' +
            '<div class="memory-poster-card" id="memoryCard">' +
              '<div class="mpc-head"><span class="mpc-date">' + escapeHtml(formatDate(new Date())) + '</span><span class="mpc-badge">DAILY</span></div>' +
              '<div class="mpc-topic">' + escapeHtml(cardData.topic) + '</div>' +
              '<div class="mpc-word">' + escapeHtml(cardData.coreWord) + '</div>' +
              '<div class="mpc-lines">' + exprsHtml + '</div>' +
              '<div class="mpc-footer">' + escapeHtml(cardData.footer) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="memory-actions">' +
            '<button class="btn btn-primary" type="button" data-action="open-memory-card-image">📷 保存图片</button>' +
            '<button class="btn btn-secondary" type="button" data-action="speak-memory-card">🔊 听卡片</button>' +
          '</div>' +
          '<div class="memory-activity">' +
            '<div class="section-kicker"><span>📎</span><span>互动建议</span></div>' +
            '<h3>' + escapeHtml(activity.title) + '</h3>' +
            '<div class="activity-steps">' + stepsHtml + '</div>' +
          '</div>' +
        '</div>';
}


// ===== Profile Page =====
function renderProfile() {
    if (appState._showFavorites) { renderFavoritesPage(); return; }
    var rank = getArenaRank();
    var nextRank = getNextRank();
    var lvl = getCurrentLevel();
    var lvlIdx = LEVELS.indexOf(lvl) + 1;
    var savedCount = (loadSavedLessons() || []).length;
    var exprCount = (loadExpressions() || []).length;

    elements.profileContainer.innerHTML =
        '<div class="profile-shell">' +
            '<div class="profile-header">' +
                '<div class="profile-avatar">👤</div>' +
                '<div class="profile-info">' +
                    '<div class="profile-level">Lv.' + lvlIdx + ' ' + lvl.name + '</div>' +
                    '<div class="profile-xp">⚡ ' + gamifyState.xp + ' XP</div>' +
                '</div>' +
            '</div>' +
            '<div class="profile-stats">' +
                '<div class="profile-stat"><span class="ps-value">🔥 ' + gamifyState.streak + '</span><span class="ps-label">连续天数</span></div>' +
                '<div class="profile-stat"><span class="ps-value">' + rank.icon + ' ' + rank.name + '</span><span class="ps-label">竞技段位</span></div>' +
                '<div class="profile-stat"><span class="ps-value">' + arenaState.wins + '胜' + arenaState.losses + '负</span><span class="ps-label">竞技战绩</span></div>' +
                '<div class="profile-stat"><span class="ps-value">' + savedCount + '组</span><span class="ps-label">仓库</span></div>' +
                '<div class="profile-stat clickable" data-action="open-favorites"><span class="ps-value">' + exprCount + '句</span><span class="ps-label">收藏 ›</span></div>' +
                '<div class="profile-stat"><span class="ps-value">' + arenaState.score + '</span><span class="ps-label">段位分</span></div>' +
            '</div>' +
            '<div class="profile-setting">' +
                '<span class="profile-setting-label">字号大小</span>' +
                '<input class="profile-setting-slider" type="range" min="100" max="130" step="5" value="' + (getFontScale() * 100) + '" data-action="font-scale-change" id="fontScaleSlider" />' +
                '<span class="profile-setting-value" id="fontScaleValue">' + Math.round(getFontScale() * 100) + '%</span>' +
            '</div>' +
            renderBadgeWall() +
            '<div class="profile-actions">' +
                '<button class="btn btn-ghost" type="button" data-action="open-settings">🔑 密码设置</button>' +
                '<button class="btn btn-ghost" type="button" data-action="open-github">GitHub</button>' +
                '<button class="btn btn-ghost" type="button" data-action="open-guide">使用帮助</button>' +
            '</div>' +
        '</div>';
}

var _favPendingDeleteBtn = null;

function clearFavDeleteConfirm() {
    if (_favPendingDeleteBtn) {
        _favPendingDeleteBtn.classList.remove('confirm');
        _favPendingDeleteBtn = null;
    }
}

function handleFavRemoveConfirm(btn) {
    if (!btn || !btn.dataset.id) return;
    if (_favPendingDeleteBtn === btn) {
        clearFavDeleteConfirm();
        removeFavorite(decodeData(btn.dataset.id));
        return;
    }
    clearFavDeleteConfirm();
    btn.classList.add('confirm');
    _favPendingDeleteBtn = btn;
}

document.addEventListener('click', function(e) {
    if (!_favPendingDeleteBtn) return;
    if (!e.target.closest('[data-action="fav-remove-confirm"]')) {
        clearFavDeleteConfirm();
    }
}, true);

function renderFavoritesPage() {
    var list = loadExpressions();
    var pageSize = 5;
    var page = appState._favoritesPage || 0;
    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.max(0, Math.min(page, totalPages - 1));
    appState._favoritesPage = page;
    var slice = list.slice(page * pageSize, (page + 1) * pageSize);

    var linesHtml = '';
    if (!slice.length) {
        linesHtml = '<div class="empty-card"><strong>还没有收藏。</strong><p>在探索页生成表达后，点星标收藏。</p></div>';
    } else {
        linesHtml = '<div class="fav-list">' + slice.map(function(item, i) {
            var globalIdx = page * pageSize + i + 1;
            return '<div class="fav-item">' +
                '<span class="fav-idx">' + globalIdx + '</span>' +
                '<div class="fav-text">' +
                    '<div class="fav-en">' + escapeHtml(item.english) + '</div>' +
                    '<div class="fav-zh">' + escapeHtml(item.chinese) + '</div>' +
                    '<div class="fav-meta">' + escapeHtml(item.topic || '') + (item.reviewCount ? ' · 复习' + item.reviewCount + '次' : '') + '</div>' +
                '</div>' +
                '<div class="fav-actions">' +
                    '<button class="wh-line-speak" type="button" data-action="speak" data-text="' + encodeData(item.english) + '" data-rate="0.72">🔊</button>' +
                    '<button class="fav-remove-btn" type="button" data-action="fav-remove-confirm" data-id="' + encodeData(item.key) + '">✕</button>' +
                '</div>' +
            '</div>';
        }).join('') + '</div>';
    }

    var navHtml = totalPages > 1 ?
        '<div class="fav-nav">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="fav-prev"' + (page <= 0 ? ' disabled' : '') + '>‹ 上一页</button>' +
            '<span class="fav-nav-pos">' + (page + 1) + ' / ' + totalPages + '</span>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="fav-next"' + (page >= totalPages - 1 ? ' disabled' : '') + '>下一页 ›</button>' +
        '</div>' : '';

    elements.profileContainer.innerHTML =
        '<div class="profile-shell">' +
            '<div class="fav-header">' +
                '<button class="btn btn-ghost btn-sm" type="button" data-action="close-favorites">← 返回</button>' +
                '<span class="fav-title">收藏本 · ' + list.length + '句</span>' +
            '</div>' +
            linesHtml +
            navHtml +
        '</div>';
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

    if (tab === "profile") {
        renderProfile();
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
    showToast(`已填入"${topic}"。`, "info");
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

function openSentenceDetail(trigger) {
    var raw = decodeData(trigger.dataset.expr || "");
    var expr;
    try { expr = JSON.parse(raw); } catch(e) { return; }
    if (!expr || !expr.english) return;

    openSheet("sentence", function() {
        elements.sentenceSheetTitle.textContent = "句子详情";
        elements.sentenceDetailContent.innerHTML =
            '<div class="sd-english">' + escapeHtml(expr.english) + '</div>' +
            '<div class="sd-chinese">' + escapeHtml(expr.chinese) + '</div>' +
            (expr.scene ? '<div class="sd-field"><span class="sd-label">场景</span><span class="sd-value">' + escapeHtml(expr.scene) + '</span></div>' : '') +
            (expr.note ? '<div class="sd-field"><span class="sd-label">提示</span><span class="sd-value">' + escapeHtml(expr.note) + '</span></div>' : '') +
            (expr.topic ? '<div class="sd-field"><span class="sd-label">主题</span><span class="sd-value">' + escapeHtml(expr.topic) + '</span></div>' : '') +
            '<div class="sd-actions">' +
                '<button class="btn btn-secondary" type="button" data-action="speak" data-text="' + encodeData(expr.english) + '" data-rate="0.72">🔊 慢速</button>' +
                '<button class="btn btn-secondary" type="button" data-action="speak" data-text="' + encodeData(expr.english) + '" data-rate="1">🔊 正常</button>' +
            '</div>';
    });
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
    if (!elements.usageGuideBtn) return;
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

// ===== Speech Score (录音评分) =====
var RECORD_COOLDOWN = 1000;
var _lastRecordClick = 0;

function encodeWav(samples, sampleRate) {
    var len = samples.length;
    var buf = new ArrayBuffer(44 + len * 2);
    var view = new DataView(buf);
    function wr(o, s) { for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); }
    wr(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); wr(8, 'WAVE');
    wr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); wr(36, 'data'); view.setUint32(40, len * 2, true);
    for (var i = 0; i < len; i++) {
        var s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
}

async function recordAudioBlob(maxSeconds) {
    maxSeconds = maxSeconds || 15;
    var stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    var source = audioCtx.createMediaStreamSource(stream);
    var processor = audioCtx.createScriptProcessor(4096, 1, 1);
    var chunks = [];
    processor.onaudioprocess = function(e) { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    source.connect(processor);
    processor.connect(audioCtx.destination);

    return {
        stop: function() {
            processor.disconnect();
            source.disconnect();
            stream.getTracks().forEach(function(t) { t.stop(); });
            audioCtx.close();
            var totalLen = chunks.reduce(function(a, c) { return a + c.length; }, 0);
            var merged = new Float32Array(totalLen);
            var off = 0;
            chunks.forEach(function(c) { merged.set(c, off); off += c.length; });
            return encodeWav(merged, 16000);
        },
        maxTimer: null,
        _stream: stream
    };
}

async function submitSpeechScore(wavBlob, text) {
    var fd = new FormData();
    fd.append('audio', wavBlob, 'recording.wav');
    fd.append('text', text);
    fd.append('lang', 'en');
    var resp = await fetch(SPEECH_SCORE_URL, { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('评分服务响应异常: ' + resp.status);
    var json = await resp.json();
    if (!json.success) throw new Error(json.message || '评分失败');
    return json.data;
}

function scoreGrade(score) {
    if (score >= 90) return { label: 'S', color: '#FFD700', comment: '发音非常棒！' };
    if (score >= 80) return { label: 'A', color: '#4CAF50', comment: '很不错，继续保持！' };
    if (score >= 70) return { label: 'B', color: '#2196F3', comment: '有进步，再多练练。' };
    if (score >= 60) return { label: 'C', color: '#FF9800', comment: '基础不错，注意发音。' };
    return { label: 'D', color: '#f44336', comment: '多听多读，慢慢来。' };
}

function calcSingleScore(data) {
    return Math.round((data.pronunciation || 0) * 0.35 + (data.fluency || 0) * 0.25 + (data.integrity || 0) * 0.20 + (data.overall || 0) * 0.20);
}

function calcLessonScore(data) {
    return Math.round((data.pronunciation || 0) * 0.6 + (data.integrity || 0) * 0.4);
}

function buildScoreBar(label, value, isSpeed) {
    var v = Math.round((value || 0) * 10) / 10;
    var pct = isSpeed ? Math.min(100, v / 2) : Math.min(100, v);
    var cls = isSpeed ? '' : (v >= 80 ? ' sr-bar-good' : v >= 60 ? ' sr-bar-ok' : ' sr-bar-low');
    return '<div class="sr-bar-row">' +
        '<span class="sr-bar-label">' + label + '</span>' +
        '<div class="sr-bar-track"><div class="sr-bar-fill' + cls + '" style="width:' + pct + '%"></div></div>' +
        '<span class="sr-bar-value">' + v + (isSpeed ? ' wpm' : '') + '</span>' +
    '</div>';
}

function showScoreReport(data, text) {
    var total = calcSingleScore(data);
    var grade = scoreGrade(total);
    openSheet("sentence", function() {
        elements.sentenceSheetTitle.textContent = "口语评分报告";
        elements.sentenceDetailContent.innerHTML =
            '<div class="score-report">' +
                '<div class="sr-grade" style="color:' + grade.color + '">' + grade.label + '</div>' +
                '<div class="sr-total">' + total + '<span class="sr-total-unit">分</span></div>' +
                '<div class="sr-comment">' + escapeHtml(grade.comment) + '</div>' +
                '<div class="sr-sentence">' + escapeHtml(text) + '</div>' +
                '<div class="sr-bars">' +
                    buildScoreBar('综合', data.overall) +
                    buildScoreBar('发音', data.pronunciation) +
                    buildScoreBar('流利', data.fluency) +
                    buildScoreBar('完整', data.integrity) +
                    buildScoreBar('语速', data.speed, true) +
                '</div>' +
            '</div>';
    });
}

// --- 单句录音 (探索页) ---
var _activeRecording = null;

function checkRecordCooldown() {
    var now = Date.now();
    if (now - _lastRecordClick < RECORD_COOLDOWN) return false;
    _lastRecordClick = now;
    return true;
}

async function startRecordAndScore(text, button) {
    if (!text) return;
    if (_activeRecording) {
        if (!checkRecordCooldown()) return;
        finishRecording(text, button);
        return;
    }
    if (!checkRecordCooldown()) return;
    try {
        if (button) { button.textContent = "🔴"; button.classList.add("recording"); }
        _activeRecording = await recordAudioBlob(15);
        _activeRecording._text = text;
        _activeRecording._button = button;
        _activeRecording.maxTimer = setTimeout(function() {
            finishRecording(text, button);
        }, 15000);
        showToast("录音中…再点一次结束", "info");
    } catch (e) {
        _activeRecording = null;
        if (button) { button.classList.remove("recording"); button.textContent = "🎤"; }
        if (e.name === 'NotAllowedError') {
            showToast("请授权麦克风权限", "warning");
        } else {
            showToast("录音失败: " + e.message, "error");
        }
    }
}

async function finishRecording(text, button) {
    if (!_activeRecording) return;
    clearTimeout(_activeRecording.maxTimer);
    var wavBlob;
    try {
        wavBlob = _activeRecording.stop();
    } catch(e) {
        _activeRecording = null;
        if (button) { button.classList.remove("recording"); button.textContent = "🎤"; }
        showToast("录音异常", "error");
        return;
    }
    _activeRecording = null;
    if (button) { button.classList.remove("recording"); button.textContent = "⏳"; button.disabled = true; }
    try {
        var data = await submitSpeechScore(wavBlob, text);
        showScoreReport(data, text);
    } catch(e) {
        showToast("评分失败: " + e.message, "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "🎤"; }
    }
}

// --- 仓库整组沉浸录音 ---
var _lessonRecording = null;
var _lessonRecorderState = { lessonId: '' };

function getLessonLastScore(lessonId) {
    var lesson = SavedLessonRepo.findByRef(lessonId);
    return lesson && typeof lesson.lastRecordScore === 'number' ? lesson.lastRecordScore : null;
}

function saveLessonLastScore(lessonId, score) {
    var list = loadSavedLessons();
    var updated = false;
    list = list.map(function(item) {
        if (SavedLessonRepo.isSameRef(item, lessonId)) {
            updated = true;
            return Object.assign({}, item, { lastRecordScore: score });
        }
        return item;
    });
    if (updated) saveSavedLessons(list);
}

function openLessonRecorder(lessonId) {
    var lesson = SavedLessonRepo.findByRef(lessonId);
    if (!lesson || !lesson.expressions || !lesson.expressions.length) {
        showToast("找不到这组表达", "warning");
        return;
    }
    _lessonRecorderState.lessonId = lessonId;
    document.querySelector('.app-header').classList.add('hidden');
    document.querySelector('.level-bar-wrap').classList.add('hidden');
    document.querySelector('.bottom-nav').classList.add('hidden');

    var panels = document.querySelectorAll('#mainScroll > .panel');
    panels.forEach(function(p) { p.style.display = 'none'; });

    var sentences = lesson.expressions.map(function(e) { return e.english; });
    var fullText = sentences.join('. ');
    var lastScore = getLessonLastScore(lessonId);
    var lastInfo = lastScore !== null
        ? scoreGrade(lastScore).label + ' · ' + lastScore + '分'
        : '这组还没有录过音';

    var recorderEl = document.createElement('div');
    recorderEl.id = 'immersiveRecorderWrap';
    recorderEl.innerHTML =
        '<div class="immersive-recorder">' +
            '<div class="ir-top-bar">' +
                '<button class="btn btn-ghost btn-sm" type="button" data-action="exit-lesson-recorder">← 退出</button>' +
                '<span class="ir-last-score">' + lastInfo + '</span>' +
            '</div>' +
            '<div class="ir-title">' + escapeHtml(lesson.topic || '口语评测') + '</div>' +
            '<div class="ir-sentences">' +
                sentences.map(function(s, i) {
                    return '<div class="ir-sentence"><span class="ir-sentence-idx">' + (i + 1) + '</span>' + escapeHtml(s) + '</div>';
                }).join('') +
            '</div>' +
            '<div class="ir-controls">' +
                '<div class="ir-status" id="irStatus">点击下方按钮开始录音</div>' +
                '<button class="ir-record-btn" type="button" data-action="lesson-record-toggle" data-text="' + encodeData(fullText) + '" id="irRecordBtn">🎤</button>' +
            '</div>' +
        '</div>';
    document.getElementById('mainScroll').appendChild(recorderEl);
}

function closeLessonRecorder() {
    if (_lessonRecording) {
        clearTimeout(_lessonRecording.maxTimer);
        try { _lessonRecording.stop(); } catch(e) {}
        _lessonRecording = null;
    }
    var recorderWrap = document.getElementById('immersiveRecorderWrap');
    if (recorderWrap) recorderWrap.remove();

    var panels = document.querySelectorAll('#mainScroll > .panel');
    panels.forEach(function(p) { p.style.display = ''; });

    document.querySelector('.app-header').classList.remove('hidden');
    document.querySelector('.level-bar-wrap').classList.remove('hidden');
    document.querySelector('.bottom-nav').classList.remove('hidden');
    switchTab(appState.activeTab);
}

async function toggleLessonRecording(text, button) {
    if (!text) return;
    if (!checkRecordCooldown()) return;

    if (_lessonRecording) {
        finishLessonRecording(text, button);
        return;
    }

    try {
        if (button) { button.textContent = "⏹"; button.classList.add("recording"); }
        var statusEl = document.getElementById('irStatus');
        if (statusEl) statusEl.textContent = "录音中…点击上方按钮结束";
        var maxSec = 120;
        _lessonRecording = await recordAudioBlob(maxSec);
        _lessonRecording.maxTimer = setTimeout(function() {
            finishLessonRecording(text, button);
        }, maxSec * 1000);
    } catch(e) {
        _lessonRecording = null;
        if (button) { button.classList.remove("recording"); button.textContent = "🎤"; }
        var statusEl = document.getElementById('irStatus');
        if (statusEl) statusEl.textContent = "点击下方按钮开始录音";
        if (e.name === 'NotAllowedError') {
            showToast("请授权麦克风权限", "warning");
        } else {
            showToast("录音失败: " + e.message, "error");
        }
    }
}

async function finishLessonRecording(text, button) {
    if (!_lessonRecording) return;
    clearTimeout(_lessonRecording.maxTimer);
    var wavBlob;
    try {
        wavBlob = _lessonRecording.stop();
    } catch(e) {
        _lessonRecording = null;
        if (button) { button.classList.remove("recording"); button.textContent = "🎤"; }
        var statusEl = document.getElementById('irStatus');
        if (statusEl) statusEl.textContent = "录音异常，请重试";
        return;
    }
    _lessonRecording = null;
    if (button) { button.classList.remove("recording"); button.textContent = "⏳"; button.disabled = true; }
    var statusEl = document.getElementById('irStatus');
    if (statusEl) statusEl.textContent = "评分中，请稍候…";
    try {
        var data = await submitSpeechScore(wavBlob, text);
        var total = calcLessonScore(data);
        var grade = scoreGrade(total);
        saveLessonLastScore(_lessonRecorderState.lessonId, total);

        var reportHtml =
            '<div class="ir-report">' +
                '<div class="sr-grade" style="color:' + grade.color + '">' + grade.label + '</div>' +
                '<div class="sr-total">' + total + '<span class="sr-total-unit">分</span></div>' +
                '<div class="sr-comment">' + escapeHtml(grade.comment) + '</div>' +
                '<div class="sr-bars">' +
                    buildScoreBar('发音', data.pronunciation) +
                    buildScoreBar('完整', data.integrity) +
                '</div>' +
            '</div>';

        if (statusEl) statusEl.innerHTML = reportHtml;
        var lastEl = document.querySelector('.ir-last-score');
        if (lastEl) lastEl.textContent = grade.label + ' · ' + total + '分';
    } catch(e) {
        if (statusEl) statusEl.textContent = "评分失败: " + e.message;
        showToast("评分失败: " + e.message, "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "🎤"; }
    }
}

// 处理 speak 函数。
function isCompactAudioButton(btn) {
    if (!btn || !btn.classList) return false;
    return btn.classList.contains("speak-toggle") ||
           btn.classList.contains("wh-line-speak") ||
           btn.classList.contains("wh-action-btn") ||
           btn.classList.contains("warehouse-line-speak") ||
           btn.classList.contains("warehouse-speak-btn") ||
           btn.classList.contains("record-btn");
}
async function speak(text, rate = 1, button = null) {
    if (!text) return;

    const originalLabel = button?.textContent || "播放读音";
    const cachedAudio = getCachedAudio(buildAudioCacheKey(text, rate));
    const compactButton = isCompactAudioButton(button);
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
    var result = {
        ...normalized,
        id: String(lesson?.id || key),
        key,
        createdAt: lesson?.createdAt || new Date().toISOString(),
        updatedAt: lesson?.updatedAt || lesson?.createdAt || new Date().toISOString(),
        storageVersion: Number(lesson?.storageVersion || 0),
        audioVersion: Number(lesson?.audioVersion || 0)
    };
    if (typeof lesson?.lastRecordScore === 'number') {
        result.lastRecordScore = lesson.lastRecordScore;
    }
    return result;
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
                question: "「这是一个苹果」用英语怎么说？",
                answer: "This is an apple."
            },
            {
                type: "zh_to_en",
                question: "「你想要一个苹果吗？」用英语怎么说？",
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
