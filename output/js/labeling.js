/**
 * 标注管理模块
 * 负责添加、移除、管理地图标注
 */

// 标注状态管理
const labelState = {
    labeledFeatures: new Set(),  // 已标注的要素ID集合
    labels: new Map()            // 标注对象映射 {featureId: {marker, label}}
};

/**
 * 添加标注到地图
 * @param {Object} feature - GeoJSON要素对象
 * @param {Object} map - Leaflet地图对象
 */
function addLabel(feature, map) {
    if (!feature || !map) {
        return false;
    }
    
    // 获取要素ID（优先使用gid，然后是id，最后生成唯一ID）
    const featureId = feature.properties?.gid || 
                      feature.id || 
                      feature.properties?.FID || 
                      `feature_${Date.now()}_${Math.random()}`;
    
    // 如果已经标注过，先移除旧标注
    if (labelState.labeledFeatures.has(featureId)) {
        removeLabel(featureId, map);
    }
    
    // 获取坐标
    const coords = getFeatureCoordinates(feature);
    if (!coords || coords.length < 2) {
        console.error('无法获取要素坐标');
        return false;
    }
    
    const [lon, lat] = coords;
    const name = feature.properties?.name || '未命名';
    
    // 创建高亮标记（增大、变色）
    const highlightMarker = L.circleMarker([lat, lon], {
        radius: 10,
        color: '#ff0000',
        fillColor: '#ffff00',
        fillOpacity: 0.8,
        weight: 3,
        className: 'label-highlight-marker'
    }).addTo(map);
    
    // 创建文字标签
    const label = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'custom-label',
            html: `<div style="font-size: 12px; color: #ff6b6b; font-weight: bold; 
                              background: white; padding: 2px 5px; border-radius: 3px;
                              border: 1px solid #ff6b6b; white-space: nowrap;
                              box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${name}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
        }),
        zIndexOffset: 1000  // 确保标签在最上层
    }).addTo(map);
    
    // 添加点击事件，显示要素信息
    const popupContent = formatFeaturePopup(feature);
    highlightMarker.bindPopup(popupContent);
    label.bindPopup(popupContent);
    
    // 保存标注状态
    labelState.labels.set(featureId, {
        marker: highlightMarker,
        label: label,
        feature: feature
    });
    labelState.labeledFeatures.add(featureId);
    
    // 保存到LocalStorage
    saveLabels();
    
    return true;
}

/**
 * 移除标注
 * @param {string} featureId - 要素ID
 * @param {Object} map - Leaflet地图对象
 */
function removeLabel(featureId, map) {
    const labelData = labelState.labels.get(featureId);
    if (labelData) {
        if (labelData.marker) {
            map.removeLayer(labelData.marker);
        }
        if (labelData.label) {
            map.removeLayer(labelData.label);
        }
        labelState.labels.delete(featureId);
        labelState.labeledFeatures.delete(featureId);
        
        // 更新LocalStorage
        saveLabels();
        return true;
    }
    return false;
}

/**
 * 清除所有标注
 * @param {Object} map - Leaflet地图对象
 */
function clearAllLabels(map) {
    labelState.labels.forEach((labelData, featureId) => {
        if (labelData.marker) {
            map.removeLayer(labelData.marker);
        }
        if (labelData.label) {
            map.removeLayer(labelData.label);
        }
    });
    
    labelState.labels.clear();
    labelState.labeledFeatures.clear();
    
    // 清除LocalStorage
    localStorage.removeItem('mapLabels');
    
    // 更新标注列表
    updateLabelList();
}

/**
 * 格式化要素弹窗内容
 * @param {Object} feature - GeoJSON要素对象
 * @returns {string} HTML内容
 */
function formatFeaturePopup(feature) {
    if (!feature || !feature.properties) {
        return '无属性信息';
    }
    
    const props = feature.properties;
    let html = '<div style="font-family: Microsoft YaHei, Arial, sans-serif;">';
    html += '<h4 style="margin: 0 0 10px 0; color: #ff6b6b;">要素信息</h4>';
    html += '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';
    
    Object.keys(props).forEach(key => {
        if (props[key] !== null && props[key] !== undefined && props[key] !== '') {
            html += `<tr>
                <td style="padding: 4px 8px; font-weight: bold; border-bottom: 1px solid #eee;">${key}:</td>
                <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${props[key]}</td>
            </tr>`;
        }
    });
    
    html += '</table></div>';
    return html;
}

/**
 * 保存标注到LocalStorage
 */
function saveLabels() {
    try {
        const labelsData = Array.from(labelState.labeledFeatures).map(id => {
            const labelData = labelState.labels.get(id);
            const coords = getFeatureCoordinates(labelData.feature);
            return {
                id: id,
                name: labelData.feature.properties?.name || '',
                coordinates: coords
            };
        });
        localStorage.setItem('mapLabels', JSON.stringify(labelsData));
    } catch (e) {
        console.error('保存标注失败:', e);
    }
}

/**
 * 从LocalStorage恢复标注
 * @param {Object} map - Leaflet地图对象
 * @param {Object} pointData - 点数据FeatureCollection
 */
function loadLabels(map, pointData) {
    try {
        const saved = localStorage.getItem('mapLabels');
        if (!saved) {
            return;
        }
        
        const labelsData = JSON.parse(saved);
        labelsData.forEach(data => {
            // 根据名称查找要素
            const features = findFeaturesByName(pointData, data.name);
            if (features.length > 0) {
                // 如果坐标匹配，使用该要素
                const feature = features.find(f => {
                    const coords = getFeatureCoordinates(f);
                    return coords && 
                           Math.abs(coords[0] - data.coordinates[0]) < 0.0001 &&
                           Math.abs(coords[1] - data.coordinates[1]) < 0.0001;
                }) || features[0];
                
                addLabel(feature, map);
            }
        });
        
        updateLabelList();
    } catch (e) {
        console.error('恢复标注失败:', e);
    }
}

/**
 * 更新标注列表显示
 */
function updateLabelList() {
    const listElement = document.getElementById('labeled-features-list');
    if (!listElement) {
        return;
    }
    
    listElement.innerHTML = '';
    
    if (labelState.labeledFeatures.size === 0) {
        listElement.innerHTML = '<li style="color: #999; padding: 10px;">暂无标注</li>';
        return;
    }
    
    labelState.labeledFeatures.forEach(id => {
        const labelData = labelState.labels.get(id);
        if (!labelData || !labelData.feature) {
            return;
        }
        
        const name = labelData.feature.properties?.name || '未命名';
        const item = document.createElement('li');
        item.className = 'label-item';
        item.innerHTML = `
            <span class="label-name">${name}</span>
            <button class="btn-remove" onclick="removeLabelById('${id}')" title="移除标注">×</button>
        `;
        listElement.appendChild(item);
    });
}

/**
 * 通过ID移除标注（供HTML调用）
 * @param {string} featureId - 要素ID
 */
function removeLabelById(featureId) {
    var mapObj = typeof map !== 'undefined' ? map : getMapObject();
    if (mapObj) {
        window.map = mapObj;
        removeLabel(featureId, mapObj);
        updateLabelList();
    }
}

/**
 * 地图定位到要素
 * @param {Object} feature - GeoJSON要素对象
 * @param {Object} map - Leaflet地图对象
 */
function flyToFeature(feature, map) {
    const coords = getFeatureCoordinates(feature);
    if (coords && coords.length >= 2) {
        const [lon, lat] = coords;
        map.flyTo([lat, lon], Math.max(map.getZoom(), 13), {
            animate: true,
            duration: 0.5
        });
    }
}

