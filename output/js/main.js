/**
 * 主控制模块
 * 整合所有功能，处理用户交互
 */

// 全局变量
let pointData = null;
let lineData = null;
let polygonData = null;
let placeNames = [];

/**
 * 从地图图层中提取GeoJSON数据
 * @param {Object} map - Leaflet地图对象
 * @returns {Object} 包含points, lines, polygons的GeoJSON数据
 */
function extractDataFromMap(map) {
    if (!map) {
        return { points: null, lines: null, polygons: null };
    }
    
    const result = {
        points: { type: 'FeatureCollection', features: [] },
        lines: { type: 'FeatureCollection', features: [] },
        polygons: { type: 'FeatureCollection', features: [] }
    };
    
    // 遍历地图上的所有图层
    map.eachLayer(function(layer) {
        // 检查是否是GeoJSON图层
        if (layer instanceof L.GeoJSON) {
            const geoJsonData = layer.toGeoJSON();
            
            // 根据几何类型分类
            if (geoJsonData.type === 'FeatureCollection') {
                geoJsonData.features.forEach(function(feature) {
                    const geomType = feature.geometry ? feature.geometry.type : null;
                    if (geomType === 'Point') {
                        result.points.features.push(feature);
                    } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                        result.lines.features.push(feature);
                    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                        result.polygons.features.push(feature);
                    }
                });
            } else if (geoJsonData.type === 'Feature') {
                const geomType = geoJsonData.geometry ? geoJsonData.geometry.type : null;
                if (geomType === 'Point') {
                    result.points.features.push(geoJsonData);
                } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                    result.lines.features.push(geoJsonData);
                } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                    result.polygons.features.push(geoJsonData);
                }
            }
        }
        // 检查是否是CircleMarker（点图层）
        else if (layer instanceof L.CircleMarker) {
            const latlng = layer.getLatLng();
            const popup = layer.getPopup();
            let properties = {};
            
            // 尝试从popup中提取属性信息
            if (popup && popup._content) {
                // 从popup HTML中提取name等信息
                const content = popup._content;
                // 简单的属性提取（可以根据实际情况调整）
                const nameMatch = content.match(/name[^>]*>([^<]+)/i);
                if (nameMatch) {
                    properties.name = nameMatch[1].trim();
                }
            }
            
            // 从tooltip中提取
            const tooltip = layer.getTooltip();
            if (tooltip && tooltip._content) {
                const tooltipContent = tooltip._content;
                const nameMatch = tooltipContent.match(/([^\s]+村)/);
                if (nameMatch && !properties.name) {
                    properties.name = nameMatch[1];
                }
            }
            
            const feature = {
                type: 'Feature',
                properties: properties,
                geometry: {
                    type: 'Point',
                    coordinates: [latlng.lng, latlng.lat]
                }
            };
            result.points.features.push(feature);
        }
    });
    
    return result;
}

/**
 * 从地图上的所有图层中提取要素数据
 * 包括CircleMarker、GeoJSON等所有图层
 */
function extractAllFeaturesFromMap(map) {
    if (!map) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const features = [];
    
    // 方法1：从GeoJSON图层提取
    map.eachLayer(function(layer) {
        if (layer instanceof L.GeoJSON) {
            const geoJsonData = layer.toGeoJSON();
            if (geoJsonData.type === 'FeatureCollection') {
                features.push(...geoJsonData.features);
            } else if (geoJsonData.type === 'Feature') {
                features.push(geoJsonData);
            }
        }
    });
    
    // 方法2：从CircleMarker提取（点图层）
    map.eachLayer(function(layer) {
        if (layer instanceof L.CircleMarker) {
            const latlng = layer.getLatLng();
            const popup = layer.getPopup();
            let properties = {};
            
            // 从popup中提取属性
            if (popup && popup._content) {
                const content = typeof popup._content === 'string' ? popup._content : popup._content.innerHTML || '';
                // 提取name字段
                const nameMatch = content.match(/name[^>]*>([^<]+)/i) || 
                                 content.match(/([^\s]+村[^\s]*)/);
                if (nameMatch) {
                    properties.name = nameMatch[1].trim();
                }
                
                // 提取其他属性
                const propMatches = content.matchAll(/<td[^>]*>([^<]+)<\/td>/g);
                let propName = null;
                for (const match of propMatches) {
                    if (propName) {
                        properties[propName] = match[1].trim();
                        propName = null;
                    } else {
                        propName = match[1].trim().replace(':', '');
                    }
                }
            }
            
            // 从tooltip中提取
            const tooltip = layer.getTooltip();
            if (tooltip && tooltip._content) {
                const tooltipContent = typeof tooltip._content === 'string' ? tooltip._content : tooltip._content.innerHTML || '';
                if (!properties.name) {
                    const nameMatch = tooltipContent.match(/([^\s]+村[^\s]*)/);
                    if (nameMatch) {
                        properties.name = nameMatch[1];
                    }
                }
            }
            
            // 如果没有提取到name，尝试从图层数据中获取
            if (!properties.name && layer.options && layer.options.name) {
                properties.name = layer.options.name;
            }
            
            features.push({
                type: 'Feature',
                properties: properties,
                geometry: {
                    type: 'Point',
                    coordinates: [latlng.lng, latlng.lat]
                }
            });
        }
    });
    
    return { type: 'FeatureCollection', features: features };
}

