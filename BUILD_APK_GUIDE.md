# Android APK 构建指南

## ✅ 已完成配置

- Capacitor 项目已初始化
- Android 平台已添加
- localStorage 已升级为 Capacitor Preferences
- 项目文件已同步到 Android

---

## 第一步：安装 Android Studio

1. **下载地址**：https://developer.android.com/studio
2. **安装步骤**：
   - 双击安装包
   - 全部选择默认选项
   - 等待下载 Android SDK（首次安装需要 5-10 分钟）

**不需要注册账号，直接下载安装即可。**

---

## 第二步：打开 Android 项目

```bash
cd "D:/1/CS&AI/个人项目/Duogrow/v3-speech-assessment-android-2026-6-21"
npm run open
```

或者直接运行：
```bash
npx cap open android
```

会自动启动 Android Studio 并打开项目。

---

## 第三步：构建 APK

1. **等待 Gradle 构建完成**（首次需要 5-10 分钟）
   - 右下角会显示进度条
   - 不要关闭，让它自动下载依赖

2. **点击菜单**：Build > Build Bundle(s) / APK(s) > Build APK(s)

3. **等待构建完成**（约 1-2 分钟）

4. **定位 APK 文件**：
   - 构建完成后会弹出通知
   - 点击 **locate** 链接
   - 或者手动找到：`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 第四步：安装到手机

1. 将 `app-debug.apk` 发送到手机（微信/QQ/USB）
2. 点击 APK 文件安装
3. 如果提示"不允许安装未知来源"，去设置中允许

---

## 修改代码后如何更新

每次修改 `index.html`、`app.js`、`config.js` 等文件后：

```bash
npm run sync
```

然后在 Android Studio 中重新 Build APK 即可。

---

## 已完成的改造

✅ Capacitor 配置
✅ localStorage 升级为 Capacitor Preferences（更可靠）
✅ ES Module 模块化
✅ Android 项目已生成
✅ 准备好打包配置

---

## 注意事项

- 生成的 `app-debug.apk` 是调试版本，已自动签名
- 可以直接安装到手机测试
- 如果要上架应用商店，需要生成发布签名（到时候再说）

---

## 发布签名（上架时使用）

生成密钥：
```bash
keytool -genkey -v -keystore duogrow-release.keystore \
  -alias duogrow -keyalg RSA -keysize 2048 -validity 10000
```

配置到 `android/app/build.gradle`，然后构建 Release APK。

