# GIS数据API服务使用说明

## 一、启动API服务

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

**方式1：使用启动脚本（推荐）**
```bash
# 在项目根目录下运行
python run_api.py
```

**方式2：使用模块方式运行**
```bash
# 在项目根目录下运行
python -m backend.app
```

**方式3：直接运行（已修复路径问题）**
```bash
# 可以在任何目录下运行
python backend/app.py
```

服务将在 `http://localhost:5000` 启动

**注意**：确保在项目根目录下运行，或者使用 `run_api.py` 脚本

---

## 二、API端点

### 村庄（点）数据

- `GET /api/villages` - 获取所有村庄
- `GET /api/villages/{gid}` - 获取单个村庄
- `POST /api/villages` - 创建村庄
- `PUT /api/villages/{gid}` - 更新村庄
- `DELETE /api/villages/{gid}` - 删除村庄

### 河渠（线）数据

- `GET /api/rivers` - 获取所有河渠
- `GET /api/rivers/{gid}` - 获取单个河渠
- `POST /api/rivers` - 创建河渠
- `PUT /api/rivers/{gid}` - 更新河渠
- `DELETE /api/rivers/{gid}` - 删除河渠

### 水系（面）数据

- `GET /api/water_bodies` - 获取所有水系
- `GET /api/water_bodies/{gid}` - 获取单个水系
- `POST /api/water_bodies` - 创建水系
- `PUT /api/water_bodies/{gid}` - 更新水系
- `DELETE /api/water_bodies/{gid}` - 删除水系

---

## 三、前端集成

### 1. 启动前端

前端会自动从API加载数据，如果API服务未启动，会回退到GeoJSON文件加载。

### 2. 数据加载流程

1. 优先从API加载数据（`loadVillages()`, `loadRivers()`, `loadWaterBodies()`）
2. 如果API失败，回退到GeoJSON文件加载
3. 确保数据始终可用

---

## 四、项目结构

```
prj_shapefile_web/
├── backend/                  # 后端API服务
│   ├── app.py               # Flask主应用
│   ├── config.py            # 配置
│   ├── routes/              # API路由
│   │   ├── villages.py
│   │   ├── rivers.py
│   │   └── water_bodies.py
│   └── utils/               # 工具函数
│       ├── db.py            # 数据库操作
│       └── geojson.py       # GeoJSON转换
├── output/                   # 前端文件
│   ├── map.html
│   └── js/
│       ├── api.js           # API调用模块
│       ├── main.js          # 主控制逻辑
│       ├── parser.js        # 指令解析
│       ├── query.js         # 要素查询
│       └── labeling.js      # 标注管理
└── requirements.txt         # Python依赖
```

---

## 五、配置

### 数据库配置

编辑 `backend/config.py`：

```python
DATABASE_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'prj_gis',
    'user': 'postgres',
    'password': 'postgres'
}
```

### API配置

编辑 `backend/config.py`：

```python
API_CONFIG = {
    'host': 'localhost',
    'port': 5000,
    'debug': True,
    'cors_enabled': True
}
```

---

## 六、测试API

### 使用curl测试

```bash
# 获取所有村庄
curl http://localhost:5000/api/villages

# 获取单个村庄
curl http://localhost:5000/api/villages/1

# 删除村庄
curl -X DELETE http://localhost:5000/api/villages/1
```

### 使用浏览器测试

访问 `http://localhost:5000/api/villages` 查看返回的GeoJSON数据

---

## 七、注意事项

1. **数据库连接**：确保PostgreSQL + PostGIS服务已启动
2. **CORS**：前端和API在不同端口时，已启用CORS支持
3. **错误处理**：API失败时会自动回退到文件加载
4. **数据同步**：修改数据后，前端需要重新加载以获取最新数据