/**
 * 初始化标注功能
 */
async function initLabeling() {
    console.log('正在初始化标注功能...');
    
    // 获取地图对象
    var mapObj = typeof map !== 'undefined' ? map : getMapObject();
    if (!mapObj) {
        console.error('无法获取地图对象');
        showFeedback('error', '地图未初始化，请刷新页面重试');
        return;
    }
    
    window.map = mapObj; // 确保map变量可用
    
    // 优先从API加载数据（新方式）
    try {
        console.log('正在从API加载数据...');
        const [points, rivers, waterBodies] = await Promise.all([
            loadVillages().catch(e => {
                console.warn('API加载失败，尝试从文件加载:', e);
                return loadGeoJSON('data/points.geojson');
            }),
            loadRivers().catch(e => {
                console.warn('API加载失败，尝试从文件加载:', e);
                return loadGeoJSON('data/lines.geojson');
            }),
            loadWaterBodies().catch(e => {
                console.warn('API加载失败，尝试从文件加载:', e);
                return loadGeoJSON('data/polygons.geojson');
            })
        ]);
        
        pointData = points;
        lineData = rivers;
        polygonData = waterBodies;
        
        // 提取地名列表
        if (pointData && pointData.features) {
            placeNames = pointData.features
                .map(f => f.properties?.name)
                .filter(name => name && name.trim() !== '')
                .filter((name, index, self) => self.indexOf(name) === index); // 去重
        }
        
        console.log('数据加载完成:', {
            points: pointData?.features?.length || 0,
            rivers: lineData?.features?.length || 0,
            waterBodies: polygonData?.features?.length || 0,
            placeNames: placeNames.length
        });
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showFeedback('error', '加载数据失败，请检查API服务是否启动');
        
        // 回退到文件加载
        try {
            console.log('尝试从文件加载数据...');
            const [points, lines, polygons, names] = await Promise.all([
                loadGeoJSON('data/points.geojson'),
                loadGeoJSON('data/lines.geojson'),
                loadGeoJSON('data/polygons.geojson'),
                loadPlaceNames('data/place_names.json')
            ]);
            
            pointData = points;
            lineData = lines;
            polygonData = polygons;
            placeNames = names || [];
            
            console.log('从文件加载数据完成');
        } catch (fileError) {
            console.error('文件加载也失败:', fileError);
            showFeedback('error', '数据加载失败，请检查API服务或文件路径');
            return;
        }
    }
    
    // 设置输入提示
    setupAutocomplete();
    
    // 恢复已保存的标注
    if (pointData) {
        loadLabels(mapObj, pointData);
    }
    
    // 绑定事件
    bindEvents();
    
    console.log('标注功能初始化完成');
}

/**
 * 加载GeoJSON文件
 * @param {string} url - 文件路径
 * @returns {Promise<Object>} GeoJSON对象
 */
async function loadGeoJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn(`加载 ${url} 失败:`, error);
        return null;
    }
}

/**
 * 加载地名列表
 * @param {string} url - 文件路径
 * @returns {Promise<Array>} 地名数组
 */
async function loadPlaceNames(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn(`加载地名列表失败:`, error);
        return [];
    }
}

/**
 * 设置自动完成功能
 */
function setupAutocomplete() {
    const input = document.getElementById('label-input');
    if (!input) {
        return;
    }
    
    // 创建datalist
    const datalist = document.getElementById('command-examples');
    if (datalist && placeNames.length > 0) {
        // 添加示例命令
        placeNames.slice(0, 10).forEach(name => {
            const option = document.createElement('option');
            option.value = `标注${name}`;
            datalist.appendChild(option);
        });
    }
    
    // 实时输入提示
    input.addEventListener('input', function(e) {
        const value = e.target.value.toLowerCase();
        if (value.length > 0) {
            // 可以在这里添加实时验证
            validateInput(value);
        }
    });
}

/**
 * 验证输入
 * @param {string} text - 输入文本
 */
