/**
 * 规划工具模块
 * 支持点（村庄）、线（河渠）、面（水域）的绘制和创建
 */

// 全局变量
let planningTool = {
    map: null,
    drawControl: null,
    planningLayer: null,  // 临时图层，用于显示未保存的要素
    currentDrawingType: null,  // 当前绘制类型：'point', 'line', 'polygon'
    currentFeature: null,  // 当前绘制的要素
    isDrawing: false,
    recentFeatures: []  // 最近添加的要素列表（最多保存10个）
};

// 全局函数：获取最近添加的要素
function getRecentFeatures(limit = 10) {
    return planningTool.recentFeatures.slice(0, limit);
}

// 全局函数：获取最新添加的要素
function getLatestFeature() {
    return planningTool.recentFeatures.length > 0 ? planningTool.recentFeatures[0] : null;
}

/**
 * 初始化规划工具
 * @param {Object} map - Leaflet地图对象
 */
function initPlanningTool(map) {
    if (!map) {
        console.error('规划工具初始化失败：地图对象不存在');
        return;
    }
    
    planningTool.map = map;
    
    // 创建规划图层（用于临时显示未保存的要素）
    planningTool.planningLayer = new L.FeatureGroup();
    map.addLayer(planningTool.planningLayer);
    
    // 初始化绘制控件
    initDrawControl();
    
    // 绑定绘制事件
    bindDrawEvents();
    
    // 初始化工具面板
    initPlanningPanel();
    
    console.log('规划工具初始化完成');
}

/**
 * 初始化绘制控件
 */
function initDrawControl() {
    if (!planningTool.map) return;
    
    planningTool.drawControl = new L.Control.Draw({
        draw: {
            marker: {
                icon: L.icon({
                    iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/images/marker-icon.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                }),
                shapeOptions: {
                    color: '#ff6b6b',
                    fillColor: '#ff6b6b',
                    fillOpacity: 0.7
                }
            },
            polyline: {
                shapeOptions: {
                    color: '#4ecdc4',
                    weight: 3
                },
                metric: true,
                showLength: true,
                // 禁用双击结束，改为右键结束
                touchIcon: new L.DivIcon({
                    iconSize: new L.Point(8, 8),
                    className: 'leaflet-div-icon leaflet-editing-icon'
                })
            },
            polygon: {
                allowIntersection: false,
                showArea: true,
                metric: true,
                shapeOptions: {
                    color: '#45b7d1',
                    fillColor: '#45b7d1',
                    fillOpacity: 0.3,
                    weight: 2
                },
                // 禁用双击结束，改为右键结束
                touchIcon: new L.DivIcon({
                    iconSize: new L.Point(8, 8),
                    className: 'leaflet-div-icon leaflet-editing-icon'
                })
            },
            circle: false,
            rectangle: false,
            circlemarker: false
        },
        edit: {
            featureGroup: planningTool.planningLayer,
            remove: true
        }
    });
    
    // 默认不显示绘制控件（通过自定义按钮控制）
    // planningTool.map.addControl(planningTool.drawControl);
}

/**
 * 绑定绘制事件
 */
