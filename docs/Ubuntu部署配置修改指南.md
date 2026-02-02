# Ubuntu 部署配置修改指南

## 部署环境

- **服务器 IP**: 192.168.3.50
- **操作系统**: Ubuntu 22.04
- **部署位置**: `/home/ubuntu/prj/prj_shapefile_web` (示例路径)

## 需要修改的配置文件

### 1. 后端数据库配置

**文件**: `backend/config.py`

**修改内容**:
```python
# 数据库连接配置
DATABASE_CONFIG = {
    'host': 'localhost',  # 如果数据库在同一台服务器，使用 localhost
    'port': '5432',
    'database': 'prj_gis',
    'user': 'postgres',
    'password': ''  # Ubuntu 上 postgres 用户通常无密码
}
```

**说明**:
- 如果 PostgreSQL 在同一台服务器上，`host` 保持为 `localhost`
- 如果 PostgreSQL 在其他服务器上，修改为数据库服务器的 IP
- 根据实际情况设置 `password`（Ubuntu 上通常为空字符串）

---

### 2. 后端 API 服务配置

**文件**: `backend/config.py`

**修改内容**:
```python
# API配置
API_CONFIG = {
    'host': '0.0.0.0',  # 监听所有接口，允许外部访问
    'port': 5000,
    'debug': False,  # 生产环境建议关闭 debug
    'cors_enabled': True
}
```

**说明**:
- `host: '0.0.0.0'` 允许从任何 IP 访问 API
- 如果只需要本地访问，可以设置为 `'localhost'`
- `debug: False` 生产环境建议关闭

---

### 3. 前端 API 地址配置

**文件**: `output/js/api.js`

**修改内容**:
```javascript
// API基础URL
const API_BASE_URL = 'http://192.168.3.50:5000/api';
```

**说明**:
- 修改为 Ubuntu 服务器的 IP 地址
- 如果使用域名，修改为域名地址
- 如果使用 HTTPS，修改为 `https://192.168.3.50:5000/api`

---

### 4. Dify API 配置

**文件**: `output/js/ai-chat.js`

**修改内容**:
```javascript
// Dify配置（临时硬编码，后续可改为从文件加载）
let difyConfig = {
    url: 'http://192.168.3.5/v1',  // Dify 服务器地址
    key: 'app-qo4twJjmaF6mjjIRt1DvvolD',
    loaded: true
};
```

**同时修改 `loadDifyConfig` 函数中的配置**:
```javascript
async function loadDifyConfig() {
    difyConfig.url = 'http://192.168.3.5/v1';  // 修改这里
    difyConfig.key = 'app-qo4twJjmaF6mjjIRt1DvvolD';
    difyConfig.loaded = true;
    return true;
}
```

**说明**:
- 如果 Dify 服务在同一台服务器上，修改为 `http://192.168.3.50/v1`
- 如果 Dify 在其他服务器上，使用实际的 Dify 服务器地址

---

### 5. Dify 配置文件（可选）

**文件**: `output/data/dify_url_key.json`

**修改内容**:
```json
{
    "Dify_url": "http://192.168.3.5/v1",
    "Dify_key": "app-qo4twJjmaF6mjjIRt1DvvolD"
}
```

**说明**:
- 如果后续改为从文件加载配置，需要修改此文件
- 当前代码使用硬编码，此文件暂时不使用

---

## 完整配置修改清单

### 步骤 1: 修改后端配置

编辑 `backend/config.py`:

```python
# -*- coding: utf-8 -*-
"""
数据库配置
"""

# 数据库连接配置
DATABASE_CONFIG = {
    'host': 'localhost',  # 数据库在同一服务器
    'port': '5432',
    'database': 'prj_gis',
    'user': 'postgres',
    'password': ''  # Ubuntu 上通常无密码
}

# 构建数据库连接字符串
def get_database_url():
    """获取数据库连接URL"""
    user = DATABASE_CONFIG['user']
    password = DATABASE_CONFIG['password']
    host = DATABASE_CONFIG['host']
    port = DATABASE_CONFIG['port']
    database = DATABASE_CONFIG['database']
    
    # 如果密码为空，使用无密码连接格式
    if password:
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    else:
        return f"postgresql://{user}@{host}:{port}/{database}"

# API配置
API_CONFIG = {
    'host': '0.0.0.0',  # 允许外部访问
    'port': 5000,
    'debug': False,  # 生产环境关闭 debug
    'cors_enabled': True
}
```

### 步骤 2: 修改前端 API 地址

编辑 `output/js/api.js`:

```javascript
// API基础URL
const API_BASE_URL = 'http://192.168.3.50:5000/api';
```

### 步骤 3: 修改 Dify 配置

编辑 `output/js/ai-chat.js`:

找到以下两处并修改：

