// ===== config.js =====
// 常数定义表。往这里加通知、公告、推送模板等静态配置。
// 部署时由 build.js 内联到 dist.html。

export const APP_CONFIG = {

    // 消息推送列表（JSON 驱动）
    // type: "daily" | "notice" | "update" | "tip"
    // daily 类型会按天时间戳随机抽取仓库内容填充
    // notice/update/tip 类型为静态文案，直接展示
    pushMessages: [
        {
            id: "daily_lesson",
            type: "daily",
            title: "每日学习推送",
            avatar: "🤖",
            badge: "DAILY",
            template: "从仓库随机抽取一组表达，帮你复习。"
        },
        {
            id: "welcome",
            type: "notice",
            title: "欢迎使用 DuoGrow Quest",
            avatar: "📢",
            content: "每天打开看一眼，保持语感不中断。坚持比完美更重要。",
            showOnce: true
        }
        // 在这里继续添加推送：
        // {
        //     id: "update_v2",
        //     type: "update",
        //     title: "版本更新",
        //     avatar: "🎉",
        //     content: "新增竞技场功能，快去试试吧！",
        //     showOnce: true
        // },
        // {
        //     id: "tip_streak",
        //     type: "tip",
        //     title: "学习小贴士",
        //     avatar: "💡",
        //     content: "连续3天学习可以解锁三连击徽章哦。"
        // }
    ],

    // 每日推送时间显示（纯展示用）
    pushTimeDisplay: "08:00",

    // 随机种子盐值（改变这个会让同一天的随机结果不同）
    dailySeed: "duogrow2026"
};