function bindDrawEvents() {
    if (!planningTool.map) return;
    
    // 绘制开始
    planningTool.map.on('draw:drawstart', function(e) {
        planningTool.isDrawing = true;
        planningTool.currentDrawingType = getDrawingType(e.layerType);
        console.log('开始绘制:', planningTool.currentDrawingType);
        
        // 保存绘制处理器
        planningTool._currentDrawHandler = e.handler;
        
        // 对于线和面，禁用双击结束，改为右键结束
        // 延迟添加事件监听，确保不影响 Leaflet Draw 的初始点击处理
        if (planningTool.currentDrawingType === 'line' || planningTool.currentDrawingType === 'polygon') {
            // 延迟添加事件监听，避免干扰绘制工具的初始化
            setTimeout(function() {
                // 拦截双击事件
                interceptDoubleClick();
                
                // 监听右键事件来结束绘制
                planningTool.map.on('contextmenu', finishDrawingOnRightClick);
            }, 100);
        }
    });
    
    // 绘制完成（通过右键结束）
    planningTool.map.on('draw:created', function(e) {
        try {
            const layer = e.layer;
            if (!layer) {
                console.error('绘制完成但图层为空');
                return;
            }
            
            // 验证图层是否有必要的方法
            if (!layer.toGeoJSON) {
                console.error('图层缺少 toGeoJSON 方法');
                return;
            }
            
            let feature = layer.toGeoJSON();
            if (!feature || !feature.geometry) {
                console.error('无法从图层提取要素数据');
                return;
            }
            
            // 调试：输出原始坐标
            console.log('[DEBUG] 绘制完成，原始要素坐标:', feature.geometry.coordinates);
            console.log('[DEBUG] 要素类型:', feature.geometry.type);
            console.log('[DEBUG] 图层类型:', layer.constructor.name);
            
            // 坐标格式检查和转换
            // 注意：Leaflet 的 toGeoJSON() 方法通常会自动将坐标从 [lat, lng] 转换为 GeoJSON 标准的 [lon, lat]
            // 但为了确保准确性，特别是对于 Marker，我们直接从图层获取坐标
            
            // 1. 点要素 (Point) - 直接从 Marker 获取坐标
            if (feature.geometry.type === 'Point' && layer.getLatLng) {
                const latlng = layer.getLatLng();
                console.log('[DEBUG] Marker 的 LatLng 对象:', latlng);
                console.log('[DEBUG] 纬度:', latlng.lat, '经度:', latlng.lng);
                
                // 直接从 Marker 获取坐标，转换为 GeoJSON 格式 [lon, lat]
                feature.geometry.coordinates = [latlng.lng, latlng.lat];
                console.log('[DEBUG] 修正后的点坐标 (GeoJSON格式 [lon, lat]):', feature.geometry.coordinates);
            }
            // 2. 线要素 (LineString) - 检查并修正坐标
            else if (feature.geometry.type === 'LineString' && layer.getLatLngs) {
                const latlngs = layer.getLatLngs();
                console.log('[DEBUG] Polyline 的 LatLngs 数组:', latlngs);
                
                // 检查 toGeoJSON() 返回的坐标格式
                const firstCoord = feature.geometry.coordinates[0];
                if (firstCoord && Array.isArray(firstCoord) && firstCoord.length === 2) {
                    const [first, second] = firstCoord;
                    // 如果第一个值看起来像纬度（-90 到 90），说明 toGeoJSON() 可能没有正确转换
                    if (Math.abs(first) <= 90 && Math.abs(second) <= 180 && Math.abs(second) > Math.abs(first)) {
                        console.warn('[WARN] 检测到线坐标顺序可能是 [lat, lng]，正在从图层重新获取并转换');
                        // 从图层重新获取坐标并转换
                        feature.geometry.coordinates = latlngs.map(latlng => {
                            if (Array.isArray(latlng)) {
                                return [latlng[1], latlng[0]];  // 转换为 [lon, lat]
                            } else if (latlng && latlng.lng !== undefined && latlng.lat !== undefined) {
                                return [latlng.lng, latlng.lat];
                            }
                            return latlng;
                        });
                        console.log('[DEBUG] 修正后的线坐标 (GeoJSON格式):', feature.geometry.coordinates);
                    } else {
                        console.log('[DEBUG] 线坐标格式正确，无需转换');
                    }
                }
            }
            // 3. 面要素 (Polygon) - 检查并修正坐标
            else if (feature.geometry.type === 'Polygon' && layer.getLatLngs) {
                const latlngs = layer.getLatLngs();
                console.log('[DEBUG] Polygon 的 LatLngs 数组:', latlngs);
                
                // 检查 toGeoJSON() 返回的坐标格式
                const firstRing = feature.geometry.coordinates[0];
                if (firstRing && Array.isArray(firstRing) && firstRing.length > 0) {
                    const firstCoord = firstRing[0];
                    if (Array.isArray(firstCoord) && firstCoord.length === 2) {
                        const [first, second] = firstCoord;
                        // 如果第一个值看起来像纬度（-90 到 90），说明 toGeoJSON() 可能没有正确转换
                        if (Math.abs(first) <= 90 && Math.abs(second) <= 180 && Math.abs(second) > Math.abs(first)) {
                            console.warn('[WARN] 检测到面坐标顺序可能是 [lat, lng]，正在从图层重新获取并转换');
                            // 从图层重新获取坐标并转换
                            if (Array.isArray(latlngs) && latlngs.length > 0) {
                                feature.geometry.coordinates = [latlngs.map(latlng => {
                                    if (Array.isArray(latlng)) {
                                        return [latlng[1], latlng[0]];  // 转换为 [lon, lat]
                                    } else if (latlng && latlng.lng !== undefined && latlng.lat !== undefined) {
                                        return [latlng.lng, latlng.lat];
                                    }
                                    return latlng;
                                })];
                                console.log('[DEBUG] 修正后的面坐标 (GeoJSON格式):', feature.geometry.coordinates);
                            }
                        } else {
                            console.log('[DEBUG] 面坐标格式正确，无需转换');
                        }
                    }
                }
            }
            
            // 保存当前要素（创建干净副本，避免循环引用）
            planningTool.currentFeature = createCleanFeature(feature);
            if (!planningTool.currentFeature) {
                console.error('无法创建干净的要素副本');
                return;
            }
            planningTool.currentFeature._layer = layer;  // 单独保存图层引用，不序列化
            
            // 调试：输出保存后的坐标
            console.log('[DEBUG] 保存后的要素坐标:', planningTool.currentFeature.geometry.coordinates);
            
            // 打印当前坐标数据（格式化输出）
            printFeatureCoordinates(planningTool.currentFeature);
            
            // 添加到规划图层
            if (planningTool.planningLayer) {
                planningTool.planningLayer.addLayer(layer);
            } else {
                console.error('规划图层未初始化');
                return;
            }
            
            // 绑定双击编辑事件
            bindDoubleClickEdit(layer);
            
            // 不立即显示编辑框，等待用户双击
            // showEditModal(feature, planningTool.currentDrawingType);
            
            planningTool.isDrawing = false;
            
            // 清理事件监听
            cleanupDrawingEvents();
            
            console.log('绘制完成，要素类型:', planningTool.currentDrawingType);
        } catch (error) {
            console.error('处理绘制完成事件失败:', error);
            planningTool.isDrawing = false;
            cleanupDrawingEvents();
        }
    });
    
    // 绘制取消
    planningTool.map.on('draw:drawstop', function(e) {
        planningTool.isDrawing = false;
        cleanupDrawingEvents();
    });
    
    // 绘制删除
    planningTool.map.on('draw:deleted', function(e) {
        const layers = e.layers;
        layers.eachLayer(function(layer) {
            planningTool.planningLayer.removeLayer(layer);
        });
    });
}

/**
 * 拦截双击事件（禁用默认的双击结束行为）
 */
function interceptDoubleClick() {
    if (!planningTool.map) return;
    
    // 移除之前的拦截（如果有）
    planningTool.map.off('dblclick', preventDoubleClickFinish);
    
    // 添加双击拦截，不使用捕获阶段，避免影响单击事件
    // 只在双击时拦截，不影响单击
    planningTool.map.on('dblclick', preventDoubleClickFinish);
}

/**
 * 阻止双击结束绘制
 */
function preventDoubleClickFinish(e) {
    // 只在绘制状态且是线或面时拦截双击
    if (planningTool.isDrawing && 
        (planningTool.currentDrawingType === 'line' || planningTool.currentDrawingType === 'polygon')) {
        // 阻止默认的双击结束行为
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
        }
        
        // 显示提示
        showDrawingHint('请使用右键结束绘制');
        setTimeout(() => {
            if (planningTool.isDrawing) {
                showDrawingHint(planningTool.currentDrawingType);
            }
        }, 1500);
        
        return false;
    }
    // 如果不是绘制状态，不拦截，让其他双击事件正常工作
}

/**
 * 清理绘制相关事件
 */
function cleanupDrawingEvents() {
    if (planningTool.map) {
        planningTool.map.off('contextmenu', finishDrawingOnRightClick);
        planningTool.map.off('dblclick', preventDoubleClickFinish);
    }
    planningTool._currentDrawHandler = null;
    planningTool._originalFinishShape = null;
}

/**
 * 右键结束绘制
 */