```javascript
// 第 15-19 行
let difyConfig = {
    url: 'http://192.168.3.5/v1',  // 修改为实际 Dify 地址
    key: 'app-qo4twJjmaF6mjjIRt1DvvolD',
    loaded: true
};

// 第 28 行（在 loadDifyConfig 函数中）
difyConfig.url = 'http://192.168.3.5/v1';  // 修改为实际 Dify 地址
```

---

## 部署后验证

### 1. 验证后端 API

```bash
# 在 Ubuntu 服务器上
curl http://localhost:5000/health
curl http://localhost:5000/api/villages

# 从其他机器测试
curl http://192.168.3.50:5000/health
curl http://192.168.3.50:5000/api/villages
```

### 2. 验证前端访问

在浏览器中访问：
```
http://192.168.3.50:8000/map_api.html
```

或如果使用 Nginx：
```
http://192.168.3.50/map_api.html
```

### 3. 验证 Dify 连接

打开浏览器开发者工具（F12），在 AI 聊天窗口执行命令，查看控制台是否有 Dify 连接错误。

---

## 防火墙配置

确保防火墙允许以下端口：

```bash
# 允许 API 端口
sudo ufw allow 5000/tcp

# 如果使用 HTTP 服务器提供前端
sudo ufw allow 8000/tcp

# 如果使用 Nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 使用 Nginx 反向代理（推荐）

### 配置 Nginx

创建配置文件 `/etc/nginx/sites-available/gis-app`:

```nginx
server {
    listen 80;
    server_name 192.168.3.50;  # 或使用域名

    # 前端静态文件
    location / {
        root /home/ubuntu/prj/prj_shapefile_web/output;
        index map_api.html;
        try_files $uri $uri/ /map_api.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:5000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS 头（如果需要）
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/gis-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**修改前端 API 地址**:
```javascript
// output/js/api.js
const API_BASE_URL = '/api';  // 使用相对路径，通过 Nginx 代理
```

---

## 快速配置脚本

在 Ubuntu 服务器上创建配置脚本 `configure_deployment.sh`:

```bash
#!/bin/bash

PROJECT_DIR="/home/ubuntu/prj/prj_shapefile_web"
SERVER_IP="192.168.3.50"
DIFY_IP="192.168.3.5"  # 根据实际情况修改

echo "配置项目部署..."

# 1. 修改后端 API 配置
sed -i "s/'host': 'localhost'/'host': '0.0.0.0'/" "$PROJECT_DIR/backend/config.py"
sed -i "s/'debug': True/'debug': False/" "$PROJECT_DIR/backend/config.py"

# 2. 修改前端 API 地址
sed -i "s|const API_BASE_URL = 'http://localhost:5000/api'|const API_BASE_URL = 'http://$SERVER_IP:5000/api'|" "$PROJECT_DIR/output/js/api.js"

# 3. 修改 Dify 配置
sed -i "s|url: 'http://192.168.3.5/v1'|url: 'http://$DIFY_IP/v1'|" "$PROJECT_DIR/output/js/ai-chat.js"
sed -i "s|difyConfig.url = 'http://192.168.3.5/v1'|difyConfig.url = 'http://$DIFY_IP/v1'|" "$PROJECT_DIR/output/js/ai-chat.js"

echo "配置完成！"
echo "请检查以下配置："
echo "1. 数据库配置: $PROJECT_DIR/backend/config.py"
echo "2. 前端 API 地址: $PROJECT_DIR/output/js/api.js"
echo "3. Dify 配置: $PROJECT_DIR/output/js/ai-chat.js"
```

运行脚本：

```bash
chmod +x configure_deployment.sh
./configure_deployment.sh
```

---

## 配置检查清单

部署前请确认：

- [ ] 数据库配置正确（`backend/config.py`）
- [ ] API 服务监听地址为 `0.0.0.0`（允许外部访问）
- [ ] 前端 API 地址指向正确的服务器 IP
- [ ] Dify 配置指向正确的 Dify 服务器
- [ ] 防火墙已开放必要端口
- [ ] PostgreSQL 服务正常运行
- [ ] 数据库已创建并导入数据
- [ ] Python 依赖已安装
- [ ] 前端文件路径正确

---

## 常见问题

### Q1: 前端无法连接 API

**检查**:
1. API 服务是否运行: `curl http://localhost:5000/health`
2. API 配置中的 `host` 是否为 `0.0.0.0`
3. 防火墙是否允许 5000 端口
4. 前端 API 地址是否正确

### Q2: CORS 错误

**解决**:
1. 确保 `backend/config.py` 中 `cors_enabled = True`
2. 检查后端 CORS 配置
3. 如果使用 Nginx，在 Nginx 配置中添加 CORS 头

### Q3: 数据库连接失败

**检查**:
1. PostgreSQL 服务是否运行
2. 数据库配置是否正确
3. 数据库用户权限
4. `pg_hba.conf` 配置

---

**版本**: 1.0.0  
**最后更新**: 2024年

