# -*- coding: utf-8 -*-
"""
GeoJSON转换工具
"""

import json
import copy
import geopandas as gpd
from shapely.geometry import shape, mapping
from shapely.validation import explain_validity


def validate_and_fix_geometry(feature):
    """
    Validate geometry; if invalid, try buffer(0) to fix minor self-intersection.
    Raises ValueError with explain_validity if still invalid after fix attempt.
    """
    if not feature or 'geometry' not in feature:
        return feature
    geom = shape(feature['geometry'])
    if geom.is_valid:
        return feature
    reason = explain_validity(geom)
    print(f"[WARN] Invalid geometry: {reason}")
    try:
        geom_fixed = geom.buffer(0)
        if geom_fixed.is_valid and not geom_fixed.is_empty and geom_fixed.geom_type == geom.geom_type:
            feature = copy.deepcopy(feature)
            feature['geometry'] = mapping(geom_fixed)
            print("[INFO] Geometry repaired with buffer(0)")
            return feature
    except Exception as e:
        print(f"[WARN] buffer(0) repair failed: {e}")
    raise ValueError(f"Invalid geometry: {reason}")


def gdf_to_geojson(gdf):
    """
    将GeoDataFrame转换为GeoJSON格式
    
    参数:
        gdf: GeoDataFrame对象
    
    返回:
        dict: GeoJSON FeatureCollection对象
    """
    if gdf is None or gdf.empty:
        return {
            'type': 'FeatureCollection',
            'features': []
        }
    
    # 调试：输出转换前的坐标（从数据库读取后）
    if 'geometry' in gdf.columns and not gdf.empty:
        first_geom = gdf.iloc[0]['geometry']
        if first_geom is not None:
            if hasattr(first_geom, 'x') and hasattr(first_geom, 'y'):
                print(f"[DEBUG] gdf_to_geojson: 转换前的坐标 - 经度: {first_geom.x}, 纬度: {first_geom.y}")
    
    # 使用GeoPandas的to_json方法
    geojson_str = gdf.to_json()
    geojson = json.loads(geojson_str)
    
    # 调试：输出转换后的坐标（返回给前端前）
    if geojson.get('features') and len(geojson['features']) > 0:
        first_feature = geojson['features'][0]
        if first_feature.get('geometry') and first_feature['geometry'].get('coordinates'):
            coords = first_feature['geometry']['coordinates']
            print(f"[DEBUG] gdf_to_geojson: 转换后的坐标数据: {coords}")
            if first_feature['geometry'].get('type') == 'Point' and isinstance(coords, list) and len(coords) >= 2:
                print(f"[DEBUG] gdf_to_geojson: 点坐标 - 经度: {coords[0]}, 纬度: {coords[1]}")
                # 检查是否是异常坐标
                if abs(coords[0] - 116.0) < 0.0001 and abs(coords[1] - 39.9999) < 0.0001:
                    print(f"[WARN] gdf_to_geojson: 检测到异常坐标 (116.0, 39.9999)！")
    
    return geojson

def geojson_to_gdf(geojson_data):
    """
    将GeoJSON转换为GeoDataFrame
    
    参数:
        geojson_data: GeoJSON FeatureCollection对象（dict）
    
    返回:
        GeoDataFrame对象
    """
    if isinstance(geojson_data, str):
        geojson_data = json.loads(geojson_data)
    
    return gpd.GeoDataFrame.from_features(
        geojson_data.get('features', []),
        crs='EPSG:4326'
    )

def feature_to_gdf(feature, crs='EPSG:4326'):
    """
    将单个GeoJSON Feature转换为GeoDataFrame
    
    参数:
        feature: GeoJSON Feature对象（dict）
        crs: 坐标系（默认WGS84）
    
    返回:
        GeoDataFrame对象
    """
    if not feature or not isinstance(feature, dict):
        raise ValueError('Invalid feature: must be a dict')
    
    # 确保 feature 有 geometry
    if 'geometry' not in feature:
        raise ValueError('Feature must have a geometry field')
    
    # 调试：输出转换前的坐标
    geom = feature.get('geometry', {})
    if geom and 'coordinates' in geom:
        coords = geom['coordinates']
        print(f"[DEBUG] feature_to_gdf: 转换前的坐标数据: {coords}")
        if geom.get('type') == 'Point' and isinstance(coords, list) and len(coords) >= 2:
            print(f"[DEBUG] feature_to_gdf: 点坐标 - 经度: {coords[0]}, 纬度: {coords[1]}")
            # 检查是否是异常坐标
            if abs(coords[0] - 116.0) < 0.0001 and abs(coords[1] - 39.9999) < 0.0001:
                print(f"[WARN] feature_to_gdf: 检测到异常坐标 (116.0, 39.9999)！")
    
    # 使用 from_features 方法，这是推荐的方式
    # 它能够正确处理 GeoJSON Feature 格式
    features = [feature] if feature.get('type') == 'Feature' else [{'type': 'Feature', **feature}]
    
    gdf = gpd.GeoDataFrame.from_features(features, crs=crs)
    
    # 调试：输出转换后的坐标（Point 用 .x/.y，LineString 用 .coords，Polygon 用 .exterior.coords）
    if not gdf.empty and 'geometry' in gdf.columns:
        geom_obj = gdf.iloc[0]['geometry']
        if geom_obj is not None:
            if hasattr(geom_obj, 'x') and hasattr(geom_obj, 'y'):
                print(f"[DEBUG] feature_to_gdf: 转换后的坐标 - 经度: {geom_obj.x}, 纬度: {geom_obj.y}")
            elif hasattr(geom_obj, 'exterior') and geom_obj.exterior is not None:
                coords_list = list(geom_obj.exterior.coords)
                print(f"[DEBUG] feature_to_gdf: 转换后的坐标数据 (Polygon exterior): {coords_list}")
            elif hasattr(geom_obj, 'coords'):
                try:
                    coords_list = list(geom_obj.coords)
                    print(f"[DEBUG] feature_to_gdf: 转换后的坐标数据: {coords_list}")
                except NotImplementedError:
                    pass
    
    # 如果 feature 有 properties，需要合并到 GeoDataFrame 中
    if 'properties' in feature and feature['properties']:
        for key, value in feature['properties'].items():
            if key not in gdf.columns or key == 'geometry':
                gdf[key] = value
    
    return gdf

