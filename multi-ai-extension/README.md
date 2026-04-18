# Multi-AI Unified Query Browser Extension

一个浏览器插件，允许用户在一个统一的界面中同时向多个AI平台发送问题，并并排查看各个AI的回复。

## 支持的AI平台

- 通义千问 (Qwen)
- 元宝 (Tencent Yuanbao)
- DeepSeek
- 豆包 (ByteDance Doubao)

## 功能特点

- 统一输入界面：在一个窗口中输入问题，同时发送给所有启用的AI
- 并排显示回复：方便对比不同AI的回答
- Markdown渲染：支持代码高亮、表格、列表等格式
- 对话历史保存：自动保存历史记录，随时查看
- 快捷键支持：Ctrl+Enter 发送，Esc 关闭
- 可自定义设置：选择启用的AI平台、设置超时时间

## 安装方法

### 开发者模式安装

1. 下载或克隆本仓库
2. 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本仓库的 `multi-ai-extension` 文件夹

### 注意事项

- 首次使用需要打开对应的AI网站并登录
- 插件会自动检测已打开的AI网站页面

## 使用方法

1. 点击浏览器工具栏中的插件图标
2. 在输入框中输入您的问题
3. 点击"发送"按钮或按 Ctrl+Enter
4. 等待各个AI的回复（显示在并排的卡片中）
5. 可以通过历史记录按钮查看之前的对话

## 项目结构

```
multi-ai-extension/
├── manifest.json           # 扩展配置文件
├── popup/                  # 弹出窗口UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/             # 后台脚本
│   ├── background.js
│   ├── storageManager.js
│   ├── conversationManager.js
│   └── messageRouter.js
├── content-scripts/        # 内容脚本（注入到AI网站）
│   ├── base.js
│   ├── qwen.js
│   ├── yuanbao.js
│   ├── deepseek.js
│   └── doubao.js
├── utils/                  # 工具模块
│   ├── constants.js
│   ├── logger.js
│   └── markdown-renderer.js
└── assets/
    └── icons/              # 图标资源
```

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript (ES6+)
- Chrome Storage API
- marked.js (Markdown 解析)
- highlight.js (代码高亮)

## 开发

### 调试

1. 安装扩展后，在 AI 网站上打开开发者工具（F12）
2. Content Script 的日志可以在对应网站的 Console 中查看
3. Background Script 的日志可以在 `chrome://extensions/` 中查看

### 构建

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

## 注意事项

- 本插件通过注入 Content Script 到AI网站的页面中实现自动化
- 由于各AI网站的DOM结构可能变化，可能需要相应更新选择器
- 请确保在使用前已登录各个AI平台

## License

MIT License
