# -*- coding: utf-8 -*-
"""
分析 Shapefile 中的要素数量与实际地理实体的对应关系
"""

import geopandas as gpd
import os
import config


def analyze_shapefile(file_path, layer_name):
    """分析单个 Shapefile"""
    print(f"\n{'='*60}")
    print(f"分析: {layer_name}")
    print(f"{'='*60}")
    
    if not os.path.exists(file_path):
        print(f"[错误] 文件不存在: {file_path}")
        return None
    
    # 尝试多种编码读取
    encodings = ['gbk', 'gb2312', 'utf-8', 'cp936']
    gdf = None
    
    for encoding in encodings:
        try:
            gdf = gpd.read_file(file_path, encoding=encoding)
            print(f"[OK] 成功读取 (编码: {encoding})")
            break
        except:
            continue
    
    if gdf is None:
        print(f"[错误] 无法读取文件")
        return None
    
    # 基本信息
    print(f"\n【基本信息】")
    print(f"要素总数: {len(gdf)}")
    print(f"几何类型: {gdf.geom_type.unique()}")
    
    # 检查 MultiPart 几何
    print(f"\n【MultiPart 分析】")
    multipart_count = 0
    singlepart_count = 0
    
    for idx, geom in enumerate(gdf.geometry):
        if geom is None or geom.is_empty:
            continue
        
        # 检查是否为 MultiPart
        if geom.geom_type.startswith('Multi'):
            multipart_count += 1
            # 获取部分数量
            if hasattr(geom, 'geoms'):
                parts = len(geom.geoms)
                print(f"  要素 {idx+1}: MultiPart，包含 {parts} 个部分")
        else:
            singlepart_count += 1
    
    print(f"单部分要素: {singlepart_count}")
    print(f"多部分要素: {multipart_count}")
    
    if multipart_count > 0:
        print(f"\n[注意] 有 {multipart_count} 个 MultiPart 要素")
        print(f"   这意味着要素数量 != 实际地理实体数量")
        print(f"   实际地理实体数量可能更多")
    else:
        print(f"\n[OK] 所有要素都是单部分")
        print(f"   要素数量 = 实际地理实体数量")
    
    # 属性字段信息
    print(f"\n【属性字段】")
    print(f"字段列表: {list(gdf.columns)}")
    
    # 如果有 name 字段，统计唯一名称数量
    if 'name' in gdf.columns:
        unique_names = gdf['name'].dropna().nunique()
        print(f"唯一名称数量: {unique_names}")
        print(f"要素数量: {len(gdf)}")
        
        if unique_names < len(gdf):
            print(f"[注意] 有 {len(gdf) - unique_names} 个要素可能没有名称或名称重复")
        elif unique_names == len(gdf):
            print(f"[OK] 每个要素都有唯一名称")
    
    # 统计空值
    print(f"\n【数据质量】")
    null_counts = gdf.isnull().sum()
    if null_counts.sum() > 0:
        print("空值统计:")
        for col, count in null_counts.items():
            if count > 0:
                print(f"  {col}: {count} 个空值")
    else:
        print("[OK] 没有发现空值")
    
    return gdf


def main():
    """主函数"""
    print("="*60)
    print("Shapefile 要素数量分析")
    print("="*60)
    print("\n说明:")
    print("- 要素数量通常对应实际地理实体数量")
    print("- 但如果存在 MultiPart 几何，一个要素可能包含多个部分")
    print("- 本脚本将检查是否存在 MultiPart 情况")
    
    # 分析点数据
    point_gdf = analyze_shapefile(
        config.SHAPEFILE_PATHS['point'],
        '点_村（村庄点数据）'
    )
    
    # 分析线数据
    line_gdf = analyze_shapefile(
        config.SHAPEFILE_PATHS['line'],
        '线_河渠（河渠线数据）'
    )
    
    # 分析面数据
    polygon_gdf = analyze_shapefile(
        config.SHAPEFILE_PATHS['polygon'],
        '面_水系（水系面数据）'
    )
    
    # 总结
    print(f"\n{'='*60}")
    print("总结")
    print(f"{'='*60}")
    
    if point_gdf is not None:
        multipart_points = sum(1 for geom in point_gdf.geometry 
                              if geom is not None and not geom.is_empty 
                              and geom.geom_type.startswith('Multi'))
        if multipart_points == 0:
            print(f"[OK] 点数据: {len(point_gdf)} 个要素 = {len(point_gdf)} 个村庄")
        else:
            print(f"[注意] 点数据: {len(point_gdf)} 个要素，但包含 MultiPart")
    
    if line_gdf is not None:
        multipart_lines = sum(1 for geom in line_gdf.geometry 
                              if geom is not None and not geom.is_empty 
                              and geom.geom_type.startswith('Multi'))
        if multipart_lines == 0:
            print(f"[OK] 线数据: {len(line_gdf)} 个要素 = {len(line_gdf)} 条河渠")
        else:
            print(f"[注意] 线数据: {len(line_gdf)} 个要素，但包含 MultiPart")
    
    if polygon_gdf is not None:
        multipart_polygons = sum(1 for geom in polygon_gdf.geometry 
                                 if geom is not None and not geom.is_empty 
                                 and geom.geom_type.startswith('Multi'))
        if multipart_polygons == 0:
            print(f"[OK] 面数据: {len(polygon_gdf)} 个要素 = {len(polygon_gdf)} 个水系")
        else:
            print(f"[注意] 面数据: {len(polygon_gdf)} 个要素，但包含 MultiPart")
    
    print(f"\n{'='*60}")


if __name__ == '__main__':
    main()

