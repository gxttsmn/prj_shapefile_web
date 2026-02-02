# Ubuntu 22.04 部署指南

## 概述

本项目**可以直接部署在 Ubuntu 上运行**。代码本身是跨平台的，只需要：
1. 安装系统依赖
2. 配置 Python 环境
3. 调整数据库配置
4. 启动服务

---

## 系统要求

- **操作系统**: Ubuntu 22.04 LTS（或其他 Ubuntu 版本）
- **Python**: Python 3.8 或更高版本
- **PostgreSQL**: PostgreSQL 12+ 和 PostGIS 扩展
- **内存**: 建议至少 2GB RAM
- **磁盘**: 至少 1GB 可用空间

---

## 部署步骤

### 步骤 1: 安装系统依赖

#### 1.1 更新系统包

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

#### 1.2 安装 Python 和 pip

```bash
sudo apt-get install -y python3 python3-pip python3-venv
```

#### 1.3 安装 GeoPandas 系统依赖

GeoPandas 需要以下系统库：

```bash
sudo apt-get install -y \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    libproj-dev \
    proj-data \
    proj-bin \
    libgeos-dev \
    libspatialindex-dev \
    build-essential
```

**注意**: 这些依赖是 GeoPandas 正常工作所必需的。

#### 1.4 安装 PostgreSQL 和 PostGIS

```bash
# 安装 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 安装 PostGIS
sudo apt-get install -y postgis postgresql-14-postgis-3

# 启动 PostgreSQL 服务
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

### 步骤 2: 配置数据库

#### 2.1 创建数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 psql 中执行
CREATE DATABASE prj_gis;
\c prj_gis
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

#### 2.2 配置数据库连接（如果需要远程连接）

如果前端在另一台机器上，需要配置 PostgreSQL 允许远程连接：

```bash
# 编辑 postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# 找到并修改
listen_addresses = '*'

# 编辑 pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# 添加（允许本地连接，无密码）
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

详细配置请参考: `docs/Ubuntu数据库远程连接配置指南.md`

---

### 步骤 3: 部署项目代码

#### 3.1 克隆或复制项目

```bash
# 如果使用 git
git clone <repository-url>
cd prj_shapefile_web

# 或直接复制项目文件到 Ubuntu
# 使用 scp、rsync 或其他方式
```

#### 3.2 创建 Python 虚拟环境

```bash
# 在项目根目录
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate
```

#### 3.3 安装 Python 依赖

```bash
# 升级 pip
pip install --upgrade pip

# 安装项目依赖
pip install -r requirements.txt
```

**注意**: 如果 GeoPandas 安装失败，可能需要先安装系统依赖（见步骤 1.3）。

---

### 步骤 4: 配置项目

#### 4.1 修改数据库配置

编辑 `backend/config.py`:

```python
DATABASE_CONFIG = {
    'host': 'localhost',  # 如果数据库在本地，使用 localhost
    'port': '5432',
    'database': 'prj_gis',
    'user': 'postgres',
    'password': ''  # Ubuntu 上 postgres 用户通常无密码
}
```

#### 4.2 修改 API 配置（可选）

如果需要从外部访问 API，编辑 `backend/config.py`:

```python
API_CONFIG = {
    'host': '0.0.0.0',  # 监听所有接口，允许外部访问
    'port': 5000,
    'debug': False,  # 生产环境建议关闭 debug
    'cors_enabled': True
}
```

#### 4.3 导入数据（如果还没有）

```bash
# 确保 Shapefile 文件在正确位置
# 运行导入脚本
python3 import_to_postgis_ubuntu.py
```

---

### 步骤 5: 启动服务

#### 5.1 开发模式（直接运行）

```bash
# 激活虚拟环境（如果还没有）
source venv/bin/activate

# 启动 API 服务
python3 run_api.py
```

服务将在 `http://localhost:5000` 启动。

#### 5.2 生产模式（使用 systemd 服务）

创建 systemd 服务文件 `/etc/systemd/system/gis-api.service`:

```ini
[Unit]
Description=GIS Data API Service
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/prj_shapefile_web
Environment="PATH=/home/ubuntu/prj_shapefile_web/venv/bin"
ExecStart=/home/ubuntu/prj_shapefile_web/venv/bin/python3 /home/ubuntu/prj_shapefile_web/run_api.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**启用并启动服务**:

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable gis-api

# 启动服务
sudo systemctl start gis-api

# 查看服务状态
sudo systemctl status gis-api

# 查看日志
sudo journalctl -u gis-api -f
```

#### 5.3 使用 Nginx 反向代理（可选）

如果需要通过 80 端口访问，可以配置 Nginx：

```bash
# 安装 Nginx
sudo apt-get install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/gis-api
```