function finishDrawingOnRightClick(e) {
    if (!planningTool.isDrawing) return;
    
    // 只处理线和面的绘制
    if (planningTool.currentDrawingType !== 'line' && planningTool.currentDrawingType !== 'polygon') {
        return;
    }
    
    // 只处理右键点击（button === 2），不处理左键点击
    if (!e.originalEvent || e.originalEvent.button !== 2) {
        return;
    }
    
    // 阻止默认右键菜单
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    
    // 结束绘制
    if (planningTool._currentDrawHandler) {
        const handler = planningTool._currentDrawHandler;
        
        // 检查是否有足够的点
        const minPoints = planningTool.currentDrawingType === 'polygon' ? 3 : 2;
        const pointCount = handler._markers ? handler._markers.length : 0;
        
        if (pointCount >= minPoints) {
            // 对于面，需要确保闭合
            if (planningTool.currentDrawingType === 'polygon') {
                // 手动完成绘制
                handler._finishShape();
            } else {
                // 对于线，直接完成
                handler._finishShape();
            }
        } else {
            // 点数不足，提示用户
            const requiredPoints = planningTool.currentDrawingType === 'polygon' ? 3 : 2;
            showDrawingHint(`至少需要${requiredPoints}个点才能完成绘制`);
            setTimeout(() => {
                if (planningTool.isDrawing) {
                    showDrawingHint(planningTool.currentDrawingType);
                }
            }, 2000);
        }
    }
}


/**
 * 绑定双击编辑事件
 */
function bindDoubleClickEdit(layer) {
    if (!layer) return;
    
    // 移除之前的双击事件（如果有）
    layer.off('dblclick');
    
    // 绑定双击事件
    layer.on('dblclick', function(e) {
        // 阻止默认行为（地图放大）和事件传播
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
            e.originalEvent.stopImmediatePropagation();
        }
        
        // 阻止 Leaflet 的默认双击行为
        L.DomEvent.stop(e);
        
        // 获取要素
        let feature = null;
        
        // 优先使用保存的要素数据
        if (layer.feature) {
            // 创建干净的副本，避免循环引用
            feature = createCleanFeature(layer.feature);
        } else if (layer.toGeoJSON) {
            feature = layer.toGeoJSON();
        } else if (planningTool.currentFeature && planningTool.currentFeature._layer === layer) {
            // 创建干净的副本
            feature = createCleanFeature(planningTool.currentFeature);
        } else if (layer instanceof L.CircleMarker) {
            // 对于 CircleMarker，从坐标和属性构建要素
            const latlng = layer.getLatLng();
            feature = {
                type: 'Feature',
                properties: layer.feature?.properties ? JSON.parse(JSON.stringify(layer.feature.properties)) : {},
                geometry: {
                    type: 'Point',
                    coordinates: [latlng.lng, latlng.lat]
                }
            };
        }
        
        if (!feature) {
            console.warn('无法获取要素数据');
            return;
        }
        
        // 确保 gid 存在（从 layer 对象或 properties 中获取）
        if (!feature.properties) {
            feature.properties = {};
        }
        if (!feature.properties.gid && !feature.id) {
            // 尝试从 layer 对象获取 gid
            if (layer.featureGid !== undefined) {
                feature.properties.gid = layer.featureGid;
                feature.id = layer.featureGid;
            } else if (layer.feature?.properties?.gid) {
                feature.properties.gid = layer.feature.properties.gid;
                feature.id = layer.feature.properties.gid;
            }
        } else if (feature.id && !feature.properties.gid) {
            // 如果只有 id，也设置到 properties.gid
            feature.properties.gid = feature.id;
        } else if (feature.properties.gid && !feature.id) {
            // 如果只有 properties.gid，也设置到 id
            feature.id = feature.properties.gid;
        }
        
        // 确定要素类型
        let type = null;
        if (feature.geometry) {
            if (feature.geometry.type === 'Point') {
                type = 'point';
            } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                type = 'line';
            } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                type = 'polygon';
            }
        }
        
        // 如果从图层属性获取类型
        if (!type && layer.featureType) {
            const typeMap = {
                'villages': 'point',
                'rivers': 'line',
                'water_bodies': 'polygon'
            };
            type = typeMap[layer.featureType];
        }
        
        if (type) {
            // 保存当前要素引用（不包含图层引用，避免循环）
            planningTool.currentFeature = feature;
            planningTool.currentFeature._layer = layer;  // 单独保存图层引用，不序列化
            
            // 显示编辑模态框
            showEditModal(feature, type);
        }
    });
}

/**
 * 打印要素坐标数据（格式化输出）
 * @param {Object} feature - GeoJSON Feature对象
 */
function printFeatureCoordinates(feature) {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) {
        console.warn('[坐标输出] 要素缺少坐标数据');
        return;
    }
    
    const geomType = feature.geometry.type;
    const coords = feature.geometry.coordinates;
    
    console.log('========================================');
    console.log('【坐标数据输出】');
    console.log('要素类型:', geomType);
    
    try {
        if (geomType === 'Point') {
            // 点要素：输出一个点坐标 [lon, lat]
            console.log('坐标点:', coords);
            console.log('  经度:', coords[0]);
            console.log('  纬度:', coords[1]);
        } else if (geomType === 'LineString') {
            // 线要素：输出多个点坐标 [[lon, lat], [lon, lat], ...]
            console.log('坐标点数量:', coords.length);
            console.log('坐标点列表:');
            coords.forEach((point, index) => {
                console.log(`  点 ${index + 1}: [${point[0]}, ${point[1]}]`);
            });
            console.log('完整坐标数据:', JSON.stringify(coords, null, 2));
        } else if (geomType === 'Polygon') {
            // 面要素：输出一个闭环的坐标 [[[lon, lat], [lon, lat], ...]]
            // Polygon 的坐标是嵌套数组，第一个元素是外环
            const ring = coords[0];
            console.log('边界点数量:', ring.length);
            console.log('坐标点列表（闭环）:');
            ring.forEach((point, index) => {
                console.log(`  点 ${index + 1}: [${point[0]}, ${point[1]}]`);
            });
            // 检查是否闭合
            if (ring.length > 0) {
                const first = ring[0];
                const last = ring[ring.length - 1];
                const isClosed = first[0] === last[0] && first[1] === last[1];
                console.log('是否闭合:', isClosed ? '是' : '否');
            }
            console.log('完整坐标数据:', JSON.stringify(coords, null, 2));
        } else if (geomType === 'MultiLineString') {
            // 多线要素：输出多条线的坐标
            console.log('线段数量:', coords.length);
            coords.forEach((line, lineIndex) => {
                console.log(`线段 ${lineIndex + 1} (${line.length} 个点):`);
                line.forEach((point, pointIndex) => {
                    console.log(`  点 ${pointIndex + 1}: [${point[0]}, ${point[1]}]`);
                });
            });
            console.log('完整坐标数据:', JSON.stringify(coords, null, 2));
        } else if (geomType === 'MultiPolygon') {
            // 多面要素：输出多个面的坐标
            console.log('面数量:', coords.length);
            coords.forEach((polygon, polyIndex) => {
                const ring = polygon[0];
                console.log(`面 ${polyIndex + 1} (${ring.length} 个边界点):`);
                ring.forEach((point, pointIndex) => {
                    console.log(`  点 ${pointIndex + 1}: [${point[0]}, ${point[1]}]`);
                });
            });
            console.log('完整坐标数据:', JSON.stringify(coords, null, 2));
        } else {
            console.log('完整坐标数据:', JSON.stringify(coords, null, 2));
        }
    } catch (error) {
        console.error('[坐标输出] 输出坐标数据时出错:', error);
        console.log('原始坐标数据:', coords);
    }
    
    console.log('========================================');
}

