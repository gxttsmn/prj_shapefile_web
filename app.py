# -*- coding: utf-8 -*-
"""
主程序：读取 Shapefile 数据并生成交互式 Folium 地图
"""

import os
import sys
import json
from pathlib import Path

try:
    import geopandas as gpd
    import folium
    from folium import plugins
    import pandas as pd
except ImportError as e:
    print(f"错误：缺少必要的库。请运行: pip install -r requirements.txt")
    print(f"详细错误: {e}")
    sys.exit(1)

import config


def ensure_output_dir():
    """确保输出目录存在"""
    output_dir = Path(config.OUTPUT_CONFIG['output_dir'])
    output_dir.mkdir(exist_ok=True)
    return output_dir


def read_shapefile_with_encoding(file_path, layer_name):
    """
    尝试多种编码方式读取 Shapefile
    
    参数:
        file_path: Shapefile 文件路径
        layer_name: 图层名称（用于日志输出）
    
    返回:
        GeoDataFrame 或 None
    """
    # 常见的编码方式列表（按优先级排序）
    # 中国大陆的 Shapefile 常用 GBK/GB2312，国际常用 UTF-8
    encodings = ['gbk', 'gb2312', 'utf-8', 'cp936', 'latin1']
    
    if not os.path.exists(file_path):
        print(f"[警告] {layer_name}数据文件不存在: {file_path}")
        return None
    
    for encoding in encodings:
        try:
            gdf = gpd.read_file(file_path, encoding=encoding)
            print(f"[OK] 成功加载{layer_name}数据: {len(gdf)} 个要素 (编码: {encoding})")
            return gdf
        except (UnicodeDecodeError, LookupError) as e:
            # 如果是编码错误，尝试下一种编码
            continue
        except Exception as e:
            # 其他错误（如文件格式错误），记录并返回 None
            print(f"✗ 加载{layer_name}数据失败 ({encoding}): {e}")
            # 如果不是编码问题，不再尝试其他编码
            if 'codec' not in str(e).lower() and 'decode' not in str(e).lower():
                return None
    
    # 所有编码都失败
    print(f"✗ 加载{layer_name}数据失败: 无法使用常见编码读取文件")
    return None


def read_shapefiles():
    """读取所有 Shapefile 数据"""
    data = {}
    
    print("正在读取 Shapefile 数据...")
    
    # 读取点数据
    point_path = config.SHAPEFILE_PATHS['point']
    data['point'] = read_shapefile_with_encoding(point_path, '点')
    
    # 读取线数据
    line_path = config.SHAPEFILE_PATHS['line']
    data['line'] = read_shapefile_with_encoding(line_path, '线')
    
    # 读取面数据
    polygon_path = config.SHAPEFILE_PATHS['polygon']
    data['polygon'] = read_shapefile_with_encoding(polygon_path, '面')
    
    return data


def calculate_map_bounds(data):
    """计算所有图层的合并边界"""
    bounds_list = []
    
    for layer_type, gdf in data.items():
        if gdf is not None and not gdf.empty:
            try:
                bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]
                if bounds is not None and len(bounds) == 4:
                    bounds_list.append(bounds)
            except Exception as e:
                print(f"[警告] 计算 {layer_type} 边界失败: {e}")
    
    if not bounds_list:
        # 默认返回山西运城地区
        return None, [35.0, 111.0], 10
    
    # 计算合并边界
    minx = min([b[0] for b in bounds_list])
    miny = min([b[1] for b in bounds_list])
    maxx = max([b[2] for b in bounds_list])
    maxy = max([b[3] for b in bounds_list])
    
    center_lat = (miny + maxy) / 2
    center_lon = (minx + maxx) / 2
    
    # 计算合适的缩放级别（简化算法）
    lat_diff = maxy - miny
    lon_diff = maxx - minx
    max_diff = max(lat_diff, lon_diff)
    
    if max_diff > 1.0:
        zoom = 8
    elif max_diff > 0.5:
        zoom = 9
    elif max_diff > 0.2:
        zoom = 10
    elif max_diff > 0.1:
        zoom = 11
    else:
        zoom = 12
    
    bounds = [[miny, minx], [maxy, maxx]]
    center = [center_lat, center_lon]
    
    return bounds, center, zoom


