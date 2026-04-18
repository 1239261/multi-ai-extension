# Task List: Multi-AI Unified Query Browser Extension

## Phase 1: Project Setup

### 1.1 Project Structure

- [x] 1.1.1 创建项目目录结构
- [x] 1.1.2 初始化 package.json
- [x] 1.1.3 配置构建工具 (webpack/vite)
- [x] 1.1.4 创建 manifest.json (Manifest V3)

### 1.2 Asset Preparation

- [x] 1.2.1 创建扩展图标 (16x16, 48x48, 128x128)
- [x] 1.2.2 创建 Provider Logo 占位符

## Phase 2: Core Modules

### 2.1 Utility Modules

- [x] 2.1.1 constants.js - 定义常量 (Provider列表, 消息类型, 默认设置)
- [x] 2.1.2 logger.js - 日志工具
- [x] 2.1.3 markdown-renderer.js - Markdown渲染器 (集成 marked.js + highlight.js)

### 2.2 Background Script

- [x] 2.2.1 storageManager.js - Chrome Storage 封装
- [x] 2.2.2 conversationManager.js - 对话状态管理
- [x] 2.2.3 messageRouter.js - 消息路由逻辑
- [x] 2.2.4 background.js - Background Script 入口

### 2.3 Popup Window (UI Layer)

- [x] 2.3.1 popup.html - 主界面HTML结构
- [x] 2.3.2 popup.css - 样式 (Grid布局, 并排显示)
- [x] 2.3.3 QuestionInput.js - 问题输入组件 (集成到 popup.js)
- [x] 2.3.4 ResponseGrid.js - 回复网格组件 (集成到 popup.js)
- [x] 2.3.5 StatusBar.js - Provider状态栏组件 (集成到 popup.js)
- [x] 2.3.6 HistoryPanel.js - 历史记录面板组件 (集成到 popup.js)
- [x] 2.3.7 SettingsPanel.js - 设置面板组件 (集成到 popup.js)
- [x] 2.3.8 popup.js - Popup入口和消息处理

### 2.4 Content Scripts

- [x] 2.4.1 base.js - Provider基类 (公共方法)
- [x] 2.4.2 qwen.js - Qwen (通义千问) 实现
- [x] 2.4.3 yuanbao.js - 元宝 (腾讯) 实现
- [x] 2.4.4 deepseek.js - DeepSeek 实现
- [x] 2.4.5 doubao.js - 豆包 (字节) 实现

## Phase 3: Testing

### 3.1 Unit Tests

- [ ] 3.1.1 markdown-renderer.test.js
- [ ] 3.1.2 storage-manager.test.js
- [ ] 3.1.3 message-router.test.js

### 3.2 Manual Testing

- [ ] 3.2.1 扩展安装测试
- [ ] 3.2.2 多Provider集成测试
- [ ] 3.2.3 UI交互测试
- [ ] 3.2.4 历史记录测试

## Phase 4: Documentation & Build

- [x] 4.1 完善 README.md
- [ ] 4.2 构建生产版本
- [ ] 4.3 打包 .crx/.zip 文件

---

## Task Dependencies

```
1.1 → 2.1 → 2.2 → 2.3
                ↘
                  → 2.4
                  
2.3 + 2.4 → 3.1 → 3.2 → 4
```