/**
 * 创建干净的要素副本，避免循环引用
 */
function createCleanFeature(feature) {
    if (!feature) return null;
    
    // 创建新的要素对象，只包含必要的属性
    const cleanFeature = {
        type: feature.type || 'Feature',
        properties: feature.properties ? JSON.parse(JSON.stringify(feature.properties)) : {},
        geometry: feature.geometry ? JSON.parse(JSON.stringify(feature.geometry)) : null
    };
    
    // 如果有 id，也复制
    if (feature.id !== undefined) {
        cleanFeature.id = feature.id;
    }
    
    return cleanFeature;
}

/**
 * 获取绘制类型
 */
function getDrawingType(layerType) {
    const typeMap = {
        'marker': 'point',
        'polyline': 'line',
        'polygon': 'polygon'
    };
    return typeMap[layerType] || null;
}

/**
 * 开始绘制
 * @param {string} type - 绘制类型：'point', 'line', 'polygon'
 */
function startDrawing(type) {
    if (!planningTool.map || !planningTool.drawControl) {
        console.error('绘制工具未初始化');
        return;
    }
    
    // 取消当前绘制
    cancelDrawing();
    
    planningTool.currentDrawingType = type;
    
    // 根据类型启用对应的绘制工具
    let drawHandler = null;
    switch(type) {
        case 'point':
            drawHandler = new L.Draw.Marker(planningTool.map, planningTool.drawControl.options.draw.marker);
            break;
        case 'line':
            drawHandler = new L.Draw.Polyline(planningTool.map, planningTool.drawControl.options.draw.polyline);
            break;
        case 'polygon':
            drawHandler = new L.Draw.Polygon(planningTool.map, planningTool.drawControl.options.draw.polygon);
            break;
        default:
            console.error('未知的绘制类型:', type);
            return;
    }
    
    if (drawHandler) {
        try {
            drawHandler.enable();
            planningTool._currentDrawHandler = drawHandler;  // 保存引用以便取消
            console.log('绘制工具已启用，类型:', type);
        } catch (error) {
            console.error('启用绘制工具失败:', error);
            showDrawingHint('绘制工具启用失败，请重试');
            return;
        }
    } else {
        console.error('无法创建绘制处理器，类型:', type);
        return;
    }
    
    // 更新按钮状态
    updateButtonState(type);
    
    // 显示提示
    showDrawingHint(type);
}

/**
 * 取消绘制
 */
function cancelDrawing() {
    // 清理事件监听
    cleanupDrawingEvents();
    
    if (planningTool._currentDrawHandler) {
        planningTool._currentDrawHandler.disable();
        planningTool._currentDrawHandler = null;
    }
    
    // 清除未保存的要素
    if (planningTool.currentFeature && planningTool.currentFeature._layer) {
        planningTool.planningLayer.removeLayer(planningTool.currentFeature._layer);
        planningTool.currentFeature = null;
    }
    
    planningTool.currentDrawingType = null;
    planningTool.isDrawing = false;
    
    // 更新按钮状态
    updateButtonState(null);
    
    // 隐藏提示
    hideDrawingHint();
}

/**
 * 显示信息编辑模态框
 * @param {Object} feature - GeoJSON Feature对象
 * @param {string} type - 要素类型
 */
function showEditModal(feature, type) {
    // 验证 feature 数据
    if (!feature || !feature.geometry) {
        console.error('无效的要素数据:', feature);
        showModalError('要素数据无效，请重新绘制');
        return;
    }
    
    // 设置要素类型
    document.getElementById('feature-type-select').value = type;
    
    // 设置坐标信息
    const coords = extractCoordinates(feature, type);
    document.getElementById('coordinates-display').textContent = formatCoordinates(coords, type);
    document.getElementById('coordinates-detail').textContent = JSON.stringify(coords, null, 2);
    
    // 清空表单
    document.getElementById('feature-name').value = '';
    document.getElementById('feature-fclass').value = '';
    document.getElementById('feature-code').value = '';
    document.getElementById('feature-description').value = '';
    
    // 如果要素已有属性，填充表单
    if (feature.properties) {
        if (feature.properties.name) {
            document.getElementById('feature-name').value = feature.properties.name;
        }
        if (feature.properties.fclass) {
            document.getElementById('feature-fclass').value = feature.properties.fclass;
        }
        if (feature.properties.code) {
            document.getElementById('feature-code').value = feature.properties.code;
        }
        if (feature.properties.description) {
            document.getElementById('feature-description').value = feature.properties.description;
        }
    }
    
    // 根据类型设置默认值（如果表单为空）
    if (type === 'point' && !document.getElementById('feature-fclass').value) {
        document.getElementById('feature-fclass').value = 'village';
        document.getElementById('feature-code').value = '1003';
    } else if (type === 'line' && !document.getElementById('feature-fclass').value) {
        document.getElementById('feature-fclass').value = 'river';
    } else if (type === 'polygon' && !document.getElementById('feature-fclass').value) {
        document.getElementById('feature-fclass').value = 'water';
        document.getElementById('feature-code').value = '8200';
    }
    
    // 保存当前要素到模态框（用于保存时使用）
    try {
        // 创建干净的要素副本，避免循环引用
        const cleanFeature = createCleanFeature(feature);
        if (!cleanFeature) {
            throw new Error('无法创建干净的要素副本');
        }
        
        const featureStr = JSON.stringify(cleanFeature);
        const modalElement = document.getElementById('planning-edit-modal');
        if (modalElement) {
            modalElement.dataset.currentFeature = featureStr;
            console.log('[DEBUG] 要素数据已保存到模态框，类型:', type);
        } else {
            console.error('模态框元素不存在');
            showModalError('界面元素错误，请刷新页面');
            return;
        }
    } catch (error) {
        console.error('保存要素数据失败:', error);
        showModalError('要素数据序列化失败: ' + error.message);
        return;
    }
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('planning-edit-modal'));
    modal.show();
}

