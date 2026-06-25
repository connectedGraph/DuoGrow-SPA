# Android 调试指南

## 方案 1：Chrome 远程调试（推荐）

### 步骤

1. **手机开启开发者选项**
   - 设置 > 关于手机 > 连续点击「版本号」7次
   - 返回设置 > 开发者选项 > 开启「USB 调试」

2. **连接电脑**
   - USB 连接手机和电脑
   - 手机会弹出授权提示，点击「允许」

3. **Chrome 远程调试**
   - 电脑打开 Chrome 浏览器
   - 地址栏输入：`chrome://inspect`
   - 等待识别设备
   - 找到「DuoGrow Quest」，点击「inspect」

4. **开始调试**
   - 可以查看 Console 日志
   - 查看网络请求
   - 检查 DOM 结构
   - 实时调试 JavaScript

---

## 方案 2：Android Studio Logcat

### 步骤

1. 手机 USB 连接电脑
2. Android Studio > Logcat
3. 过滤器输入：`chromium` 或 `Web Console`
4. 可以看到 WebView 的所有日志

---

## 方案 3：浏览器预览（功能受限）

我可以创建一个浏览器兼容版本，但 Capacitor Preferences 会降级为 localStorage。

需要的话告诉我。

---

## 常见问题

### Q: 页面白屏
- 打开 Chrome 远程调试查看 Console 错误
- 检查是否有 JS 报错
- 检查网络请求是否正常

### Q: API 调用失败
- 检查 CORS 问题
- 查看网络请求的 status code
- 确认 API Key 是否正确

### Q: 存储数据丢失
- Capacitor Preferences 存储在应用数据目录
- 卸载应用会清空数据
- 可以在代码中添加导出功能

---

推荐使用**方案 1**，可以完整调试所有功能。