function validateInput(text) {
    const parsed = parseInstruction(text);
    const feedback = document.getElementById('label-feedback');
    
    if (!parsed) {
        // 输入无效，但不显示错误（用户可能还在输入）
        return;
    }
    
    // 可以在这里添加实时提示
}

/**
 * 绑定事件
 */
function bindEvents() {
    const interactBtn = document.getElementById('interact-btn');
    if (interactBtn) {
        interactBtn.addEventListener('click', processInteraction);
    }
    
    // 输入框回车键触发
    const input = document.getElementById('label-input');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                processInteraction();
            }
        });
    }
}

/**
 * 处理交互指令（统一入口）
 */
async function processInteraction() {
    const input = document.getElementById('label-input');
    if (!input) {
        return;
    }
    
    const text = input.value.trim();
    if (!text) {
        showFeedback('error', '请输入指令');
        return;
    }
    
    // 解析指令
    const parsed = parseInstruction(text);
    if (!parsed || !validateParsedResult(parsed)) {
        showFeedback('error', '无法解析指令，请检查格式是否正确\n示例：标注司辛庄村 或 移除标注司辛庄村');
        return;
    }
    
    // 根据操作类型执行不同的操作
    switch (parsed.action) {
        case '标注':
            processLabeling(parsed);
            break;
        case '移除标注':
            processRemoveLabel(parsed);
            break;
        case '清除所有标注':
            processClearAllLabels();
            break;
        default:
            showFeedback('error', `不支持的操作：${parsed.action}`);
    }
}

/**
 * 处理标注指令
 */
async function processLabeling(parsed) {
    const input = document.getElementById('label-input');
    if (!input) {
        return;
    }
    
    // parsed参数已从processInteraction传入
    if (!parsed) {
        return;
    }
    
    // 查找目标要素
    let targetFeatures = [];
    if (pointData) {
        targetFeatures = findFeaturesByName(pointData, parsed.target);
    }
    
    // 如果没找到，尝试从地图图层中重新提取数据
    if (targetFeatures.length === 0) {
        console.log('从pointData中未找到，尝试重新从地图提取数据...');
        var mapObj = typeof map !== 'undefined' ? map : getMapObject();
        if (mapObj) {
            const extractedData = extractAllFeaturesFromMap(mapObj);
            if (extractedData.features.length > 0) {
                pointData = extractedData;
                targetFeatures = findFeaturesByName(pointData, parsed.target);
                console.log('重新提取后找到', targetFeatures.length, '个匹配要素');
            }
        }
    }
    
    if (targetFeatures.length === 0) {
        // 提供更详细的错误信息
        console.log('查找要素失败:', {
            target: parsed.target,
            pointDataFeatures: pointData?.features?.length || 0,
            sampleNames: pointData?.features?.slice(0, 5).map(f => f.properties?.name) || []
        });
        showFeedback('error', `未找到名为"${parsed.target}"的要素\n提示：请检查要素名称是否正确，或尝试使用部分名称`);
        return;
    }
    
    // 如果有参考要素和空间关系，进行筛选
    if (parsed.reference && parsed.relation && pointData) {
        const referenceFeatures = findFeaturesByName(pointData, parsed.reference);
        
        if (referenceFeatures.length === 0) {
            showFeedback('error', `未找到参考要素"${parsed.reference}"`);
            return;
        }
        
        if (referenceFeatures.length > 1) {
            // 多个参考要素，使用第一个
            showFeedback('warning', `找到多个"${parsed.reference}"，使用第一个作为参考`);
        }
        
        const referencePoint = getFeatureCoordinates(referenceFeatures[0]);
        if (!referencePoint) {
            showFeedback('error', '无法获取参考要素坐标');
            return;
        }
        
        // 使用空间关系筛选目标要素
        targetFeatures = targetFeatures.filter(feature => {
            const targetPoint = getFeatureCoordinates(feature);
            if (!targetPoint) {
                return false;
            }
            return checkSpatialRelation(targetPoint, referencePoint, parsed.relation);
        });
        
        if (targetFeatures.length === 0) {
            showFeedback('error', `未找到满足空间关系"${parsed.relation}"的要素`);
            return;
        }
    }
    
    // 如果仍有多个目标要素，全部标注
    if (targetFeatures.length > 1) {
        showFeedback('warning', `找到 ${targetFeatures.length} 个匹配要素，将全部标注`);
    }
    
        // 添加标注
        let successCount = 0;
        var mapObj = typeof map !== 'undefined' ? map : getMapObject();
        if (mapObj) {
            window.map = mapObj; // 确保map变量可用
            targetFeatures.forEach(feature => {
                if (addLabel(feature, mapObj)) {
                    successCount++;
                    // 地图定位到第一个要素
                    if (successCount === 1) {
                        flyToFeature(feature, mapObj);
                    }
                }
            });
            
            // 更新标注列表
            updateLabelList();
            
            // 清空输入框
            const input = document.getElementById('label-input');
            if (input) {
                input.value = '';
            }
            
            // 显示成功消息
            if (successCount > 0) {
                showFeedback('success', `成功标注 ${successCount} 个要素`);
            } else {
                showFeedback('error', '标注失败');
            }
        } else {
            showFeedback('error', '地图未初始化，请刷新页面重试');
        }
}