/**
 * 提取坐标信息
 */
function extractCoordinates(feature, type) {
    if (!feature || !feature.geometry) return null;
    
    const geom = feature.geometry;
    
    switch(type) {
        case 'point':
            return geom.coordinates;  // [lon, lat]
        case 'line':
            return geom.coordinates;  // [[lon, lat], ...]
        case 'polygon':
            // 确保面闭合
            let coords = geom.coordinates[0];
            if (coords.length > 0) {
                const first = coords[0];
                const last = coords[coords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    coords.push([first[0], first[1]]);
                }
            }
            return [coords];  // [[[lon, lat], ...]]
        default:
            return null;
    }
}

/**
 * 格式化坐标显示
 */
function formatCoordinates(coords, type) {
    if (!coords) return '无坐标';
    
    switch(type) {
        case 'point':
            return `经度: ${coords[0].toFixed(6)}, 纬度: ${coords[1].toFixed(6)}`;
        case 'line':
            return `共 ${coords.length} 个点`;
        case 'polygon':
            const pointCount = coords[0] ? coords[0].length : 0;
            return `共 ${pointCount} 个点（已闭合）`;
        default:
            return '未知类型';
    }
}

/**
 * 验证表单
 */
function validateForm() {
    const name = document.getElementById('feature-name').value.trim();
    const type = document.getElementById('feature-type-select').value;
    
    if (!name) {
        showModalError('名称不能为空');
        return false;
    }
    
    if (name.length > 100) {
        showModalError('名称长度不能超过100个字符');
        return false;
    }
    
    return true;
}

/**
 * 保存要素
 */
