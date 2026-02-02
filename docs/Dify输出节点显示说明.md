# Dify 输出节点内容显示说明

## 当前实现

当前代码在 `output/js/ai-chat.js` 的 `parseDifyResponse` 函数中处理 Dify 响应。

### 当前解析逻辑

```javascript
function parseDifyResponse(response) {
    if (response.data) {
        if (response.data.status === 'succeeded') {
            if (response.data.output) {
                // 尝试多种格式提取文本
                if (typeof response.data.output === 'string') {
                    return response.data.output;
                } else if (response.data.output.text) {
                    return response.data.output.text;
                } else if (response.data.output.answer) {
                    return response.data.output.answer;
                } else if (response.data.output.result) {
                    return response.data.output.result;
                } else {
                    // 如果是对象，转换为JSON字符串
                    return JSON.stringify(response.data.output, null, 2);
                }
            }
        }
    }
}
```

## Dify 工作流响应结构

Dify Workflow API 的响应结构通常是：

```json
{
    "data": {
        "id": "workflow-run-id",
        "status": "succeeded",
        "outputs": {
            "node_id": {
                "output": "节点输出内容"
            }
        },
        "output": "最终输出内容"  // 或可能是对象
    }
}
```

## 问题分析

1. **输出节点位置不确定**: Dify 工作流可能有多个输出节点，需要确定使用哪个
2. **输出格式多样**: 可能是字符串、对象、数组等
3. **需要支持富文本**: Markdown、HTML 等格式需要渲染

## 解决方案

### 方案 1: 增强解析函数（推荐）

修改 `parseDifyResponse` 函数，支持更完善的输出解析：

```javascript
function parseDifyResponse(response) {
    console.log('完整响应结构:', JSON.stringify(response, null, 2));
    
    if (!response || !response.data) {
        return '响应格式错误，请检查 Dify 工作流配置。';
    }
    
    const data = response.data;
    
    // 检查状态
    if (data.status === 'failed') {
        throw new Error(data.error || '工作流执行失败');
    }
    
    if (data.status !== 'succeeded') {
        return '工作流正在执行中，请稍候...';
    }
    
    // 优先从 outputs 中提取（多个输出节点的情况）
    if (data.outputs && typeof data.outputs === 'object') {
        // 获取第一个输出节点的内容
        const outputKeys = Object.keys(data.outputs);
        if (outputKeys.length > 0) {
            const firstOutput = data.outputs[outputKeys[0]];
            if (firstOutput && firstOutput.output !== undefined) {
                return extractOutputContent(firstOutput.output);
            }
        }
    }
    
    // 从 output 字段提取（单个输出节点的情况）
    if (data.output !== undefined) {
        return extractOutputContent(data.output);
    }
    
    return '工作流执行成功，但未返回输出内容。';
}

function extractOutputContent(output) {
    // 如果是字符串，直接返回
    if (typeof output === 'string') {
        return output;
    }
    
    // 如果是对象，尝试提取常见字段
    if (typeof output === 'object' && output !== null) {
        // 尝试常见的输出字段名
        const commonFields = ['text', 'answer', 'result', 'content', 'message', 'output'];
        for (const field of commonFields) {
            if (output[field] !== undefined) {
                return extractOutputContent(output[field]);
            }
        }
        
        // 如果是数组，提取第一个元素
        if (Array.isArray(output) && output.length > 0) {
            return extractOutputContent(output[0]);
        }
        
        // 如果是对象但没有找到常见字段，转换为格式化的JSON
        return JSON.stringify(output, null, 2);
    }
    
    // 其他类型转换为字符串
    return String(output);
}
```

### 方案 2: 支持 Markdown 渲染

如果需要显示 Markdown 格式的内容，可以添加 Markdown 渲染：

```javascript
// 需要引入 Markdown 库，例如 marked.js
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

function addAIChatMessage(content, isUser = true) {
    // ... 现有代码 ...
    
    const messageContent = document.createElement('div');
    messageContent.className = 'ai-chat-message-content';
    
    // 如果是 AI 消息且包含 Markdown，进行渲染
    if (!isUser && typeof marked !== 'undefined') {
        messageContent.innerHTML = marked.parse(content);
    } else {
        messageContent.textContent = content;
    }
    
    // ... 其余代码 ...
}
```

### 方案 3: 调试模式

添加调试功能

```javascript
// 在 ai-chat.js 中添加调试开关
const DEBUG_MODE = true;  // 开发时设为 true，生产环境设为 false

function parseDifyResponse(response) {
    // 调试模式下输出完整响应
    if (DEBUG_MODE) {
        console.log('=== Dify 完整响应 ===');
        console.log(JSON.stringify(response, null, 2));
        console.log('==================');
    }
    
    // ... 解析逻辑 ...
}
```

## 实施步骤

### 步骤 1: 查看实际响应结构

在浏览器控制台中查看 Dify 的实际响应：

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 在 AI 聊天窗口执行一个命令
4. 查看控制台输出的 `Dify API响应:` 日志

### 步骤 2: 根据实际结构调整解析

根据实际响应结构，修改 `parseDifyResponse` 函数：

- 如果输出在 `response.data.outputs.node_id.output`
- 如果输出在 `response.data.output.text`
- 如果输出是其他结构

### 步骤 3: 测试不同输出格式

测试 Dify 工作流返回不同格式的输出：
- 纯文本
- JSON 对象
- Markdown
- HTML

## 常见输出节点配置

### 文本输出节点

如果 Dify 工作流使用"文本输出"节点，输出通常在：
```javascript
response.data.output  // 字符串
```

### LLM 节点输出

如果使用 LLM 节点，输出可能在：
```javascript
response.data.outputs['llm_node_id'].output.text
// 或
response.data.output.answer
```

### 代码节点输出

如果使用代码节点，输出可能在：
```javascript
response.data.outputs['code_node_id'].output
```

## Agent 节点回复格式与图层刷新

当 Dify 工作流中的 Agent 节点执行创建/修改/删除要素后，可在回复文本末尾附带状态标记，前端会根据该标记自动刷新地图图层。

### 约定格式

- **成功回复**：在回复文本末尾加上 `<<STATUS:SUCCESS>>`  
  示例：`已成功创建名称为'张村'的要素，系统返回编号 gid=108。\n<<STATUS:SUCCESS>>`
- **失败回复**：在回复文本末尾加上 `<<STATUS:FAILURE>>`  
  示例：`未找到编号为 99 的记录，无法执行修改，请检查编号。\n<<STATUS:FAILURE>>`

### 前端行为

- 在 `output/js/ai-chat.js` 中，`parseAgentStatus()` 会解析回复末尾的 `<<STATUS:SUCCESS>>` 或 `<<STATUS:FAILURE>>`。
- 若解析到 `SUCCESS`，且当前页面存在 `window.reloadAllData`（即 `map_api.html` 环境），会自动调用 `reloadAllData()` 重新加载村庄、河渠、水系三层数据并刷新地图。
- 展示给用户的消息会去掉末尾的状态标记，用户不会看到 `<<STATUS:...>>`。

---

## 快速诊断

在浏览器控制台执行：

```javascript
// 查看最后一次 Dify 响应的完整结构
// 在 ai-chat.js 的 executeAICommand 函数中添加：
console.log('完整响应结构:', JSON.stringify(result, null, 2));
```

然后根据实际结构调整 `parseDifyResponse` 函数。

---

**版本**: 1.0.0  
**最后更新**: 2024年