/**
 * 处理移除标注指令
 */
async function processRemoveLabel(parsed) {
    if (!parsed || !parsed.target) {
        showFeedback('error', '未指定要移除的要素名称');
        return;
    }
    
    var mapObj = typeof map !== 'undefined' ? map : getMapObject();
    if (!mapObj) {
        showFeedback('error', '地图未初始化');
        return;
    }
    
    let removedCount = 0;
    const targetName = parsed.target.trim();
    const featuresToRemove = [];
    
    // 遍历已标注的要素
    if (typeof labelState !== 'undefined' && labelState.labeledFeatures) {
        labelState.labeledFeatures.forEach(function(featureId) {
            if (typeof labelState !== 'undefined' && labelState.labels) {
                const labelData = labelState.labels.get(featureId);
                if (labelData && labelData.feature) {
                    const featureName = labelData.feature.properties?.name || '';
                    if (featureName.includes(targetName) || targetName.includes(featureName)) {
                        featuresToRemove.push({
                            id: featureId,
                            gid: labelData.feature.properties?.gid || labelData.feature.id
                        });
                    }
                }
            }
        });
    }
    
    // 移除标注
    featuresToRemove.forEach(item => {
        if (typeof removeLabel !== 'undefined' && removeLabel(item.id, mapObj)) {
            removedCount++;
        }
    });
    
    // 更新标注列表
    if (typeof updateLabelList !== 'undefined') {
        updateLabelList();
    }
    
    const input = document.getElementById('label-input');
    if (input) {
        input.value = '';
    }
    
    if (removedCount > 0) {
        showFeedback('success', `成功移除 ${removedCount} 个标注`);
    } else {
        showFeedback('error', `未找到名为"${targetName}"的已标注要素`);
    }
}

/**
 * 处理清除所有标注指令
 */
async function processClearAllLabels() {
    var mapObj = typeof map !== 'undefined' ? map : getMapObject();
    if (!mapObj) {
        showFeedback('error', '地图未初始化');
        return;
    }
    
    if (typeof labelState !== 'undefined' && labelState.labeledFeatures && labelState.labeledFeatures.size === 0) {
        showFeedback('warning', '当前没有已标注的要素');
        return;
    }
    
    if (confirm('确定要清除所有标注吗？')) {
        if (typeof clearAllLabels !== 'undefined') {
            clearAllLabels(mapObj);
        }
        
        const input = document.getElementById('label-input');
        if (input) {
            input.value = '';
        }
        
        showFeedback('success', '已清除所有标注');
    }
}

/**
 * 显示反馈消息
 * @param {string} type - 类型：success, error, warning
 * @param {string} message - 消息内容
 */
function showFeedback(type, message) {
    const feedback = document.getElementById('label-feedback');
    if (!feedback) {
        console.log(`[${type}] ${message}`);
        return;
    }
    
    feedback.className = `feedback-area feedback-${type}`;
    feedback.textContent = message;
    feedback.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        feedback.style.display = 'none';
    }, 3000);
}

/**
 * 获取地图对象
 * 从Folium生成的变量中查找map对象
 */
function getMapObject() {
    // 方法1：从全局变量中查找
    for (var key in window) {
        if (key.startsWith('map_') && window[key] instanceof L.Map) {
            return window[key];
        }
    }
    
    // 方法2：从DOM元素ID查找
    var mapElements = document.querySelectorAll('.folium-map');
    if (mapElements.length > 0) {
        var mapId = mapElements[mapElements.length - 1].id;
        var mapVarName = 'map_' + mapId.split('_').pop();
        if (typeof window[mapVarName] !== 'undefined') {
            return window[mapVarName];
        }
    }
    
    return null;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // 等待地图初始化完成
        setTimeout(function() {
            // 获取map对象
            var mapObj = getMapObject();
            if (mapObj) {
                window.map = mapObj;
            }
            initLabeling();
        }, 1000);
    });
} else {
    // 页面已加载完成
    setTimeout(function() {
        // 获取map对象
        var mapObj = getMapObject();
        if (mapObj) {
            window.map = mapObj;
        }
        initLabeling();
    }, 1000);
}