async function saveFeature() {
    // 防止重复保存
    const saveBtn = document.getElementById('save-feature-btn');
    if (saveBtn.disabled) {
        console.warn('保存操作正在进行中，请勿重复点击');
        return;
    }
    
    // 验证表单
    if (!validateForm()) {
        return;
    }
    
    // 获取当前要素（优先从 dataset 获取，失败则从 planningTool.currentFeature 恢复）
    let feature = null;
    let featureStr = document.getElementById('planning-edit-modal').dataset.currentFeature;
    
    if (!featureStr) {
        // 尝试从 planningTool.currentFeature 恢复
        if (planningTool.currentFeature) {
            console.warn('[WARN] dataset.currentFeature 丢失，从 planningTool.currentFeature 恢复');
            feature = JSON.parse(JSON.stringify(planningTool.currentFeature));  // 深拷贝
        } else {
            showModalError('要素数据丢失，请重新绘制');
            console.error('[ERROR] 要素数据完全丢失，无法恢复');
            return;
        }
    } else {
        try {
            feature = JSON.parse(featureStr);
        } catch (error) {
            console.error('解析要素数据失败:', error);
            // 尝试从 planningTool.currentFeature 恢复
            if (planningTool.currentFeature) {
                console.warn('[WARN] 解析失败，从 planningTool.currentFeature 恢复');
                feature = JSON.parse(JSON.stringify(planningTool.currentFeature));
            } else {
                showModalError('要素数据格式错误，请重新绘制');
                return;
            }
        }
    }
    
    // 验证要素数据完整性
    if (!feature || !feature.geometry || !feature.geometry.coordinates) {
        showModalError('要素数据不完整，请重新绘制');
        console.error('[ERROR] 要素数据不完整:', feature);
        return;
    }
    
    // 验证要素类型
    if (feature.type !== 'Feature') {
        showModalError('无效的要素格式，请重新绘制');
        console.error('[ERROR] 无效的要素类型:', feature.type);
        return;
    }
    
    // 调试：输出保存前的坐标数据
    console.log('[DEBUG] ========== 保存前的坐标检查 ==========');
    console.log('[DEBUG] 要素类型:', feature.geometry.type);
    console.log('[DEBUG] 坐标数据:', JSON.stringify(feature.geometry.coordinates, null, 2));
    if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates;
        console.log('[DEBUG] 点坐标 - 经度:', lon, '纬度:', lat);
        // 检查是否是异常坐标
        if (Math.abs(lon - 116.0) < 0.0001 && Math.abs(lat - 39.9999) < 0.0001) {
            console.error('[ERROR] ⚠️ 保存前就检测到异常坐标 (116.0, 39.9999)！');
        }
    }
    
    // 获取表单数据
    const name = document.getElementById('feature-name').value.trim();
    const fclass = document.getElementById('feature-fclass').value.trim();
    const code = document.getElementById('feature-code').value.trim();
    const description = document.getElementById('feature-description').value.trim();
    const type = document.getElementById('feature-type-select').value;
    
    // 检查是否是更新操作（已有 gid）
    const existingGid = feature.properties?.gid || feature.id;
    const isUpdate = existingGid !== undefined && existingGid !== null;
    
    // 更新属性（保留 gid）
    feature.properties = {
        ...feature.properties,  // 保留原有属性
        name: name
    };
    
    // 如果是更新操作，保留 gid
    if (isUpdate) {
        feature.properties.gid = existingGid;
        feature.id = existingGid;
    }
    
    if (fclass) feature.properties.fclass = fclass;
    if (code) feature.properties.code = parseInt(code) || code;
    if (description) feature.properties.description = description;
    
    // 调试：检查更新属性后坐标是否被修改
    console.log('[DEBUG] ========== 更新属性后的坐标检查 ==========');
    console.log('[DEBUG] 坐标数据:', JSON.stringify(feature.geometry.coordinates, null, 2));
    if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates;
        console.log('[DEBUG] 点坐标 - 经度:', lon, '纬度:', lat);
        if (Math.abs(lon - 116.0) < 0.0001 && Math.abs(lat - 39.9999) < 0.0001) {
            console.error('[ERROR] ⚠️ 更新属性后检测到异常坐标 (116.0, 39.9999)！');
        }
    }
    
    // 确保面闭合
    if (type === 'polygon' && feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0];
        if (coords.length > 0) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push([first[0], first[1]]);
            }
        }
    }
    
    // 显示加载状态（saveBtn 已在函数开头声明）
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + (isUpdate ? '更新中...' : '保存中...');
    hideModalError();
    
    try {
        let result;
        let finalGid;
        
        // 根据类型和是否更新调用对应的API
        if (isUpdate) {
            // 更新操作
            switch(type) {
                case 'point':
                    result = await updateVillage(existingGid, feature);
                    break;
                case 'line':
                    result = await updateRiver(existingGid, feature);
                    break;
                case 'polygon':
                    result = await updateWaterBody(existingGid, feature);
                    break;
                default:
                    throw new Error('未知的要素类型');
            }
            finalGid = existingGid;
        } else {
            // 创建操作
            switch(type) {
                case 'point':
                    result = await createVillage(feature);
                    break;
                case 'line':
                    result = await createRiver(feature);
                    break;
                case 'polygon':
                    result = await createWaterBody(feature);
                    break;
                default:
                    throw new Error('未知的要素类型');
            }
            finalGid = result?.data?.gid;
        }
        
        if (result && result.success) {
            // 保存/更新成功
            console.log(isUpdate ? '更新成功' : '保存成功', 'gid:', finalGid);
            
            // 从规划图层移除
            if (planningTool.currentFeature && planningTool.currentFeature._layer) {
                planningTool.planningLayer.removeLayer(planningTool.currentFeature._layer);
            }
            
            // 如果是更新操作，需要从地图上移除旧图层
            if (isUpdate) {
                // 从对应的图层组中移除旧图层
                let targetLayer = null;
                switch(type) {
                    case 'point':
                        targetLayer = typeof villagesLayer !== 'undefined' ? villagesLayer : null;
                        break;
                    case 'line':
                        targetLayer = typeof riversLayer !== 'undefined' ? riversLayer : null;
                        break;
                    case 'polygon':
                        targetLayer = typeof waterBodiesLayer !== 'undefined' ? waterBodiesLayer : null;
                        break;
                }
                
                if (targetLayer) {
                    targetLayer.eachLayer(function(layer) {
                        if (layer.featureGid === existingGid || layer.feature?.properties?.gid === existingGid) {
                            targetLayer.removeLayer(layer);
                        }
                    });
                }
            }
            
            // 添加到正式图层（可选：重新加载数据或直接添加）
            if (finalGid) {
                // 调试：输出保存时的坐标
                console.log('[DEBUG] ========== 保存成功，准备添加到地图 ==========');
                console.log('[DEBUG] 要素类型:', type);
                console.log('[DEBUG] GID:', finalGid);
                console.log('[DEBUG] 保存时的坐标数据:', JSON.stringify(feature.geometry.coordinates, null, 2));
                if (feature.geometry.type === 'Point') {
                    const [lon, lat] = feature.geometry.coordinates;
                    console.log('[DEBUG] 点坐标 - 经度:', lon, '纬度:', lat);
                }
                
                addFeatureToMap(feature, type, finalGid);
            }
            
            // 添加到最近添加的要素列表（仅创建时）
            if (!isUpdate && finalGid) {
                const savedFeature = {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        gid: finalGid
                    },
                    id: finalGid,
                    type: type,  // 'point', 'line', 'polygon'
                    savedAt: new Date().toISOString()  // 保存时间
                };
                
                // 添加到列表开头（最新的在前面）
                planningTool.recentFeatures.unshift(savedFeature);
                
                // 限制列表长度（最多保存10个）
                if (planningTool.recentFeatures.length > 10) {
                    planningTool.recentFeatures = planningTool.recentFeatures.slice(0, 10);
                }
            }
            
            // 清除 dataset.currentFeature，防止重复保存
            const modalElement = document.getElementById('planning-edit-modal');
            if (modalElement) {
                delete modalElement.dataset.currentFeature;
            }
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('planning-edit-modal'));
            if (modal) {
                modal.hide();
            }
            
            // 显示成功提示
            showSuccessMessage(`要素${isUpdate ? '更新' : '创建'}成功！ID: ${finalGid}`);
            
            // 重置状态
            planningTool.currentFeature = null;
            cancelDrawing();
            
        } else {
            throw new Error(result?.error || (isUpdate ? '更新失败' : '保存失败'));
        }
        
    } catch (error) {
        console.error('保存失败:', error);
        
        // 检查是否是重复保存错误
        const errorMsg = error.message || '未知错误';
        if (errorMsg.includes('duplicate') || 
            errorMsg.includes('重复') || 
            errorMsg.includes('UNIQUE') ||
            errorMsg.includes('constraint') ||
            errorMsg.includes('already exists')) {
            showModalError('要素数据重复：数据库中已存在相同或相似的要素，请检查名称或坐标');
        } else if (errorMsg.includes('gid') || errorMsg.includes('主键')) {
            showModalError('要素ID冲突：请刷新页面后重试');
        } else {
            showModalError('保存失败: ' + errorMsg);
        }
    } finally {
        // 恢复按钮状态
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

/**
 * 添加要素到地图
 */
function addFeatureToMap(feature, type, gid) {
    if (!planningTool.map) return;
    
    // 调试：输出添加到地图时的坐标
    console.log('[DEBUG] ========== 添加到地图 ==========');
    console.log('[DEBUG] 要素类型:', type);
    console.log('[DEBUG] GID:', gid);
    console.log('[DEBUG] 添加到地图时的坐标数据:', JSON.stringify(feature.geometry.coordinates, null, 2));
    if (feature.geometry && feature.geometry.coordinates) {
        if (feature.geometry.type === 'Point') {
            const coords = feature.geometry.coordinates;
            if (Array.isArray(coords) && coords.length >= 2) {
                console.log('[DEBUG] 点坐标 - 经度:', coords[0], '纬度:', coords[1]);
            }
        }
    }
    
    // 设置gid
    feature.properties.gid = gid;
    feature.id = gid;
    
    // 检查是否存在 map_api.html 的图层结构
    const isMapApi = typeof villagesLayer !== 'undefined' && 
                     typeof riversLayer !== 'undefined' && 
                     typeof waterBodiesLayer !== 'undefined';
    
    if (isMapApi) {
        // map_api.html 模式：添加到对应的图层组
        addFeatureToMapApi(feature, type, gid);
    } else {
        // map_json.html 模式：直接添加到地图
        addFeatureToMapJson(feature, type, gid);
    }
}

/**
 * 添加到 map_api.html 的图层
 */
function addFeatureToMapApi(feature, type, gid) {
    const properties = feature.properties || {};
    
    switch(type) {
        case 'point':
            // 使用 map_api.html 的 addPointFeature 函数（如果存在）
            if (typeof addPointFeature === 'function') {
                addPointFeature(feature, villagesLayer);
                // 延迟绑定双击编辑（等待图层添加完成）
                setTimeout(function() {
                    villagesLayer.eachLayer(function(layer) {
                        if (layer.featureGid === gid) {
                            layer.feature = feature;  // 保存要素数据
                            bindDoubleClickEdit(layer);
                        }
                    });
                }, 100);
            } else {
                // 手动添加
                const geometry = feature.geometry;
                if (!geometry || !geometry.coordinates) {
                    console.error('[ERROR] addFeatureToMapApi: 手动添加时缺少坐标数据');
                    return;
                }
                
                const coords = geometry.coordinates;
                if (!Array.isArray(coords) || coords.length < 2) {
                    console.error('[ERROR] addFeatureToMapApi: 坐标数据格式错误:', coords);
                    return;
                }
                
                const [lon, lat] = coords;
                
                // 调试：输出手动添加时的坐标
                console.log('[DEBUG] ========== 手动添加点要素 ==========');
                console.log('[DEBUG] GeoJSON坐标 [lon, lat]:', coords);
                console.log('[DEBUG] 经度:', lon, '纬度:', lat);
                console.log('[DEBUG] Leaflet坐标 [lat, lon]:', [lat, lon]);
                
                // 检查是否是异常坐标
                if (Math.abs(lon - 116.0) < 0.0001 && Math.abs(lat - 39.9999) < 0.0001) {
                    console.error('[ERROR] ⚠️ 手动添加时检测到异常坐标 (116.0, 39.9999)！');
                    console.error('[ERROR] 完整要素数据:', JSON.stringify(feature, null, 2));
                }
                
                const popupContent = formatPopupContent ? formatPopupContent(properties, 'point') : 
                    `<b>${properties.name || '村庄'}</b><br>ID: ${gid}`;
                
            const marker = L.circleMarker([lat, lon], {
                radius: 6,
                color: '#ff6b6b',
                fillColor: '#ff6b6b',
                fillOpacity: 0.7,
                weight: 2
            })
            .bindPopup(popupContent)
            .bindTooltip(properties.name || '村庄', { sticky: true })
            .addTo(villagesLayer);
            
            marker.featureType = 'villages';
            marker.featureGid = gid;
            marker.featureName = properties.name || '村庄';
            marker.feature = feature;  // 保存完整的要素数据
            
            // 绑定右键菜单
            marker.on('contextmenu', function(e) {
                if (typeof showContextMenu === 'function') {
                    showContextMenu(e, 'villages', gid, marker.featureName);
                }
            });
            
            // 绑定双击编辑
            bindDoubleClickEdit(marker);
            }
            break;
            
        case 'line':
            if (typeof addLineFeature === 'function') {
                addLineFeature(feature, riversLayer);
                // 延迟绑定双击编辑（等待图层添加完成）
                setTimeout(function() {
                    riversLayer.eachLayer(function(layer) {
                        if (layer.featureGid === gid) {
                            layer.feature = feature;  // 保存要素数据
                            bindDoubleClickEdit(layer);
                        }
                    });
                }, 100);
            } else {
                const geojsonLayer = L.geoJSON(feature, {
                    style: {
                        color: '#4ecdc4',
                        weight: 3,
                        opacity: 0.8
                    },
                    onEachFeature: function(feature, layer) {
                        const popupContent = formatPopupContent ? formatPopupContent(properties, 'line') : 
                            `<b>${properties.name || '河渠'}</b><br>ID: ${gid}`;
                        layer.bindPopup(popupContent);
                        layer.bindTooltip(properties.name || '河渠', { sticky: true });
                        
                        layer.featureType = 'rivers';
                        layer.featureGid = gid;
                        layer.featureName = properties.name || '河渠';
                        layer.feature = feature;  // 保存完整的要素数据
                        
                        // 绑定右键菜单
                        layer.on('contextmenu', function(e) {
                            if (typeof showContextMenu === 'function') {
                                showContextMenu(e, 'rivers', gid, layer.featureName);
                            }
                        });
                        
                        // 绑定双击编辑
                        bindDoubleClickEdit(layer);
                    }
                }).addTo(riversLayer);
            }
            break;
            
        case 'polygon':
            if (typeof addPolygonFeature === 'function') {
                addPolygonFeature(feature, waterBodiesLayer);
                // 延迟绑定双击编辑（等待图层添加完成）
                setTimeout(function() {
                    waterBodiesLayer.eachLayer(function(layer) {
                        if (layer.featureGid === gid) {
                            layer.feature = feature;  // 保存要素数据
                            bindDoubleClickEdit(layer);
                        }
                    });
                }, 100);
            } else {
                const geojsonLayer = L.geoJSON(feature, {
                    style: {
                        fillColor: '#45b7d1',
                        color: '#45b7d1',
                        weight: 2,
                        fillOpacity: 0.5,
                        opacity: 0.8
                    },
                    onEachFeature: function(feature, layer) {
                        const popupContent = formatPopupContent ? formatPopupContent(properties, 'polygon') : 
                            `<b>${properties.name || '水系'}</b><br>ID: ${gid}`;
                        layer.bindPopup(popupContent);
                        layer.bindTooltip(properties.name || '水系', { sticky: true });
                        
                        layer.featureType = 'water_bodies';
                        layer.featureGid = gid;
                        layer.featureName = properties.name || '水系';
                        layer.feature = feature;  // 保存完整的要素数据
                        
                        // 绑定右键菜单
                        layer.on('contextmenu', function(e) {
                            if (typeof showContextMenu === 'function') {
                                showContextMenu(e, 'water_bodies', gid, layer.featureName);
                            }
                        });
                        
                        // 绑定双击编辑
                        bindDoubleClickEdit(layer);
                    }
                }).addTo(waterBodiesLayer);
            }
            break;
    }
    
    // 更新状态栏（如果存在）
    if (typeof updateStatus === 'function') {
        const statusMap = {
            'point': 'villages',
            'line': 'rivers',
            'polygon': 'water-bodies'
        };
        const statusType = statusMap[type];
        if (statusType) {
            // 获取当前数量并更新
            const layerMap = {
                'point': villagesLayer,
                'line': riversLayer,
                'polygon': waterBodiesLayer
            };
            const layer = layerMap[type];
            if (layer) {
                const count = layer.getLayers().length;
                updateStatus(statusType, 'success', `已加载 ${count} 个`);
            }
        }
    }
}

/**
 * 添加到 map_json.html 的地图（原有逻辑）
 */
function addFeatureToMapJson(feature, type, gid) {
    // 根据类型设置样式
    let style = {};
    
    switch(type) {
        case 'point':
            style = {
                radius: 6,
                color: '#ff6b6b',
                fillColor: '#ff6b6b',
                fillOpacity: 0.7,
                weight: 2
            };
            break;
        case 'line':
            style = {
                color: '#4ecdc4',
                weight: 3,
                opacity: 0.8
            };
            break;
        case 'polygon':
            style = {
                color: '#45b7d1',
                fillColor: '#45b7d1',
                fillOpacity: 0.3,
                weight: 2,
                opacity: 0.8
            };
            break;
    }
    
    // 创建图层
    const layer = L.geoJSON(feature, {
        style: style,
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, style);
        },
        onEachFeature: function(feature, layer) {
            // 绑定弹窗
            const name = feature.properties.name || '未命名';
            layer.bindPopup(`<b>${name}</b><br>类型: ${type}<br>ID: ${gid}`);
            
            // 绑定点击事件（可选：用于编辑）
            layer.on('click', function(e) {
                // 可以在这里添加编辑功能
            });
        }
    });
    
    // 添加到地图（直接添加到地图，不添加到特定图层组）
    layer.addTo(planningTool.map);
    
    // 更新全局数据（如果存在）
    if (typeof pointData !== 'undefined' && type === 'point') {
        if (!pointData.features) pointData.features = [];
        pointData.features.push(feature);
    } else if (typeof lineData !== 'undefined' && type === 'line') {
        if (!lineData.features) lineData.features = [];
        lineData.features.push(feature);
    } else if (typeof polygonData !== 'undefined' && type === 'polygon') {
        if (!polygonData.features) polygonData.features = [];
        polygonData.features.push(feature);
    }
}

