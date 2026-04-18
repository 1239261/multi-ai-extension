# 需求文档

## 引言

本需求文档描述了"多AI统一查询浏览器插件"的功能规格。该插件允许用户在一个统一的界面中同时向多个AI平台（Qwen、元宝、DeepSeek、豆包）发送问题，并在一个窗口中并排查看各个AI的回复。

## 词汇表

- **插件 (Extension)**: 浏览器扩展程序，运行在用户浏览器中的轻量级应用
- **AI Provider (AI提供商)**: 指的是 Qwen(通义千问)、元宝、DeepSeek、豆包 等AI对话服务
- **Popup Window (弹出窗口)**: 插件激活时显示的主交互界面
- **Content Script (内容脚本)**: 插件注入到AI Provider网页中运行的脚本，用于与页面交互
- **Background Script (后台脚本)**: 插件的后台服务，负责消息路由和数据持久化
- **Message Channel (消息通道)**: Popup、Content Script、Background Script 之间的通信机制
- **Round-trip Validation (往返验证)**: 验证解析器正确性的测试方法，即解析后再序列化应得到相同结果
- **Markdown Renderer (Markdown渲染器)**: 将Markdown文本转换为格式化HTML的组件

## 需求

### 需求1：统一输入界面

**用户故事:** 作为用户，我希望在一个统一的输入框中输入我的问题，以便同时向多个AI发送相同的问题。

#### Acceptance Criteria

1. WHEN 用户点击浏览器插件图标，插件 SHALL 显示统一的弹出窗口
2. WHEN 弹出窗口显示，插件 SHALL 展示一个多行文本输入框作为问题输入区域
3. WHEN 用户在输入框中输入问题并按下发送按钮（或 Ctrl+Enter），插件 SHALL 获取用户输入的问题文本
4. WHEN 用户按下发送按钮，插件 SHALL 同时向所有已配置的AI Provider发送问题
5. IF 用户未输入任何内容而按下发送按钮，插件 SHALL 显示提示"请输入问题内容"
6. IF 发送过程中某个AI Provider失败，插件 SHALL 显示该Provider的错误状态，并继续等待其他Provider的回复

### 需求2：多AI平台集成

**用户故事:** 作为用户，我希望插件能同时连接Qwen、元宝、DeepSeek、豆包这四个AI平台，以便获取多个AI的观点。

#### Acceptance Criteria

1. WHEN 插件初始化，插件 SHALL 尝试连接到以下AI Provider：Qwen、元宝、DeepSeek、豆包
2. WHEN 发送问题时，插件 SHALL 通过各Provider的网页端界面自动提交问题
3. WHEN 某Provider的网页端需要登录，插件 SHALL 在该Provider的消息区域显示"需要登录"状态
4. IF 某Provider的网页端返回错误，插件 SHALL 在对应区域显示错误信息
5. IF 某Provider响应时间超过30秒，插件 SHALL 显示"响应超时"状态并允许用户取消等待

### 需求3：并排显示回复

**用户故事:** 作为用户，我希望多个AI的回复能并排显示在一个窗口中，以便我对比不同AI的回答。

#### Acceptance Criteria

1. WHEN 插件收到某个AI的回复，插件 SHALL 在该AI对应的消息区域显示回复内容
2. WHEN 多个AI的回复同时显示，插件 SHALL 使用CSS Grid或Flexbox布局实现并排显示
3. WHEN 任何AI正在处理问题时，插件 SHALL 在其消息区域显示"正在思考..."或类似的loading状态
4. WHEN 所有AI都完成回复或超时，插件 SHALL 停止所有loading状态显示
5. WHEN 用户滚动某个AI的回复区域，插件 SHALL 仅滚动该区域，不影响其他AI的显示

### 需求4：Markdown渲染支持

**用户故事:** 作为用户，我希望AI的回复能以格式化的方式显示，包括代码高亮、列表、表格等，以便我更好地阅读内容。

#### Acceptance Criteria

1. WHEN AI返回包含Markdown格式的文本，插件 SHALL 使用Markdown渲染器将文本转换为HTML
2. WHEN 渲染Markdown文本，插件 SHALL 支持以下元素：标题(h1-h6)、段落、换行、粗体、斜体、链接、图片、列表（有序和无序）、代码块和行内代码、引用块、表格
3. WHEN 渲染代码块，插件 SHALL 应用语法高亮，使用highlight.js或等效库
4. WHEN 渲染表格，插件 SHALL 支持表格的边框、对齐和基本样式
5. IF Markdown渲染失败，插件 SHALL 回退到显示原始文本并显示"格式渲染失败"提示

### 需求5：对话历史保存

**用户故事:** 作为用户，我希望插件能保存我的问题和AI的回复，以便日后查看之前的对话。

#### Acceptance Criteria

1. WHEN 用户完成一次问答（所有AI都回复或超时），插件 SHALL 自动保存本次对话到本地存储
2. WHEN 保存对话时，插件 SHALL 记录：问题文本、每个AI的回复及时间戳、当前日期时间
3. WHEN 用户点击插件的"历史记录"按钮，插件 SHALL 显示历史对话列表
4. WHEN 用户在历史记录中点击某次对话，插件 SHALL 在主界面加载并显示该次对话的内容
5. WHEN 用户点击历史记录的"删除"按钮，插件 SHALL 从本地存储中删除该条记录
6. IF 本地存储空间不足，插件 SHALL 提醒用户并允许用户手动清理历史记录