def format_popup_content(properties, layer_type):
    """格式化弹窗内容"""
    if properties is None:
        return "无属性信息"
    
    # 根据图层类型选择要显示的字段
    if layer_type == 'point':
        title = "村庄信息"
        key_fields = ['name', 'population', 'fclass', 'osm_id', 'code']
    elif layer_type == 'line':
        title = "河渠信息"
        key_fields = ['name']
    elif layer_type == 'polygon':
        title = "水系信息"
        key_fields = ['name', 'fclass', 'osm_id', 'code']
    else:
        title = "要素信息"
        key_fields = []
    
    html = f'<div style="font-family: Microsoft YaHei, Arial, sans-serif;">'
    html += f'<h4 style="margin: 0 0 10px 0; color: {config.LAYER_CONFIG[layer_type]["color"]};">{title}</h4>'
    html += '<table style="border-collapse: collapse; width: 100%;">'
    
    # 显示关键字段
    for key in key_fields:
        if key in properties and pd.notna(properties[key]) and properties[key] != '':
            value = str(properties[key])
            html += f'''
            <tr>
                <td style="padding: 4px 8px; font-weight: bold; border-bottom: 1px solid #eee;">{key}:</td>
                <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">{value}</td>
            </tr>
            '''
    
    # 显示其他字段
    for key, value in properties.items():
        if key not in key_fields and pd.notna(value) and value != '':
            html += f'''
            <tr>
                <td style="padding: 4px 8px; font-weight: bold; border-bottom: 1px solid #eee;">{key}:</td>
                <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">{value}</td>
            </tr>
            '''
    
    html += '</table></div>'
    return html


def format_tooltip_content(properties, layer_type):
    """格式化工具提示内容"""
    if properties is None:
        return "点击查看详情"
    
    if 'name' in properties and pd.notna(properties['name']) and properties['name'] != '':
        return str(properties['name'])
    
    if layer_type == 'point' and 'population' in properties and pd.notna(properties['population']):
        return f"人口: {properties['population']}"
    
    return "点击查看详情"


def add_point_layer(map_obj, gdf, feature_group):
    """添加点图层"""
    if gdf is None or gdf.empty:
        return
    
    layer_config = config.LAYER_CONFIG['point']
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        
        # 跳过无效几何
        if geom is None or geom.is_empty:
            continue
        
        # 获取坐标（点几何）
        if geom.geom_type == 'Point':
            lat = geom.y
            lon = geom.x
        else:
            # 如果是多点，使用第一个点
            lat = geom.geoms[0].y if hasattr(geom, 'geoms') else geom.y
            lon = geom.geoms[0].x if hasattr(geom, 'geoms') else geom.x
        
        properties = row.drop('geometry').to_dict()
        
        # 创建弹窗
        popup_html = format_popup_content(properties, 'point')
        popup = folium.Popup(
            folium.Html(popup_html, script=True),
            max_width=config.POPUP_CONFIG['max_width']
        )
        
        # 创建工具提示
        tooltip_html = format_tooltip_content(properties, 'point')
        tooltip = folium.Tooltip(tooltip_html, sticky=config.TOOLTIP_CONFIG['sticky'])
        
        # 创建标记
        circle = folium.CircleMarker(
            location=[lat, lon],
            radius=layer_config['radius'],
            popup=popup,
            tooltip=tooltip,
            color=layer_config['color'],
            fillColor=layer_config['fill_color'],
            fillOpacity=layer_config['fill_opacity'],
            weight=layer_config['weight'],
        )
        
        circle.add_to(feature_group)


def add_line_layer(map_obj, gdf, feature_group):
    """添加线图层"""
    if gdf is None or gdf.empty:
        return
    
    layer_config = config.LAYER_CONFIG['line']
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        
        # 跳过无效几何
        if geom is None or geom.is_empty:
            continue
        
        properties = row.drop('geometry').to_dict()
        
        # 创建弹窗
        popup_html = format_popup_content(properties, 'line')
        popup = folium.Popup(
            folium.Html(popup_html, script=True),
            max_width=config.POPUP_CONFIG['max_width']
        )
        
        # 创建工具提示
        tooltip_html = format_tooltip_content(properties, 'line')
        tooltip = folium.Tooltip(tooltip_html, sticky=config.TOOLTIP_CONFIG['sticky'])
        
        # 创建单行 GeoDataFrame 并转换为 GeoJSON
        # 这样可以避免递归深度问题
        try:
            # 方法：创建一个只包含当前行的 GeoDataFrame
            single_row_gdf = gpd.GeoDataFrame([row], crs=gdf.crs)
            geojson_str = single_row_gdf.to_json()
            
            # 使用 GeoJSON 方式添加
            geojson_data = folium.GeoJson(
                geojson_str,
                style_function=lambda x: {
                    'color': layer_config['color'],
                    'weight': layer_config['weight'],
                    'opacity': layer_config['opacity'],
                },
                popup=popup,
                tooltip=tooltip,
            )
            geojson_data.add_to(feature_group)
        except Exception as e:
            print(f"[警告] 添加线要素 {idx} 失败: {e}")
            continue