/**
 * 取消保存
 */
function cancelSave() {
    // 确认取消
    if (planningTool.currentFeature) {
        if (confirm('确定要取消吗？未保存的要素将被删除。')) {
            // 从规划图层移除
            if (planningTool.currentFeature._layer) {
                planningTool.planningLayer.removeLayer(planningTool.currentFeature._layer);
            }
            planningTool.currentFeature = null;
            cancelDrawing();
        } else {
            return;  // 用户取消，不关闭模态框
        }
    }
    
    // 关闭模态框
    const modal = bootstrap.Modal.getInstance(document.getElementById('planning-edit-modal'));
    if (modal) {
        modal.hide();
    }
}

/**
 * 初始化工具面板
 */
function initPlanningPanel() {
    // 绑定按钮事件
    document.getElementById('draw-point-btn').addEventListener('click', function() {
        startDrawing('point');
    });
    
    document.getElementById('draw-line-btn').addEventListener('click', function() {
        startDrawing('line');
    });
    
    document.getElementById('draw-polygon-btn').addEventListener('click', function() {
        startDrawing('polygon');
    });
    
    document.getElementById('cancel-draw-btn').addEventListener('click', function() {
        cancelDrawing();
    });
    
    // 绑定模态框事件
    document.getElementById('save-feature-btn').addEventListener('click', saveFeature);
    document.getElementById('cancel-feature-btn').addEventListener('click', cancelSave);
    
    // 模态框关闭时清理
    document.getElementById('planning-edit-modal').addEventListener('hidden.bs.modal', function() {
        // 检查是否已保存（通过检查 dataset.currentFeature 是否被清除）
        const modalElement = document.getElementById('planning-edit-modal');
        const isSaved = !modalElement.dataset.currentFeature;
        
        // 如果未保存，询问是否删除
        if (!isSaved && planningTool.currentFeature && planningTool.currentFeature._layer) {
            // 延迟询问，避免与保存成功后的清理冲突
            setTimeout(function() {
                // 再次检查是否已保存（保存成功后会清除 dataset）
                if (modalElement.dataset.currentFeature && 
                    planningTool.currentFeature && 
                    planningTool.currentFeature._layer) {
                    if (confirm('要素尚未保存，是否删除？')) {
                        planningTool.planningLayer.removeLayer(planningTool.currentFeature._layer);
                        planningTool.currentFeature = null;
                        delete modalElement.dataset.currentFeature;
                        cancelDrawing();
                    }
                }
            }, 100);
        }
    });
}

