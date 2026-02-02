/**
 * AI聊天窗口功能
 */

// AI聊天窗口管理
let aiChatWindow = null;
let aiAssistantBtn = null;
let aiChatCloseBtn = null;
let aiChatMessages = null;
let aiChatInput = null;
let aiChatExecuteBtn = null;
let aiChatCancelBtn = null;

// Dify配置（临时硬编码，后续可改为从文件加载）
let difyConfig = {
    url: 'http://192.168.3.5/v1',
    key: 'app-qo4twJjmaF6mjjIRt1DvvolD',
    loaded: true  // 直接设置为已加载
};

/**
 * 加载Dify配置（临时硬编码版本）
 * TODO: 后续优化为从配置文件加载
 */
async function loadDifyConfig() {
    // 临时硬编码配置，直接返回成功
    // 配置内容来自 output/data/dify_url_key.json
    difyConfig.url = 'http://192.168.3.5/v1';
    difyConfig.key = 'app-qo4twJjmaF6mjjIRt1DvvolD';
    difyConfig.loaded = true;
    console.log('Dify配置已加载（硬编码）:', difyConfig.url);
    return true;
    
    /* 原始文件加载代码（已注释，后续可恢复）
    try {
        // 使用基于当前页面URL的路径，确保在不同协议下都能正确解析
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
        const configUrl = `${baseUrl}/data/dify_url_key.json`;
        
        // 如果是file://协议，使用相对路径
        const url = window.location.protocol === 'file:' 
            ? './data/dify_url_key.json' 
            : configUrl;
        
        console.log('尝试加载Dify配置，URL:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const config = await response.json();
        difyConfig.url = config.Dify_url;
        difyConfig.key = config.Dify_key;
        difyConfig.loaded = true;
        console.log('Dify配置加载成功:', difyConfig.url);
        return true;
    } catch (error) {
        console.error('加载Dify配置失败:', error);
        difyConfig.loaded = false;
        return false;
    }
    */
}

/**
 * 初始化AI聊天窗口
 */
function initAIChat() {
    // 获取DOM元素
    aiChatWindow = document.getElementById('ai-chat-window');
    aiAssistantBtn = document.getElementById('ai-assistant-btn');
    aiChatCloseBtn = document.getElementById('ai-chat-close-btn');
    aiChatMessages = document.getElementById('ai-chat-messages');
    aiChatInput = document.getElementById('ai-chat-input');
    aiChatExecuteBtn = document.getElementById('ai-chat-execute-btn');
    aiChatCancelBtn = document.getElementById('ai-chat-cancel-btn');
    
    if (!aiChatWindow || !aiAssistantBtn) {
        console.warn('AI聊天窗口元素未找到');
        return;
    }
    
    // 加载Dify配置
    loadDifyConfig().catch(error => {
        console.warn('Dify配置加载失败，将使用本地解析:', error);
    });
    
    // 绑定事件
    aiAssistantBtn.addEventListener('click', openAIChat);
    
    if (aiChatCloseBtn) {
        aiChatCloseBtn.addEventListener('click', closeAIChat);
    }
    
    if (aiChatCancelBtn) {
        aiChatCancelBtn.addEventListener('click', closeAIChat);
    }
    
    if (aiChatExecuteBtn) {
        aiChatExecuteBtn.addEventListener('click', function() {
            const command = aiChatInput ? aiChatInput.value.trim() : '';
            if (command) {
                executeAICommand(command);
            }
        });
    }
    
    // 支持Enter发送，Shift+Enter换行
    if (aiChatInput) {
        aiChatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const command = aiChatInput.value.trim();
                if (command && aiChatExecuteBtn) {
                    aiChatExecuteBtn.click();
                }
            }
        });
        
        // 自动调整输入框高度
        aiChatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
    }
    
    console.log('AI聊天窗口初始化完成');
}

/**
 * 打开AI聊天窗口
 */
function openAIChat() {
    if (!aiChatWindow) return;
    
    aiChatWindow.classList.add('active');
    
    // 聚焦输入框
    if (aiChatInput) {
        setTimeout(() => {
            aiChatInput.focus();
        }, 100);
    }
}