def add_polygon_layer(map_obj, gdf, feature_group):
    """添加面图层"""
    if gdf is None or gdf.empty:
        return
    
    layer_config = config.LAYER_CONFIG['polygon']
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        
        # 跳过无效几何
        if geom is None or geom.is_empty:
            continue
        
        properties = row.drop('geometry').to_dict()
        
        # 创建弹窗
        popup_html = format_popup_content(properties, 'polygon')
        popup = folium.Popup(
            folium.Html(popup_html, script=True),
            max_width=config.POPUP_CONFIG['max_width']
        )
        
        # 创建工具提示
        tooltip_html = format_tooltip_content(properties, 'polygon')
        tooltip = folium.Tooltip(tooltip_html, sticky=config.TOOLTIP_CONFIG['sticky'])
        
        # 创建单行 GeoDataFrame 并转换为 GeoJSON
        # 这样可以避免递归深度问题
        try:
            # 方法：创建一个只包含当前行的 GeoDataFrame
            single_row_gdf = gpd.GeoDataFrame([row], crs=gdf.crs)
            geojson_str = single_row_gdf.to_json()
            
            # 使用 GeoJSON 方式添加
            geojson_data = folium.GeoJson(
                geojson_str,
                style_function=lambda x: {
                    'fillColor': layer_config['fill_color'],
                    'color': layer_config['color'],
                    'weight': layer_config['weight'],
                    'fillOpacity': layer_config['fill_opacity'],
                    'opacity': layer_config['opacity'],
                },
                popup=popup,
                tooltip=tooltip,
            )
            geojson_data.add_to(feature_group)
        except Exception as e:
            print(f"[警告] 添加面要素 {idx} 失败: {e}")
            continue


def add_legend(map_obj):
    """添加图例"""
    legend_html = '''
    <div style="position: fixed; 
                bottom: 50px; right: 50px; width: 150px; height: auto;
                background-color: white; z-index:9999; 
                border:2px solid grey; border-radius: 5px;
                padding: 10px; font-size: 12px;
                font-family: Microsoft YaHei, Arial, sans-serif;
                box-shadow: 0 0 15px rgba(0,0,0,0.2);">
    <h4 style="margin-top: 0; margin-bottom: 10px;">图例</h4>
    '''
    
    # 添加点图例
    point_config = config.LAYER_CONFIG['point']
    legend_html += f'''
    <div style="margin: 5px 0;">
        <span style="display: inline-block; width: 20px; height: 20px; 
                     background-color: {point_config['fill_color']}; 
                     border-radius: 50%; border: 2px solid {point_config['color']};
                     vertical-align: middle; margin-right: 5px;"></span>
        <span>{point_config['name']}</span>
    </div>
    '''
    
    # 添加线图例
    line_config = config.LAYER_CONFIG['line']
    legend_html += f'''
    <div style="margin: 5px 0;">
        <span style="display: inline-block; width: 30px; height: 3px; 
                     background-color: {line_config['color']}; 
                     vertical-align: middle; margin-right: 5px;"></span>
        <span>{line_config['name']}</span>
    </div>
    '''
    
    # 添加面图例
    polygon_config = config.LAYER_CONFIG['polygon']
    legend_html += f'''
    <div style="margin: 5px 0;">
        <span style="display: inline-block; width: 20px; height: 20px; 
                     background-color: {polygon_config['fill_color']}; 
                     border: 2px solid {polygon_config['color']};
                     vertical-align: middle; margin-right: 5px;"></span>
        <span>{polygon_config['name']}</span>
    </div>
    '''
    
    legend_html += '</div>'
    map_obj.get_root().html.add_child(folium.Element(legend_html))