配置文件内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 或使用 IP 地址

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件（如果需要）
    location /static {
        alias /home/ubuntu/prj_shapefile_web/output;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/gis-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### 步骤 6: 配置前端

#### 6.1 修改前端 API 地址

如果 API 不在 `localhost:5000`，需要修改前端文件中的 API 地址。

编辑 `output/js/api.js`，找到 API 基础 URL：

```javascript
const API_BASE_URL = 'http://your-ubuntu-ip:5000';  // 修改为实际地址
```

#### 6.2 部署前端文件

前端文件在 `output/` 目录下，可以：

**选项 A: 使用 Nginx 提供静态文件**

```bash
# 修改 Nginx 配置（见步骤 5.3）
# 将 output 目录复制到 Nginx 默认目录
sudo cp -r output/* /var/www/html/
```

**选项 B: 使用 Python 简单 HTTP 服务器**

```bash
cd output
python3 -m http.server 8000
```

访问: `http://your-ubuntu-ip:8000/map_api.html`

---

## 验证部署

### 1. 检查 API 服务

```bash
# 测试 API 健康检查
curl http://localhost:5000/health

# 测试 API 端点
curl http://localhost:5000/api/villages
```

### 2. 检查前端

在浏览器中访问:
- `http://your-ubuntu-ip:5000/` (API 根路径)
- `http://your-ubuntu-ip:8000/map_api.html` (前端页面)

### 3. 检查数据库连接

```bash
# 测试数据库连接
psql -U postgres -d prj_gis -c "SELECT COUNT(*) FROM villages;"
```

---

## 常见问题

### Q1: GeoPandas 安装失败

**解决方案**:
```bash
# 确保已安装所有系统依赖
sudo apt-get install -y gdal-bin libgdal-dev python3-gdal

# 重新安装
pip install --upgrade pip
pip install --no-cache-dir geopandas
```

### Q2: 数据库连接失败

**检查清单**:
1. PostgreSQL 服务是否运行: `sudo systemctl status postgresql`
2. 数据库是否存在: `sudo -u postgres psql -l | grep prj_gis`
3. 配置是否正确: 检查 `backend/config.py`
4. 连接测试: `psql -U postgres -d prj_gis -h localhost`

### Q3: API 无法从外部访问

**解决方案**:
1. 修改 `backend/config.py` 中 `API_CONFIG['host'] = '0.0.0.0'`
2. 检查防火墙: `sudo ufw allow 5000/tcp`
3. 检查服务是否监听正确接口: `sudo netstat -tlnp | grep 5000`

### Q4: 前端无法连接 API

**解决方案**:
1. 检查 API 地址是否正确
2. 检查 CORS 是否启用: `backend/config.py` 中 `cors_enabled = True`
3. 检查防火墙规则
4. 检查浏览器控制台错误信息

### Q5: 服务启动后立即退出

**解决方案**:
```bash
# 查看详细错误信息
python3 run_api.py

# 或查看 systemd 日志
sudo journalctl -u gis-api -n 50
```

---

## 性能优化

### 1. 使用 Gunicorn（生产环境推荐）

```bash
# 安装 Gunicorn
pip install gunicorn

# 启动服务
gunicorn -w 4 -b 0.0.0.0:5000 "backend.app:create_app()"
```

### 2. 使用 Supervisor 管理进程

```bash
# 安装 Supervisor
sudo apt-get install -y supervisor

# 创建配置文件
sudo nano /etc/supervisor/conf.d/gis-api.conf
```

配置文件内容：

```ini
[program:gis-api]
command=/home/ubuntu/prj_shapefile_web/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 "backend.app:create_app()"
directory=/home/ubuntu/prj_shapefile_web
user=ubuntu
autostart=true
autorestart=true
stderr_logfile=/var/log/gis-api.err.log
stdout_logfile=/var/log/gis-api.out.log
```

启动：

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start gis-api
```

---

## 安全建议

1. **生产环境配置**:
   - 关闭 debug 模式: `debug = False`
   - 使用强密码: 配置数据库密码
   - 使用 HTTPS: 配置 SSL 证书

2. **防火墙配置**:
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp     # HTTP (如果使用 Nginx)
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

3. **数据库安全**:
   - 不要使用 `trust` 认证（生产环境）
   - 限制数据库访问 IP
   - 定期备份数据库

---

## 维护

### 更新代码

```bash
# 停止服务
sudo systemctl stop gis-api

# 更新代码
git pull  # 或手动更新文件

# 更新依赖（如果需要）
source venv/bin/activate
pip install -r requirements.txt --upgrade

# 重启服务
sudo systemctl start gis-api
```

### 查看日志

```bash
# systemd 服务日志
sudo journalctl -u gis-api -f

# 或应用日志（如果配置了）
tail -f /var/log/gis-api.out.log
```

### 备份数据库

```bash
# 备份数据库
sudo -u postgres pg_dump prj_gis > backup_$(date +%Y%m%d).sql

# 恢复数据库
sudo -u postgres psql prj_gis < backup_20240101.sql
```

---

## 总结

✅ **项目可以直接部署在 Ubuntu 上**

主要步骤：
1. ✅ 安装系统依赖（GeoPandas、PostgreSQL、PostGIS）
2. ✅ 配置数据库
3. ✅ 安装 Python 依赖
4. ✅ 调整配置文件
5. ✅ 启动服务

代码本身是跨平台的，只需要调整配置即可。

---

**版本**: 1.0.0  
**最后更新**: 2024年