/**
 * 关闭AI聊天窗口
 */
function closeAIChat() {
    if (!aiChatWindow) return;
    
    aiChatWindow.classList.remove('active');
    
    // 清空输入框
    if (aiChatInput) {
        aiChatInput.value = '';
        aiChatInput.style.height = 'auto';
    }
}

/**
 * 格式化消息内容（支持换行、JSON格式化等）
 * @param {string} content - 原始内容
 * @returns {string} 格式化后的HTML
 */
function formatMessageContent(content) {
    if (!content) return '';
    
    // 转义HTML特殊字符
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // 检测是否是JSON格式
    let isJson = false;
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object') {
            isJson = true;
            content = JSON.stringify(parsed, null, 2);
        }
    } catch (e) {
        // 不是JSON，继续处理
    }
    
    // 将换行符转换为 <br>
    let formatted = escapeHtml(content);
    
    // 如果是JSON，添加代码样式类
    if (isJson) {
        formatted = '<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin: 0;">' + 
                    formatted + 
                    '</pre>';
    } else {
        // 普通文本：保留换行
        formatted = formatted.replace(/\n/g, '<br>');
    }
    
    return formatted;
}

/**
 * Escape HTML for streaming display (plain text, newlines as <br>)
 */
function escapeHtmlForStream(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

/**
 * Create an assistant message container for streaming; caller updates content via the returned element.
 * @returns {{ messageDiv: HTMLElement, messageContent: HTMLElement }}
 */
function createStreamingMessageContainer() {
    if (!aiChatMessages) return { messageDiv: null, messageContent: null };
    const emptyState = aiChatMessages.querySelector('.ai-chat-empty');
    if (emptyState) emptyState.remove();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-chat-message assistant';
    messageDiv.id = 'ai-streaming-message';
    const avatar = document.createElement('div');
    avatar.className = 'ai-chat-message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';
    const messageContent = document.createElement('div');
    messageContent.className = 'ai-chat-message-content';
    messageContent.innerHTML = '';
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    aiChatMessages.appendChild(messageDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    return { messageDiv, messageContent };
}

/**
 * Update streaming message content (escaped text, no final JSON formatting)
 */
function updateStreamingMessageContent(messageContentEl, text) {
    if (!messageContentEl) return;
    messageContentEl.innerHTML = escapeHtmlForStream(text);
    if (aiChatMessages) aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

/**
 * 添加消息到聊天窗口
 */
function addAIChatMessage(content, isUser = true) {
    if (!aiChatMessages) return;
    
    // 移除空状态提示
    const emptyState = aiChatMessages.querySelector('.ai-chat-empty');
    if (emptyState) {
        emptyState.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chat-message ${isUser ? 'user' : 'assistant'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'ai-chat-message-avatar';
    avatar.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'ai-chat-message-content';
    
    // 使用格式化函数处理内容
    if (isUser) {
        // 用户消息：纯文本
        messageContent.textContent = content;
    } else {
        // AI消息：支持格式化显示
        messageContent.innerHTML = formatMessageContent(content);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    aiChatMessages.appendChild(messageDiv);
    
    // 滚动到底部
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

/**
 * 显示输入中状态
 */
function showAITyping() {
    if (!aiChatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-chat-message assistant typing';
    messageDiv.id = 'ai-typing-message';
    
    const avatar = document.createElement('div');
    avatar.className = 'ai-chat-message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'ai-chat-message-content';
    messageContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    aiChatMessages.appendChild(messageDiv);
    
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

/**
 * 移除输入中状态
 */
function removeAITyping() {
    if (!aiChatMessages) return;
    
    const typingMessage = document.getElementById('ai-typing-message');
    if (typingMessage) {
        typingMessage.remove();
    }
}

/**
 * 构建发送给Dify的请求数据
 */
function buildDifyPayload(userInput, latestFeature) {
    const inputs = {
        user_input: userInput  // 工作流变量名，后续可在Dify中修改
    };
    
    // 如果有最新添加的要素，添加到inputs中
    if (latestFeature) {
        // 构建要素信息对象
        const featureInfo = {
            type: latestFeature.type,  // 'point', 'line', 'polygon'
            name: latestFeature.properties?.name || '未命名',
            gid: latestFeature.properties?.gid || latestFeature.id || latestFeature.properties?.id || null,
            geometry_type: latestFeature.geometry?.type,
            coordinates: latestFeature.geometry?.coordinates,
            properties: latestFeature.properties,
            saved_at: latestFeature.savedAt
        };
        
        // Dify 工作流中的 latest_feature 如果是 text-input 类型，需要传递字符串
        // 将对象序列化为格式化的 JSON 字符串，便于 Dify 解析
        try {
            // 使用 JSON.stringify 将对象转换为字符串
            // 第二个参数 null 表示不进行过滤，第三个参数 2 表示缩进2个空格，便于阅读
            inputs.latest_feature = JSON.stringify(featureInfo, null, 2);
            
            // 调试信息：输出序列化后的内容
            console.log('latest_feature 已序列化为字符串:', inputs.latest_feature.substring(0, 200) + '...');
        } catch (error) {
            console.warn('序列化 latest_feature 失败，使用简化格式:', error);
            // 如果序列化失败（例如循环引用），使用简化格式
            inputs.latest_feature = `类型: ${featureInfo.type}\n名称: ${featureInfo.name}\nID: ${featureInfo.gid || '未知'}\n几何类型: ${featureInfo.geometry_type || '未知'}`;
        }
    }
    
    return {
        inputs: inputs,
        response_mode: 'blocking',
        user: 'map_user'
    };
}

/**
 * Build Dify payload for streaming (response_mode: 'streaming')
 */
function buildDifyPayloadStreaming(userInput, latestFeature) {
    const base = buildDifyPayload(userInput, latestFeature);
    return { ...base, response_mode: 'streaming' };
}

/**
 * 调用Dify Workflow API（阻塞模式）
 */
async function callDifyWorkflow(payload) {
    if (!difyConfig.loaded) {
        throw new Error('Dify配置未加载，请刷新页面重试');
    }
    
    const url = `${difyConfig.url}/workflows/run`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${difyConfig.key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData.code) {
                errorMessage = `${errorData.code}: ${errorData.message || '未知错误'}`;
            }
        } catch (e) {
            // 如果响应不是JSON，使用默认错误信息
        }
        throw new Error(errorMessage);
    }
    
    return await response.json();
}

/**
 * Call Dify Workflow API in streaming mode; parses SSE and calls onChunk(fullTextSoFar), onDone(fullText).
 * @param {Object} payload - Same as blocking but response_mode: 'streaming'
 * @param {{ onChunk: function(string), onDone: function(string) }} callbacks
 */
async function callDifyWorkflowStreaming(payload, callbacks) {
    if (!difyConfig.loaded) {
        throw new Error('Dify配置未加载，请刷新页面重试');
    }
    const url = `${difyConfig.url}/workflows/run`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${difyConfig.key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.message) errorMessage = errorData.message;
        } catch (e) { /* ignore */ }
        throw new Error(errorMessage);
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        const data = await response.json();
        const fullText = parseDifyResponse(data);
        if (callbacks.onChunk) callbacks.onChunk(fullText);
        if (callbacks.onDone) callbacks.onDone(fullText);
        return;
    }
    let fullText = '';
    const extractTextFromEvent = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const d = obj.data;
        if (d && typeof d === 'object') {
            if (typeof d.text === 'string') return d.text;
            if (typeof d.output === 'string') return d.output;
            if (d.outputs && typeof d.outputs === 'object') {
                const keys = Object.keys(d.outputs);
                for (let i = 0; i < keys.length; i++) {
                    const nodeOut = d.outputs[keys[i]];
                    if (nodeOut && typeof nodeOut.output === 'string') return nodeOut.output;
                    if (typeof nodeOut === 'string') return nodeOut;
                }
            }
        }
        if (typeof obj.output === 'string') return obj.output;
        if (typeof obj.text === 'string') return obj.text;
        return null;
    };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]' || jsonStr === '') continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        const delta = extractTextFromEvent(data);
                        if (delta) {
                            fullText += delta;
                            if (callbacks.onChunk) callbacks.onChunk(fullText);
                        }
                    } catch (e) { /* skip malformed line */ }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
    if (callbacks.onDone) callbacks.onDone(fullText);
}

/**
 * 提取输出内容（递归提取）
 * @param {*} output - 输出内容（可能是字符串、对象、数组等）
 * @returns {string} 提取的文本内容
 */
function extractOutputContent(output) {
    // 如果是字符串，直接返回
    if (typeof output === 'string') {
        return output;
    }
    
    // 如果是 null 或 undefined
    if (output === null || output === undefined) {
        return '';
    }
    
    // 如果是对象，尝试提取常见字段
    if (typeof output === 'object') {
        // 如果是数组，提取第一个元素
        if (Array.isArray(output)) {
            if (output.length > 0) {
                return extractOutputContent(output[0]);
            }
            return '';
        }
        
        // 尝试常见的输出字段名（按优先级排序）
        const commonFields = ['text', 'answer', 'result', 'content', 'message', 'output', 'data', 'value'];
        for (const field of commonFields) {
            if (output[field] !== undefined && output[field] !== null) {
                const extracted = extractOutputContent(output[field]);
                if (extracted && extracted.trim()) {  // 确保提取的内容不为空
                    return extracted;
                }
            }
        }
        
        // 如果对象有多个键，尝试提取第一个非空值
        const keys = Object.keys(output);
        for (const key of keys) {
            if (output[key] !== undefined && output[key] !== null) {
                const extracted = extractOutputContent(output[key]);
                if (extracted) {
                    return extracted;
                }
            }
        }
        
        // 如果都没找到，转换为格式化的JSON（用于调试）
        return JSON.stringify(output, null, 2);
    }
    
    // 其他类型转换为字符串
    return String(output);
}

/**
 * Parse Agent reply for <<STATUS:SUCCESS>> or <<STATUS:FAILURE>> at end of text.
 * Used to decide whether to refresh map layers after Agent create/update/delete.
 *
 * Expected model reply format (see docs/模型服务返回数据结构说明.md):
 * - Dify API returns: { data: { status, outputs: { <nodeId>: { output: "<string>" } } } or data.output }
 * - Reply string must end with <<STATUS:SUCCESS>> to trigger map refresh, or <<STATUS:FAILURE>> for failure.
 * - displayText shown to user has this suffix stripped.
 *
 * @param {string} text - Full reply text from Agent node (extracted from data.outputs or data.output)
 * @returns {{ displayText: string, status: string|null }} displayText has marker stripped; status is 'SUCCESS'|'FAILURE' or null
 */
function parseAgentStatus(text) {
    if (!text || typeof text !== 'string') {
        return { displayText: text || '', status: null };
    }
    const statusMatch = text.match(/\s*<<STATUS:(SUCCESS|FAILURE)>>\s*$/);
    const status = statusMatch ? statusMatch[1] : null;
    const displayText = statusMatch ? text.slice(0, statusMatch.index).trim() : text;
    return { displayText, status };
}

/**
 * 解析Dify响应
 * @param {Object} response - Dify API响应
 * @returns {string} 提取的文本内容
 */
function parseDifyResponse(response) {
    // 调试：输出完整响应结构（开发时使用）
    console.log('=== Dify 完整响应结构 ===');
    console.log(JSON.stringify(response, null, 2));
    console.log('========================');
    
    // 检查响应结构
    if (!response || !response.data) {
        console.warn('响应格式错误，响应结构:', response);
        return '响应格式错误，请检查 Dify 工作流配置。\n\n提示：请查看浏览器控制台了解详细错误信息。';
    }
    
    const data = response.data;
    
    // 检查状态
    if (data.status === 'failed') {
        const errorMsg = data.error || data.message || '工作流执行失败';
        console.error('工作流执行失败:', errorMsg);
        throw new Error(errorMsg);
    }
    
    if (data.status !== 'succeeded') {
        return `工作流状态: ${data.status}，请稍候...`;
    }
    
    // 方案1: 优先从 outputs 中提取（多个输出节点的情况）
    // Dify 工作流可能有多个输出节点，outputs 是一个对象，键是节点ID
    if (data.outputs && typeof data.outputs === 'object') {
        const outputKeys = Object.keys(data.outputs);
        if (outputKeys.length > 0) {
            console.log('找到输出节点:', outputKeys);
            
            // 遍历所有输出节点，提取内容
            for (const nodeId of outputKeys) {
                const nodeOutput = data.outputs[nodeId];
                if (nodeOutput && nodeOutput.output !== undefined) {
                    const content = extractOutputContent(nodeOutput.output);
                    if (content) {
                        console.log(`从节点 ${nodeId} 提取内容:`, content.substring(0, 100) + '...');
                        return content;
                    }
                }
            }
            
            // 如果 outputs 中的节点没有 output 字段，尝试直接提取 outputs 的值
            for (const nodeId of outputKeys) {
                const content = extractOutputContent(data.outputs[nodeId]);
                if (content) {
                    console.log(`从节点 ${nodeId} 直接提取内容:`, content.substring(0, 100) + '...');
                    return content;
                }
            }
        }
    }
    
    // 方案2: 从 output 字段提取（单个输出节点的情况）
    if (data.output !== undefined) {
        const content = extractOutputContent(data.output);
        if (content) {
            console.log('从 output 字段提取内容:', content.substring(0, 100) + '...');
            return content;
        }
    }
    
    // 方案3: 尝试从 data 的直接字段提取（如 result, content 等）
    // 这些字段可能在 data 的顶层，也可能在 data.output 中
    const alternativeFields = ['result', 'content', 'message', 'text', 'answer', 'outputs'];
    for (const field of alternativeFields) {
        if (data[field] !== undefined) {
            const content = extractOutputContent(data[field]);
            if (content && content.trim()) {  // 确保内容不为空
                console.log(`从 data.${field} 字段提取内容:`, content.substring(0, 100) + '...');
                return content;
            }
        }
    }
    
    // 方案4: 如果 data.output 是对象，直接检查其内部字段
    if (data.output && typeof data.output === 'object' && !Array.isArray(data.output)) {
        const outputObj = data.output;
        // 检查 output 对象中的常见字段
        const outputFields = ['result', 'text', 'answer', 'content', 'message', 'output'];
        for (const field of outputFields) {
            if (outputObj[field] !== undefined) {
                const content = extractOutputContent(outputObj[field]);
                if (content && content.trim()) {
                    console.log(`从 data.output.${field} 字段提取内容:`, content.substring(0, 100) + '...');
                    return content;
                }
            }
        }
        
        // 如果 output 对象只有一个键，直接提取该键的值
        const outputKeys = Object.keys(outputObj);
        if (outputKeys.length === 1) {
            const content = extractOutputContent(outputObj[outputKeys[0]]);
            if (content && content.trim()) {
                console.log(`从 data.output.${outputKeys[0]} 提取内容:`, content.substring(0, 100) + '...');
                return content;
            }
        }
    }
    
    // 如果都没找到，返回提示信息和完整响应（用于调试）
    console.warn('无法提取输出内容，完整响应:', data);
    return '工作流执行成功，但无法提取输出内容。\n\n' +
           '提示：\n' +
           '1. 请检查 Dify 工作流是否配置了输出节点\n' +
           '2. 请查看浏览器控制台了解响应结构\n' +
           '3. 响应数据: ' + JSON.stringify(data, null, 2).substring(0, 500) + '...';
}

/**
 * 执行AI指令
 */
async function executeAICommand(command) {
    if (!command || !command.trim()) {
        return;
    }
    
    // 添加用户消息
    addAIChatMessage(command, true);
    
    // 清空输入框
    if (aiChatInput) {
        aiChatInput.value = '';
        aiChatInput.style.height = 'auto';
    }
    
    // 创建流式输出的助手消息容器（不再显示“思考中”动画）
    const { messageDiv: streamingMessageDiv, messageContent: streamingContent } = createStreamingMessageContainer();
    
    // 禁用按钮
    if (aiChatExecuteBtn) {
        aiChatExecuteBtn.disabled = true;
    }
    
    try {
        // 1. 确保Dify配置已加载
        if (!difyConfig.loaded) {
            const loaded = await loadDifyConfig();
            if (!loaded) {
                throw new Error('无法加载Dify配置，请检查配置文件');
            }
        }
        
        // 2. 获取当前绘制完成但未保存的要素
        // 注意：聊天功能和保存功能是独立的
        // 用户流程：绘制要素 -> 打开聊天窗口 -> 输入语义信息 -> 执行
        // 只获取当前绘制完成但未保存的要素（planningTool.currentFeature）
        // 如果用户没有绘制，位置信息就不存在（latestFeature = null）
        let latestFeature = null;
        
        console.log('[DEBUG] ========== 获取当前绘制的要素 ==========');
        
        // 检查 planningTool 是否存在
        if (typeof planningTool === 'undefined') {
            console.log('[DEBUG] planningTool 不存在');
        } else {
            console.log('[DEBUG] planningTool 状态:', {
                currentFeature_exists: !!planningTool.currentFeature,
                currentDrawingType: planningTool.currentDrawingType
            });
            
            // 获取当前绘制完成但未保存的要素
            if (planningTool.currentFeature) {
                const currentFeature = planningTool.currentFeature;
                
                // 验证 currentFeature 是否有有效的几何数据
                if (currentFeature.geometry && currentFeature.geometry.coordinates) {
                    // 确定要素类型
                    let featureType = null;
                    if (currentFeature.geometry) {
                        if (currentFeature.geometry.type === 'Point') {
                            featureType = 'point';
                        } else if (currentFeature.geometry.type === 'LineString' || currentFeature.geometry.type === 'MultiLineString') {
                            featureType = 'line';
                        } else if (currentFeature.geometry.type === 'Polygon' || currentFeature.geometry.type === 'MultiPolygon') {
                            featureType = 'polygon';
                        }
                    }
                    
                    // 如果无法从几何类型确定，尝试从 currentDrawingType 获取
                    if (!featureType && planningTool.currentDrawingType) {
                        featureType = planningTool.currentDrawingType;
                    }
                    
                    if (featureType) {
                        // 创建要素副本（避免循环引用）
                        latestFeature = {
                            ...currentFeature,
                            type: featureType,
                            savedAt: null  // 未保存，所以没有保存时间
                        };
                        
                        // 确保坐标数据存在
                        if (latestFeature.geometry && latestFeature.geometry.coordinates) {
                            console.log('[DEBUG] ✅ 获取到当前绘制的要素（未保存）:', {
                                type: latestFeature.type,
                                geometry_type: latestFeature.geometry.type,
                                coordinates_preview: JSON.stringify(latestFeature.geometry.coordinates).substring(0, 200)
                            });
                        } else {
                            console.warn('[WARN] currentFeature 缺少坐标数据');
                            latestFeature = null;
                        }
                    } else {
                        console.warn('[WARN] 无法确定 currentFeature 的要素类型');
                    }
                } else {
                    console.warn('[WARN] currentFeature 缺少几何数据');
                }
            } else {
                console.log('[DEBUG] 用户未绘制要素，位置信息不存在');
            }
        }
        
        // 3. 构建流式请求数据
        const payload = buildDifyPayloadStreaming(command, latestFeature);
        console.log('发送给Dify的请求数据(streaming):', payload);
        
        // 4. 流式调用Dify API
        await callDifyWorkflowStreaming(payload, {
            onChunk: function (text) {
                if (streamingContent) updateStreamingMessageContent(streamingContent, text);
            },
            onDone: function (fullText) {
                const { displayText, status } = parseAgentStatus(fullText);
                if (status === 'SUCCESS' && typeof window.reloadAllData === 'function') {
                    window.reloadAllData().catch(function (e) {
                        console.warn('Layer refresh after Agent success failed:', e);
                    });
                }
                if (streamingContent) {
                    streamingContent.innerHTML = formatMessageContent(displayText);
                    if (streamingMessageDiv) streamingMessageDiv.id = '';
                }
                if (aiChatMessages) aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
            }
        });
        
    } catch (error) {
        console.error('Dify API调用失败:', error);
        let fallbackText = '抱歉，处理您的请求时出现错误：' + error.message + '\n\n提示：请检查Dify配置和网络连接。';
        try {
            const localResponse = parseAICommand(command);
            fallbackText = '⚠️ Dify API调用失败，已切换到本地模式：\n\n' + localResponse;
        } catch (localError) { /* use fallbackText above */ }
        if (streamingContent) {
            streamingContent.innerHTML = formatMessageContent(fallbackText);
            if (streamingMessageDiv) streamingMessageDiv.id = '';
        }
        if (aiChatMessages) aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    } finally {
        if (aiChatExecuteBtn) {
            aiChatExecuteBtn.disabled = false;
        }
        if (aiChatInput) {
            aiChatInput.focus();
        }
    }
}

/**
 * 获取最近添加的要素信息（格式化）
 */
function formatRecentFeatures(features) {
    if (!features || features.length === 0) {
        return '暂无最近添加的要素。';
    }
    
    let result = `最近添加了 ${features.length} 个要素：\n\n`;
    
    features.forEach((feature, index) => {
        const typeMap = {
            'point': '村庄（点）',
            'line': '河渠（线）',
            'polygon': '水域（面）'
        };
        const typeName = typeMap[feature.type] || feature.type;
        const name = feature.properties?.name || '未命名';
        // 优先从 properties.gid 获取，其次从 feature.id，最后从 feature.properties.id
        const gid = feature.properties?.gid || feature.id || feature.properties?.id || '未知';
        const savedAt = feature.savedAt ? new Date(feature.savedAt).toLocaleString('zh-CN') : '未知时间';
        
        result += `${index + 1}. ${typeName} - ${name}\n`;
        result += `   ID: ${gid}\n`;
        result += `   添加时间: ${savedAt}\n`;
        
        // 显示坐标信息
        if (feature.geometry) {
            if (feature.geometry.type === 'Point') {
                const coords = feature.geometry.coordinates;
                result += `   坐标: [${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}]\n`;
            } else if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates;
                result += `   坐标点数: ${coords.length}\n`;
                if (coords.length > 0) {
                    result += `   起点: [${coords[0][0].toFixed(6)}, ${coords[0][1].toFixed(6)}]\n`;
                    result += `   终点: [${coords[coords.length - 1][0].toFixed(6)}, ${coords[coords.length - 1][1].toFixed(6)}]\n`;
                }
            } else if (feature.geometry.type === 'Polygon') {
                const coords = feature.geometry.coordinates[0];
                result += `   边界点数: ${coords.length}\n`;
            }
        }
        
        result += '\n';
    });
    
    return result;
}

/**
 * 解析AI指令（示例实现）
 * 可以根据实际需求扩展
 */
function parseAICommand(command) {
    const lowerCommand = command.toLowerCase();
    
    // 识别查询最近添加要素的指令
    if (lowerCommand.includes('最新') || lowerCommand.includes('最近') || lowerCommand.includes('刚添加') || 
        lowerCommand.includes('latest') || lowerCommand.includes('recent') || lowerCommand.includes('new')) {
        
        // 检查是否有获取最近要素的函数
        if (typeof getRecentFeatures === 'function') {
            const recentFeatures = getRecentFeatures(5);  // 获取最近5个
            return formatRecentFeatures(recentFeatures);
        } else if (typeof planningTool !== 'undefined' && planningTool.recentFeatures) {
            const recentFeatures = planningTool.recentFeatures.slice(0, 5);
            return formatRecentFeatures(recentFeatures);
        } else {
            return '无法获取最近添加的要素信息。请确保已成功保存至少一个要素。';
        }
    }
    
    // 识别创建要素的指令
    if (lowerCommand.includes('添加') || lowerCommand.includes('创建') || lowerCommand.includes('新建')) {
        if (lowerCommand.includes('村庄') || lowerCommand.includes('点') || lowerCommand.includes('point')) {
            return '已识别到创建村庄（点）要素的请求。\n\n请使用左侧的"绘制村庄"工具在地图上点击创建。绘制完成后，双击要素可以编辑信息。';
        } else if (lowerCommand.includes('河渠') || lowerCommand.includes('线') || lowerCommand.includes('line') || lowerCommand.includes('river')) {
            return '已识别到创建河渠（线）要素的请求。\n\n请使用左侧的"绘制河渠"工具在地图上绘制。左键点击绘制路径，右键结束绘制。';
        } else if (lowerCommand.includes('水域') || lowerCommand.includes('面') || lowerCommand.includes('水系') || lowerCommand.includes('polygon') || lowerCommand.includes('water')) {
            return '已识别到创建水域（面）要素的请求。\n\n请使用左侧的"绘制水域"工具在地图上绘制。左键点击绘制边界，右键结束绘制。';
        }
    }
    
    // 识别查询指令
    if (lowerCommand.includes('查询') || lowerCommand.includes('查找') || lowerCommand.includes('搜索') || lowerCommand.includes('search')) {
        let response = '您可以使用以下方式查询要素：\n1. 点击地图上的要素查看详细信息\n2. 右键点击要素可以删除\n3. 查看右上角的数据加载状态\n\n';
        
        // 如果有最近添加的要素，也显示
        if (typeof getRecentFeatures === 'function') {
            const recentFeatures = getRecentFeatures(3);
            if (recentFeatures.length > 0) {
                response += '\n最近添加的要素：\n';
                recentFeatures.forEach((feature, index) => {
                    const typeMap = {
                        'point': '村庄',
                        'line': '河渠',
                        'polygon': '水域'
                    };
                    const typeName = typeMap[feature.type] || feature.type;
                    const name = feature.properties?.name || '未命名';
                    const gid = feature.properties?.gid || feature.id || feature.properties?.id || '未知';
                    response += `${index + 1}. ${typeName} - ${name} (ID: ${gid})\n`;
                });
            }
        }
        
        return response;
    }
    
    // 识别帮助指令
    if (lowerCommand.includes('帮助') || lowerCommand.includes('help') || lowerCommand.includes('怎么') || lowerCommand.includes('如何')) {
        return '我可以帮助您：\n\n1. 创建要素\n   - 创建村庄（点）\n   - 创建河渠（线）\n   - 创建水域（面）\n\n2. 查询要素\n   - 查看要素信息\n   - 搜索要素\n   - 查看最近添加的要素（输入"最新"或"最近"）\n\n3. 编辑要素\n   - 修改要素属性\n   - 删除要素\n\n请告诉我您需要什么帮助？';
    }
    
    // 识别删除指令
    if (lowerCommand.includes('删除') || lowerCommand.includes('remove') || lowerCommand.includes('delete')) {
        return '要删除要素，请：\n1. 在地图上找到要删除的要素\n2. 右键点击该要素\n3. 选择"删除"选项\n\n注意：删除是软删除，数据不会真正从数据库中删除。';
    }
    
    // 默认响应
    return '我理解您的需求。\n\n我可以帮助您：\n1. 创建点、线、面要素\n2. 查询要素信息（输入"最新"查看最近添加的要素）\n3. 修改要素属性\n4. 删除要素\n\n请使用左侧的规划工具进行绘制，或告诉我您需要什么帮助。\n\n提示：\n- 绘制线/面要素时，左键绘制，右键结束\n- 双击已绘制的要素可以编辑信息\n- 输入"最新"可以查看最近添加的要素';
}