def add_labeling_panel(map_obj):
    """添加标注控制面板"""
    panel_html = '''
    <div class="labeling-control-panel">
        <h3>要素标注</h3>
        <div class="input-group">
            <input type="text" 
                   id="label-input" 
                   placeholder="输入指令，如：标注司辛庄村 或 移除标注司辛庄村"
                   list="command-examples"
                   autocomplete="off">
            <datalist id="command-examples">
                <option value="标注司辛庄村">
                <option value="标注大吕庄村以东的司辛庄村">
                <option value="移除标注司辛庄村">
                <option value="清除所有标注">
            </datalist>
            <button id="interact-btn">交互</button>
        </div>
        <div id="label-feedback" class="feedback-area"></div>
        <div class="label-management-panel">
            <h4>已标注要素</h4>
            <ul id="labeled-features-list">
                <li style="color: #999; padding: 10px;">暂无标注</li>
            </ul>
        </div>
    </div>
    '''
    map_obj.get_root().html.add_child(folium.Element(panel_html))
    
    # 添加CSS样式（在head中）
    css_link = '''
    <link rel="stylesheet" href="css/labeling.css">
    '''
    map_obj.get_root().header.add_child(folium.Element(css_link))
    
    # JavaScript代码将在save_map函数中注入，这里不重复添加


def create_map(data):
    """创建 Folium 地图"""
    print("\n正在创建地图...")
    
    # 计算地图边界和中心点
    bounds, center, zoom = calculate_map_bounds(data)
    
    if bounds is None:
        center = [35.0, 111.0]  # 默认：山西运城
        zoom = 10
    
    print(f"地图中心: {center}, 缩放级别: {zoom}")
    
    # 创建地图对象
    map_obj = folium.Map(
        location=center,
        zoom_start=zoom,
        tiles=config.MAP_CONFIG['tiles'],
        width=config.MAP_CONFIG['width'],
        height=config.MAP_CONFIG['height'],
    )
    
    # 如果有边界，设置地图视图
    if bounds:
        map_obj.fit_bounds(bounds, padding=(50, 50))
    
    # 创建图层组（用于图层控制）
    point_group = folium.FeatureGroup(name=config.LAYER_CONFIG['point']['name'], show=True)
    line_group = folium.FeatureGroup(name=config.LAYER_CONFIG['line']['name'], show=True)
    polygon_group = folium.FeatureGroup(name=config.LAYER_CONFIG['polygon']['name'], show=True)
    
    # 添加各图层
    print("正在添加点图层...")
    if data['point'] is not None:
        add_point_layer(map_obj, data['point'], point_group)
    
    print("正在添加线图层...")
    if data['line'] is not None:
        add_line_layer(map_obj, data['line'], line_group)
    
    print("正在添加面图层...")
    if data['polygon'] is not None:
        add_polygon_layer(map_obj, data['polygon'], polygon_group)
    
    # 将图层组添加到地图
    point_group.add_to(map_obj)
    line_group.add_to(map_obj)
    polygon_group.add_to(map_obj)
    
    # 添加图层控制
    folium.LayerControl(collapsed=False).add_to(map_obj)
    
    # 添加图例
    add_legend(map_obj)
    
    # 添加标注控制面板
    add_labeling_panel(map_obj)
    
    # 添加全屏插件
    plugins.Fullscreen(
        position='topright',
        title='全屏',
        title_cancel='退出全屏',
        force_separate_button=True,
    ).add_to(map_obj)
    
    # 添加测量工具
    plugins.MeasureControl(
        position='topright',
        primary_length_unit='meters',
        secondary_length_unit='kilometers',
        primary_area_unit='sqmeters',
        secondary_area_unit='sqkilometers',
    ).add_to(map_obj)
    
    print("地图创建完成！")
    return map_obj


def save_geojson_data(data, output_dir):
    """保存GeoJSON数据到独立文件"""
    data_dir = output_dir / 'data'
    data_dir.mkdir(exist_ok=True)
    
    print("\n正在保存GeoJSON数据...")
    
    if data['point'] is not None and not data['point'].empty:
        point_path = data_dir / 'points.geojson'
        data['point'].to_file(str(point_path), driver='GeoJSON', encoding='utf-8')
        print(f"[OK] 点数据已保存: {point_path}")
    
    if data['line'] is not None and not data['line'].empty:
        line_path = data_dir / 'lines.geojson'
        data['line'].to_file(str(line_path), driver='GeoJSON', encoding='utf-8')
        print(f"[OK] 线数据已保存: {line_path}")
    
    if data['polygon'] is not None and not data['polygon'].empty:
        polygon_path = data_dir / 'polygons.geojson'
        data['polygon'].to_file(str(polygon_path), driver='GeoJSON', encoding='utf-8')
        print(f"[OK] 面数据已保存: {polygon_path}")
    
    # 提取地名列表（用于自动完成）
    place_names = []
    if data['point'] is not None and not data['point'].empty:
        names = data['point']['name'].dropna().unique().tolist()
        place_names.extend(names)
    
    if place_names:
        names_path = data_dir / 'place_names.json'
        with open(names_path, 'w', encoding='utf-8') as f:
            json.dump(place_names, f, ensure_ascii=False, indent=2)
        print(f"[OK] 地名列表已保存: {names_path}")
    
    return data_dir


