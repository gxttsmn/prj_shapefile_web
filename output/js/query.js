/**
 * 要素查询模块
 * 在GeoJSON数据中查找要素
 */

/**
 * 在要素集合中查找指定名称的要素
 * @param {Object} featureCollection - GeoJSON FeatureCollection对象
 * @param {string} name - 要查找的要素名称（支持部分匹配）
 * @returns {Array} 匹配的要素数组
 */
function findFeaturesByName(featureCollection, name) {
    if (!featureCollection || !featureCollection.features) {
        return [];
    }
    
    if (!name || typeof name !== 'string') {
        return [];
    }
    
    const searchName = name.trim();
    if (searchName === '') {
        return [];
    }
    
    return featureCollection.features.filter(feature => {
        if (!feature.properties) {
            return false;
        }
        
        const featureName = feature.properties.name;
        if (!featureName) {
            return false;
        }
        
        const featureNameStr = String(featureName).trim();
        const searchNameStr = searchName.trim();
        
        // 完全匹配
        if (featureNameStr === searchNameStr) {
            return true;
        }
        
        // 支持部分匹配（包含关系）
        if (featureNameStr.includes(searchNameStr) || 
            searchNameStr.includes(featureNameStr)) {
            return true;
        }
        
        // 支持模糊匹配（去除"村"、"庄"等后缀）
        const normalizedFeatureName = featureNameStr.replace(/[村庄镇]$/, '');
        const normalizedSearchName = searchNameStr.replace(/[村庄镇]$/, '');
        if (normalizedFeatureName === normalizedSearchName) {
            return true;
        }
        
        return false;
    });
}

/**
 * 根据要素ID查找要素
 * @param {Object} featureCollection - GeoJSON FeatureCollection对象
 * @param {string|number} featureId - 要素ID
 * @returns {Object|null} 找到的要素，未找到返回null
 */
function findFeatureById(featureCollection, featureId) {
    if (!featureCollection || !featureCollection.features) {
        return null;
    }
    
    return featureCollection.features.find(feature => {
        return feature.id === featureId || 
               feature.properties?.FID === featureId ||
               feature.properties?.id === featureId;
    }) || null;
}

/**
 * 获取要素的坐标
 * @param {Object} feature - GeoJSON要素对象
 * @returns {Array|null} [经度, 纬度]，无效返回null
 */
function getFeatureCoordinates(feature) {
    if (!feature || !feature.geometry) {
        return null;
    }
    
    const geom = feature.geometry;
    
    // 点要素
    if (geom.type === 'Point') {
        return geom.coordinates; // [lon, lat]
    }
    
    // 多点要素
    if (geom.type === 'MultiPoint' && geom.coordinates.length > 0) {
        return geom.coordinates[0]; // 返回第一个点
    }
    
    // 线要素 - 返回第一个点的坐标
    if (geom.type === 'LineString' && geom.coordinates.length > 0) {
        return geom.coordinates[0];
    }
    
    // 多线要素
    if (geom.type === 'MultiLineString' && geom.coordinates.length > 0) {
        if (geom.coordinates[0].length > 0) {
            return geom.coordinates[0][0];
        }
    }
    
    // 面要素 - 返回第一个点的坐标
    if (geom.type === 'Polygon' && geom.coordinates.length > 0) {
        if (geom.coordinates[0].length > 0) {
            return geom.coordinates[0][0];
        }
    }
    
    // 多面要素
    if (geom.type === 'MultiPolygon' && geom.coordinates.length > 0) {
        if (geom.coordinates[0].length > 0 && geom.coordinates[0][0].length > 0) {
            return geom.coordinates[0][0][0];
        }
    }
    
    return null;
}

/**
 * 计算两点之间的距离（米）
 * 使用Haversine公式计算大圆距离
 * @param {Array} point1 - [经度, 纬度]
 * @param {Array} point2 - [经度, 纬度]
 * @returns {number} 距离（米）
 */
function calculateDistance(point1, point2) {
    if (!point1 || !point2 || point1.length < 2 || point2.length < 2) {
        return Infinity;
    }
    
    const R = 6371000; // 地球半径（米）
    const lat1 = point1[1] * Math.PI / 180;
    const lat2 = point2[1] * Math.PI / 180;
    const dLat = (point2[1] - point1[1]) * Math.PI / 180;
    const dLon = (point2[0] - point1[0]) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

/**
 * 验证空间关系
 * @param {Array} targetPoint - 目标点坐标 [经度, 纬度]
 * @param {Array} referencePoint - 参考点坐标 [经度, 纬度]
 * @param {string} relation - 空间关系（"以东"、"以西"等）
 * @returns {boolean} 关系是否正确
 */
function checkSpatialRelation(targetPoint, referencePoint, relation) {
    if (!targetPoint || !referencePoint || !relation) {
        return false;
    }
    
    const lonDiff = targetPoint[0] - referencePoint[0];
    const latDiff = targetPoint[1] - referencePoint[1];
    
    // 基于原始方案的判断条件
    const relationMap = {
        '以东': () => lonDiff > 0,
        '以西': () => lonDiff < 0,
        '以北': () => latDiff > 0,
        '以南': () => latDiff < 0,
        '附近': () => calculateDistance(targetPoint, referencePoint) < 5000  // 5公里
    };
    
    const checkFunction = relationMap[relation];
    if (checkFunction) {
        return checkFunction();
    }
    
    return true; // 未知关系默认返回true
}