/**
 * 更新按钮状态
 */
function updateButtonState(activeType) {
    const buttons = {
        'point': document.getElementById('draw-point-btn'),
        'line': document.getElementById('draw-line-btn'),
        'polygon': document.getElementById('draw-polygon-btn')
    };
    
    // 重置所有按钮
    Object.values(buttons).forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    // 激活当前按钮
    if (activeType && buttons[activeType]) {
        buttons[activeType].classList.add('active');
    }
}

/**
 * 显示绘制提示
 */
function showDrawingHint(type) {
    let hintText = '';
    
    if (typeof type === 'string') {
        const hintTexts = {
            'point': '在地图上点击放置村庄标记',
            'line': '在地图上点击绘制河渠，右键完成绘制',
            'polygon': '在地图上点击绘制水域边界，右键完成绘制'
        };
        hintText = hintTexts[type] || '开始绘制';
    } else {
        // 直接显示消息
        hintText = type;
    }
    
    const hint = document.getElementById('drawing-hint');
    if (hint) {
        hint.textContent = hintText;
        hint.style.display = 'block';
    }
}

/**
 * 隐藏绘制提示
 */
function hideDrawingHint() {
    const hint = document.getElementById('drawing-hint');
    if (hint) {
        hint.style.display = 'none';
    }
}

/**
 * 显示模态框错误
 */
function showModalError(message) {
    const errorDiv = document.getElementById('modal-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

/**
 * 隐藏模态框错误
 */
function hideModalError() {
    const errorDiv = document.getElementById('modal-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

/**
 * 显示成功消息
 */
function showSuccessMessage(message) {
    // 创建临时提示元素
    const toast = document.createElement('div');
    toast.className = 'alert alert-success alert-dismissible fade show planning-toast';
    toast.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; min-width: 300px;';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

