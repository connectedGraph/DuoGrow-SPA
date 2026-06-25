# Chrome 远程调试使用教程

## 你现在看到的界面

```
DuoGrow Quest
https://localhost/
```

这就是你的 APP 在手机上运行的 WebView。

---

## 下一步：点击 inspect

在 "DuoGrow Quest" 这一行，右边有一个 **"inspect"** 链接，点击它。

会弹出一个新窗口，这就是调试工具。

---

## 调试工具介绍

弹出的窗口分几个区域：

### 1. **左侧：手机屏幕镜像**
- 实时显示手机上的页面
- 可以点击交互（和手机同步）

### 2. **右侧：DevTools（开发者工具）**

#### Console（控制台）标签页
- 查看 JavaScript 错误
- 查看 console.log 输出
- 可以直接输入 JS 代码测试

**常用操作**：
```javascript
// 查看存储的数据
localStorage.getItem('mom_english_config')

// 测试函数
console.log('test')
```

#### Network（网络）标签页
- 查看所有 API 请求
- 查看请求是否成功
- 查看响应内容

**查看方法**：
1. 点击 Network 标签
2. 在手机上操作（比如生成表达）
3. 可以看到所有网络请求列表
4. 点击某个请求，查看详情

#### Elements（元素）标签页
- 查看页面 HTML 结构
- 实时修改样式
- 查看 CSS

#### Sources（源代码）标签页
- 查看 JS 代码
- **设置断点调试**（这个最强大）

---

## 实战：找出 Bug

### 步骤 1：打开 Console
点击 Console 标签，看看有没有红色的错误信息。

### 步骤 2：操作页面
在手机上点击功能，观察 Console 是否报错。

### 步骤 3：查看网络请求
- 切换到 Network 标签
- 在手机上生成内容
- 看请求是否成功（绿色 200 = 成功，红色 = 失败）

### 步骤 4：设置断点（高级）
- 切换到 Sources 标签
- 找到 app.js
- 点击行号，设置断点
- 再次操作，代码会暂停在断点处
- 可以查看变量值

---

## 常见问题

### Q: 页面是白屏
**排查**：
1. Console 看是否有 JS 报错
2. Network 看资源是否加载成功

### Q: API 调用失败
**排查**：
1. Network 标签找到失败的请求
2. 点击查看 Status Code
3. 查看 Response（服务器返回内容）

### Q: 数据没保存
**排查**：
1. Console 输入：`localStorage`
2. 查看是否有数据
3. 或者在 Application 标签查看 Storage

---

## 快捷键

- `Ctrl + Shift + C`：选择元素
- `Ctrl + F`：在当前标签页搜索
- `F8`：恢复执行（断点调试时）

---

现在去点击 **inspect** 按钮，打开调试窗口吧！
