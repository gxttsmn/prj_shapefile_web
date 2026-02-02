/**
 * 自然语言解析模块
 * 使用正则表达式解析用户输入的标注指令
 */

/**
 * 标准化空间关系关键词
 * @param {string} relation - 原始关系关键词
 * @returns {string} 标准化后的关系关键词
 */
function normalizeRelation(relation) {
    const relationMap = {
        '以东': '以东', '东边': '以东', '东侧': '以东',
        '以西': '以西', '西边': '以西', '西侧': '以西',
        '以北': '以北', '北边': '以北', '北侧': '以北',
        '以南': '以南', '南边': '以南', '南侧': '以南',
        '附近': '附近', '周围': '附近'
    };
    return relationMap[relation] || relation;
}

/**
 * 解析自然语言指令
 * 支持的操作：
 * 1. 标注操作：
 *    - 简单标注："标注[要素名称]"
 *    - 带空间关系："标注[参考要素][空间关系]的[目标要素]"
 *    - 变体："[参考要素][空间关系]的[目标要素]"
 * 2. 移除标注："移除标注[要素名称]"
 * 3. 清除所有标注："清除所有标注" 或 "清除标注"
 * 
 * @param {string} text - 用户输入的文本
 * @returns {Object|null} 解析结果对象，包含 action, target, reference, relation
 */
function parseInstruction(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }
    
    const trimmedText = text.trim();
    if (!trimmedText) {
        return null;
    }
    
    // 模式：清除所有标注
    const clearPattern = /清除\s*(所有\s*)?标注/;
    if (clearPattern.test(trimmedText)) {
        return {
            action: '清除所有标注',
            target: null,
            reference: null,
            relation: null
        };
    }
    
    // 模式：移除标注
    const removePattern = /移除\s*标注\s*([^\s]+)/;
    let match = trimmedText.match(removePattern);
    if (match) {
        return {
            action: '移除标注',
            target: match[1],
            reference: null,
            relation: null
        };
    }
    
    // 模式2：带空间关系的标注 "标注[参考要素][空间关系]的[目标要素]"
    const pattern2 = /标注\s*([^\s]+)\s*(以东|以西|以北|以南|附近|东边|西边|北边|南边|东侧|西侧|北侧|南侧|周围)\s*的\s*([^\s]+)/;
    match = trimmedText.match(pattern2);
    if (match) {
        return {
            action: '标注',
            target: match[3],
            reference: match[1],
            relation: normalizeRelation(match[2])
        };
    }
    
    // 模式3：变体 "[参考要素][空间关系]的[目标要素]"
    const pattern3 = /([^\s]+)\s*(以东|以西|以北|以南|附近|东边|西边|北边|南边|东侧|西侧|北侧|南侧|周围)\s*的\s*([^\s]+)/;
    match = trimmedText.match(pattern3);
    if (match) {
        return {
            action: '标注',
            target: match[3],
            reference: match[1],
            relation: normalizeRelation(match[2])
        };
    }
    
    // 模式1：简单标注 "标注[要素名称]"
    const pattern1 = /标注\s*([^\s]+)/;
    match = trimmedText.match(pattern1);
    if (match) {
        return {
            action: '标注',
            target: match[1],
            reference: null,
            relation: null
        };
    }
    
    return null;
}

/**
 * 验证解析结果的有效性
 * @param {Object} parsed - 解析结果
 * @returns {boolean} 是否有效
 */
function validateParsedResult(parsed) {
    if (!parsed) {
        return false;
    }
    
    // 清除所有标注操作不需要target
    if (parsed.action === '清除所有标注') {
        return true;
    }
    
    // 移除标注和标注操作需要target
    if (!parsed.target || parsed.target.trim() === '') {
        return false;
    }
    
    // 如果有参考要素，必须有空间关系
    if (parsed.reference && !parsed.relation) {
        return false;
    }
    
    return true;
}