### 需求6：快捷键支持

**用户故事:** 作为用户，我希望可以使用键盘快捷键来操作插件，以提高使用效率。

#### Acceptance Criteria

1. WHEN 用户在插件窗口中按下 Ctrl+Enter，插件 SHALL 触发发送问题的操作
2. WHEN 用户按下 Esc 键，插件 SHALL 关闭插件弹出窗口
3. WHEN 用户在插件窗口中按下 Ctrl+H，插件 SHALL 显示历史记录面板

### 需求7：Provider状态管理

**用户故事:** 作为用户，我希望能看到各个AI Provider的连接状态，以便了解哪些AI可以正常响应。

#### Acceptance Criteria

1. WHEN 插件初始化，插件 SHALL 检测每个AI Provider网页端的登录状态
2. WHEN 某Provider处于未登录状态，插件 SHALL 在其状态区域显示"未登录"图标
3. WHEN 某Provider处于登录状态，插件 SHALL 在其状态区域显示"就绪"图标
4. WHEN 某Provider正在处理请求，插件 SHALL 在其状态区域显示"忙碌"图标
5. IF 用户在AI Provider网页端手动登出，插件 SHALL 检测到该变化并更新状态显示

### 需求8：插件设置

**用户故事:** 作为用户，我希望可以自定义插件的行为，如选择启用哪些AI Provider、设置超时时间等。

#### Acceptance Criteria

1. WHEN 用户点击插件的"设置"按钮，插件 SHALL 显示设置面板
2. WHEN 显示设置面板，插件 SHALL 提供以下选项：启用/禁用各个AI Provider、响应超时时间（10-60秒，默认30秒）、是否自动保存历史记录、清除所有历史记录按钮
3. WHEN 用户修改设置并保存，插件 SHALL 将设置保存到浏览器存储(Chrome Storage API)
4. WHEN 用户点击清除历史记录按钮，插件 SHALL 删除所有保存的对话记录并显示确认提示

## 技术实现说明

### 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Extension                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Popup     │    │  Background │    │   Content   │ │
│  │   Window    │◄──►│   Script    │◄──►│   Scripts    │ │
│  │   (UI)      │    │  (Hub)      │    │ (Injected)   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                  │        │
│         │                  │                  │        │
│         ▼                  ▼                  ▼        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Chrome Storage (Local)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 消息流

1. **Popup → Background**: 用户发送问题时，Popup通过`browser.runtime.sendMessage`发送问题内容
2. **Background → Content Scripts**: Background根据配置的Provider列表，分别向各Provider的Content Script发送问题
3. **Content Scripts → AI Pages**: Content Script通过注入的脚本在AI Provider的网页端自动填写并提交问题
4. **Content Scripts → Background**: Content Script通过`window.postMessage`和Chrome messaging将AI的回复传回Background
5. **Background → Popup**: Background汇总各Provider的回复，通过消息通道传回Popup进行显示

### 各AI Provider的集成方式

由于是浏览器插件，需要通过Content Script注入到各AI Provider的网页中，自动化填写和提交问题。

| Provider | 目标网站 | 注入方式 |
|----------|---------|---------|
| Qwen (通义千问) | qwen.ai / qwen.cn | Content Script匹配URL，注入自动化脚本 |
| 元宝 (腾讯) | yuanbao.tencent.com | Content Script匹配URL，注入自动化脚本 |
| DeepSeek | chat.deepseek.com | Content Script匹配URL，注入自动化脚本 |
| 豆包 (字节跳动) | doubao.com | Content Script匹配URL，注入自动化脚本 |

### 数据模型

**Conversation (对话)**
```json
{
  "id": "uuid",
  "timestamp": "ISO8601",
  "question": "string",
  "responses": [
    {
      "provider": "qwen|yuanbao|deepseek|doubao",
      "content": "markdown string",
      "rawContent": "original response",
      "status": "success|error|timeout|login_required",
      "timestamp": "ISO8601"
    }
  ]
}
```

**Settings (设置)**
```json
{
  "enabledProviders": ["qwen", "yuanbao", "deepseek", "doubao"],
  "timeoutSeconds": 30,
  "autoSaveHistory": true
}
```

### 错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| Provider未登录 | 显示"需要登录"状态，提供跳转链接 |
| 网络错误 | 显示"网络错误"状态，允许重试 |
| 超时 | 显示"响应超时"状态，显示已接收的部分内容（如果有） |
| 解析错误 | 显示原始文本，显示"格式解析失败"提示 |
| 内容脚本注入失败 | 在Popup中显示"无法连接到此AI，请刷新页面后重试" |

## 测试策略

### 单元测试

- Markdown渲染器：验证各元素的正确转换
- 消息序列化/反序列化：往返验证
- 设置存储：验证读取和写入

### 集成测试

- 模拟Content Script消息流
- 验证Background到Popup的消息路由
- 历史记录CRUD操作

### E2E测试（手动）

- 在各AI Provider网站上手动测试完整流程
- 验证多个AI同时响应的场景
- 验证历史记录的保存和加载
