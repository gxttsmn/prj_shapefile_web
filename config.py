# -*- coding: utf-8 -*-
"""
配置文件：定义地图样式、颜色、标记等配置
"""

# 图层配置
LAYER_CONFIG = {
    'point': {
        'name': '村庄（点）',
        'color': '#ff6b6b',
        'fill_color': '#ff6b6b',
        'fill_opacity': 0.7,
        'radius': 6,
        'weight': 2,
        'icon': 'info-circle',  # Font Awesome icon
    },
    'line': {
        'name': '河渠（线）',
        'color': '#4ecdc4',
        'weight': 3,
        'opacity': 0.8,
    },
    'polygon': {
        'name': '水系（面）',
        'color': '#45b7d1',
        'fill_color': '#45b7d1',
        'fill_opacity': 0.3,
        'weight': 2,
        'opacity': 0.8,
    }
}

# 地图默认配置
MAP_CONFIG = {
    'tiles': 'OpenStreetMap',
    'zoom_start': 10,
    'width': '100%',
    'height': '100%',
    'prefer_canvas': False,
}

# 底图选项（可选，用于图层切换）
TILE_LAYERS = {
    'OpenStreetMap': {
        'tiles': 'OpenStreetMap',
        'name': 'OpenStreetMap',
        'attribution': '© OpenStreetMap contributors',
    },
    'CartoDB Positron': {
        'tiles': 'CartoDB positron',
        'name': 'CartoDB Positron',
        'attribution': '© OpenStreetMap contributors © CARTO',
    },
    'CartoDB Dark Matter': {
        'tiles': 'CartoDB dark_matter',
        'name': 'CartoDB Dark Matter',
        'attribution': '© OpenStreetMap contributors © CARTO',
    }
}

# Shapefile 文件路径配置
SHAPEFILE_PATHS = {
    'point': 'shp示例/点_村.shp',
    'line': 'shp示例/线_河渠.shp',
    'polygon': 'shp示例/面_水系.shp',
}

# 输出文件配置
OUTPUT_CONFIG = {
    'output_dir': 'output',
    'output_filename': 'map.html',
    'open_browser': True,  # 生成后是否自动打开浏览器
}

# 弹窗配置
POPUP_CONFIG = {
    'max_width': 300,
    'sticky': False,
}

# 工具提示配置
TOOLTIP_CONFIG = {
    'sticky': True,
    'permanent': False,
}

# 图例配置
LEGEND_CONFIG = {
    'position': 'bottomright',
    'background_color': 'white',
    'padding': '10px',
    'border_radius': '5px',
}

