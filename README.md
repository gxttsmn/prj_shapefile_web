# Shapefile 数据可视化 - Python + Folium

基于 Python + Folium 的 Shapefile 地理数据交互式可视化项目。

## 功能特性

- ✅ **支持多种几何类型**：点（村庄）、线（河渠）、面（水系）
- ✅ **图层控制**：可单独显示/隐藏每个图层
- ✅ **交互式弹窗**：点击要素查看详细信息
- ✅ **工具提示**：鼠标悬停显示简要信息
- ✅ **自动适应范围**：地图自动缩放到数据范围
- ✅ **图例显示**：直观的颜色图例说明
- ✅ **全屏模式**：支持全屏查看地图
- ✅ **测量工具**：支持距离和面积测量
- ✅ **中文支持**：完美支持中文属性数据

## 技术栈

- **geopandas** - 读取和处理 Shapefile 数据
- **folium** - 生成交互式 Leaflet 地图
- **pandas** - 数据处理

## 安装依赖

### 方法一：使用 pip（推荐）

```bash
pip install -r requirements.txt
```

### 方法二：手动安装

```bash
pip install geopandas folium pandas
```

**注意**：geopandas 需要一些系统依赖，在 Windows 上建议使用 conda 安装：

```bash
conda install geopandas -c conda-forge
```

或者在 Windows 上使用预编译的 wheel 包。

## 使用方法

### 1. 准备数据

确保 `shp示例/` 目录下有完整的 Shapefile 文件：
- `点_村.shp`, `点_村.shx`, `点_村.dbf`
- `线_河渠.shp`, `线_河渠.shx`, `线_河渠.dbf`
- `面_水系.shp`, `面_水系.shx`, `面_水系.dbf`

### 2. 运行程序

```bash
python app.py
```

### 3. 查看结果

程序会自动：
- 读取所有 Shapefile 数据
- 生成交互式地图 HTML 文件
- 保存到 `output/map.html`
- 自动在浏览器中打开（可选）

## 项目结构

```
prj_shapefile_web/
├── app.py                 # 主程序
├── config.py              # 配置文件（颜色、样式等）
├── requirements.txt       # Python 依赖
├── README.md              # 说明文档
├── output/                # 输出目录
│   └── map.html           # 生成的交互式地图
└── shp示例/               # Shapefile 数据目录
    ├── 点_村.*
    ├── 线_河渠.*
    └── 面_水系.*
```

## 配置说明

### 修改颜色和样式

编辑 `config.py` 文件中的 `LAYER_CONFIG`：

```python
LAYER_CONFIG = {
    'point': {
        'color': '#ff6b6b',      # 点要素颜色
        'fill_color': '#ff6b6b',
        'radius': 6,              # 点半径
        'fill_opacity': 0.7,      # 填充透明度
    },
    # ...
}
```

### 修改数据路径

编辑 `config.py` 中的 `SHAPEFILE_PATHS`：

```python
SHAPEFILE_PATHS = {
    'point': 'shp示例/点_村.shp',
    'line': 'shp示例/线_河渠.shp',
    'polygon': 'shp示例/面_水系.shp',
}
```

### 修改输出配置

编辑 `config.py` 中的 `OUTPUT_CONFIG`：

```python
OUTPUT_CONFIG = {
    'output_dir': 'output',
    'output_filename': 'map.html',
    'open_browser': True,  # 生成后是否自动打开浏览器
}
```

## 使用生成的 HTML 文件

生成的 `output/map.html` 是一个**完全独立的 HTML 文件**，包含：

- ✅ 所有地图数据（以 GeoJSON 形式嵌入）
- ✅ 所有 JavaScript 库（通过 CDN 加载）
- ✅ 所有样式和配置

**可以直接：**
- 在浏览器中打开（双击文件）
- 上传到 Web 服务器
- 通过邮件或网盘分享
- 嵌入到其他网页中

**无需：**
- ❌ Web 服务器
- ❌ 后端服务
- ❌ 数据库
- ❌ 额外的文件依赖

## 功能说明

### 图层控制

地图右上角有图层控制面板，可以：
- 勾选/取消勾选来显示/隐藏图层
- 支持同时显示多个图层

### 查看要素信息

- **点击要素**：弹出详细信息窗口
- **悬停要素**：显示简要信息提示

### 地图工具

- **全屏按钮**：右上角全屏图标，支持全屏查看
- **测量工具**：支持测量距离和面积

### 地图交互

- **缩放**：鼠标滚轮或缩放控件
- **平移**：鼠标拖拽
- **底图**：默认使用 OpenStreetMap

## 常见问题

### Q: 提示缺少库，怎么办？

A: 运行 `pip install -r requirements.txt` 安装所有依赖。

### Q: geopandas 安装失败？

A: 在 Windows 上建议使用 conda：
```bash
conda install geopandas -c conda-forge
```

### Q: 中文显示乱码？

A: 
1. 确保 Shapefile 使用 UTF-8 编码
2. 检查 `app.py` 中读取文件时指定了 `encoding='utf-8'`

### Q: 地图没有显示数据？

A: 
1. 检查 Shapefile 文件路径是否正确
2. 检查 `.shp`, `.shx`, `.dbf` 文件是否都存在
3. 查看控制台输出的错误信息

### Q: 生成的文件很大？

A: 这是正常的，因为 HTML 文件包含了所有地理数据（GeoJSON）。可以：
- 使用 gzip 压缩（Web 服务器自动处理）
- 对于大数据集，考虑使用 GeoJSON 文件外链方式

## 扩展功能

### 添加更多底图

在 `config.py` 中可以添加更多底图选项，然后在 `app.py` 中配置底图切换。

### 添加更多工具

Folium 提供了丰富的插件，可以添加：
- 时间滑块（Timeline）
- 热力图（HeatMap）
- 标记聚类（MarkerCluster）
- 等值线图（Choropleth）

## 性能优化

对于大型数据集，可以：

1. **简化几何**：使用 `gdf.to_crs()` 或几何简化
2. **数据采样**：只显示部分要素
3. **使用 GeoJSON 外链**：将数据保存为单独的 GeoJSON 文件

## 许可证

本项目使用 MIT 许可证。

## 参考资源

- [Folium 文档](https://python-visualization.github.io/folium/)
- [GeoPandas 文档](https://geopandas.org/)
- [Leaflet 文档](https://leafletjs.com/)