def save_map(map_obj, output_dir):
    """保存地图到文件"""
    output_path = output_dir / config.OUTPUT_CONFIG['output_filename']
    
    print(f"\n正在保存地图到: {output_path}")
    map_obj.save(str(output_path))
    
    # 修改HTML文件，在script标签结束前添加标注功能的JavaScript
    try:
        with open(output_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # 查找script标签结束位置，在其前添加我们的JavaScript代码
        # 确保在map变量定义之后加载
        js_injection = '''
        
        // 标注功能初始化
        (function() {
            // 获取地图对象（从最后一个定义的map变量）
            var mapElements = document.querySelectorAll('.folium-map');
            if (mapElements.length > 0) {
                var mapId = mapElements[mapElements.length - 1].id;
                // 尝试获取map变量
                var mapVarName = 'map_' + mapId.split('_').pop();
                if (typeof window[mapVarName] !== 'undefined') {
                    window.map = window[mapVarName];
                } else {
                    // 从全局作用域查找
                    for (var key in window) {
                        if (key.startsWith('map_') && window[key] instanceof L.Map) {
                            window.map = window[key];
                            break;
                        }
                    }
                }
            }
            
            // 动态加载JavaScript文件
            function loadScript(src) {
                return new Promise(function(resolve, reject) {
                    var script = document.createElement('script');
                    script.src = src;
                    script.onload = resolve;
                    script.onerror = function() {
                        console.warn('加载 ' + src + ' 失败，请确保文件存在');
                        resolve(); // 继续执行，不阻塞
                    };
                    document.body.appendChild(script);
                });
            }
            
            // 按顺序加载所有脚本
            setTimeout(function() {
                Promise.all([
                    loadScript('js/api.js'),      // API调用模块（最先加载）
                    loadScript('js/parser.js'),
                    loadScript('js/query.js'),
                    loadScript('js/labeling.js'),
                    loadScript('js/main.js')
                ]).then(function() {
                    console.log('[标注功能] 加载完成');
                }).catch(function(error) {
                    console.error('[标注功能] 加载失败:', error);
                });
            }, 500); // 延迟500ms确保地图已初始化
        })();
        '''
        
        # 在</script>标签前插入JavaScript代码
        if '</script>' in html_content:
            # 找到最后一个</script>标签的位置
            last_script_end = html_content.rfind('</script>')
            html_content = (html_content[:last_script_end] + 
                          js_injection + 
                          html_content[last_script_end:])
        
        # 保存修改后的HTML
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    except Exception as e:
        print(f"[警告] 修改HTML文件失败: {e}")
        print("    标注功能可能无法正常工作")
    
    print(f"[OK] 地图已保存: {output_path.absolute()}")
    
    return output_path


def open_in_browser(file_path):
    """在浏览器中打开文件"""
    import webbrowser
    import urllib.parse
    
    file_url = 'file:///' + str(file_path.absolute()).replace('\\', '/')
    webbrowser.open(file_url)
    print(f"[OK] 已在浏览器中打开地图")


def main():
    """主函数"""
    print("=" * 50)
    print("Shapefile 数据可视化 - Python + Folium")
    print("=" * 50)
    
    # 确保输出目录存在
    output_dir = ensure_output_dir()
    
    # 读取 Shapefile 数据
    data = read_shapefiles()
    
    # 检查是否有有效数据
    has_data = any(gdf is not None and not gdf.empty for gdf in data.values())
    if not has_data:
        print("\n[错误] 没有找到有效的 Shapefile 数据！")
        sys.exit(1)
    
    # 保存GeoJSON数据到独立文件
    data_dir = save_geojson_data(data, output_dir)
    
    # 创建地图
    map_obj = create_map(data)
    
    # 保存地图
    output_path = save_map(map_obj, output_dir)
    
    # 可选：自动打开浏览器
    if config.OUTPUT_CONFIG['open_browser']:
        try:
            open_in_browser(output_path)
        except Exception as e:
            print(f"[警告] 无法自动打开浏览器: {e}")
            print(f"   请手动打开: {output_path.absolute()}")
    
    print("\n" + "=" * 50)
    print("完成！")
    print("=" * 50)


if __name__ == '__main__':
    main()

