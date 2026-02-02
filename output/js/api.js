/**
 * API调用模块
 * 封装所有与后端API的交互
 */

// API基础URL
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * 通用API请求函数
 * @param {string} url - API端点
 * @param {Object} options - fetch选项
 * @returns {Promise} 响应数据
 */
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}

// ==================== 村庄（点）API ====================

/**
 * 获取所有村庄
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function loadVillages() {
    return await apiRequest(`${API_BASE_URL}/villages`);
}

/**
 * 获取单个村庄
 * @param {number} gid - 村庄ID
 * @returns {Promise<Object>} GeoJSON Feature
 */
async function getVillage(gid) {
    return await apiRequest(`${API_BASE_URL}/villages/${gid}`);
}

/**
 * 创建村庄
 * @param {Object} feature - GeoJSON Feature对象
 * @returns {Promise<Object>} 创建结果
 */
async function createVillage(feature) {
    return await apiRequest(`${API_BASE_URL}/villages`, {
        method: 'POST',
        body: JSON.stringify(feature)
    });
}

/**
 * 更新村庄
 * @param {number} gid - 村庄ID
 * @param {Object} feature - GeoJSON Feature对象
 * @returns {Promise<Object>} 更新结果
 */
async function updateVillage(gid, feature) {
    return await apiRequest(`${API_BASE_URL}/villages/${gid}`, {
        method: 'PUT',
        body: JSON.stringify(feature)
    });
}

/**
 * 删除村庄
 * @param {number} gid - 村庄ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteVillage(gid) {
    return await apiRequest(`${API_BASE_URL}/villages/${gid}`, {
        method: 'DELETE'
    });
}

// ==================== 河渠（线）API ====================

/**
 * 获取所有河渠
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function loadRivers() {
    return await apiRequest(`${API_BASE_URL}/rivers`);
}

/**
 * 创建河渠
 * @param {Object} feature - GeoJSON Feature对象
 * @returns {Promise<Object>} 创建结果
 */
async function createRiver(feature) {
    return await apiRequest(`${API_BASE_URL}/rivers`, {
        method: 'POST',
        body: JSON.stringify(feature)
    });
}

/**
 * 更新河渠
 * @param {number} gid - 河渠ID
 * @param {Object} feature - GeoJSON Feature对象
 * @returns {Promise<Object>} 更新结果
 */
async function updateRiver(gid, feature) {
    return await apiRequest(`${API_BASE_URL}/rivers/${gid}`, {
        method: 'PUT',
        body: JSON.stringify(feature)
    });
}

/**
 * 删除河渠
 * @param {number} gid - 河渠ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteRiver(gid) {
    return await apiRequest(`${API_BASE_URL}/rivers/${gid}`, {
        method: 'DELETE'
    });
}

// ==================== 水系（面）API ====================

/**
 * 获取所有水系
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function loadWaterBodies() {
    return await apiRequest(`${API_BASE_URL}/water_bodies`);
}

/**
 * 创建水系
 * @param {Object} feature - GeoJSON Feature对象
 * @returns {Promise<Object>} 创建结果
 */
async function createWaterBody(feature) {
    return await apiRequest(`${API_BASE_URL}/water_bodies`, {
        method: 'POST',
        body: JSON.stringify(feature)
    });
}

/**
 * 更新水系
 * @param {number} gid - 水系ID
 * @param {Object} feature - GeoJSON Feature对象
 * @returns {Promise<Object>} 更新结果
 */
async function updateWaterBody(gid, feature) {
    return await apiRequest(`${API_BASE_URL}/water_bodies/${gid}`, {
        method: 'PUT',
        body: JSON.stringify(feature)
    });
}

/**
 * 删除水系
 * @param {number} gid - 水系ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteWaterBody(gid) {
    return await apiRequest(`${API_BASE_URL}/water_bodies/${gid}`, {
        method: 'DELETE'
    });
}

// ==================== 查询API ====================

/**
 * 按名称查询村庄
 * @param {string} name - 村庄名称（支持部分匹配）
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function searchVillagesByName(name) {
    return await apiRequest(`${API_BASE_URL}/villages?name=${encodeURIComponent(name)}`);
}

/**
 * 按名称查询河渠
 * @param {string} name - 河渠名称
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function searchRiversByName(name) {
    return await apiRequest(`${API_BASE_URL}/rivers?name=${encodeURIComponent(name)}`);
}

/**
 * 按名称查询水系
 * @param {string} name - 水系名称
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function searchWaterBodiesByName(name) {
    return await apiRequest(`${API_BASE_URL}/water_bodies?name=${encodeURIComponent(name)}`);
}

