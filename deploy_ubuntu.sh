#!/bin/bash
# Ubuntu 22.04 自动部署脚本
# 用于快速部署 GIS 数据可视化项目到 Ubuntu 系统

set -e  # 遇到错误立即退出

echo "=========================================="
echo "GIS 数据可视化项目 - Ubuntu 部署脚本"
echo "=========================================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}✗ 错误: 请不要使用 root 用户运行此脚本${NC}"
    echo "   请使用普通用户运行，脚本会在需要时请求 sudo 权限"
    exit 1
fi

# 获取项目目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "项目目录: $PROJECT_DIR"
echo ""

# 步骤 1: 检查系统
echo "步骤 1: 检查系统环境..."
if [ ! -f /etc/os-release ]; then
    echo -e "${RED}✗ 错误: 无法检测操作系统${NC}"
    exit 1
fi

. /etc/os-release
echo "操作系统: $PRETTY_NAME"
echo ""

# 步骤 2: 更新系统包
echo "步骤 2: 更新系统包..."
read -p "是否更新系统包? (y/n): " update_system
if [ "$update_system" = "y" ]; then
    sudo apt-get update
    sudo apt-get upgrade -y
fi
echo ""

# 步骤 3: 安装系统依赖
echo "步骤 3: 安装系统依赖..."
echo "正在安装 Python、PostgreSQL、PostGIS 和 GeoPandas 依赖..."

sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    postgresql \
    postgresql-contrib \
    postgis \
    postgresql-14-postgis-3 \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    libproj-dev \
    proj-data \
    proj-bin \
    libgeos-dev \
    libspatialindex-dev \
    build-essential

echo -e "${GREEN}✓ 系统依赖安装完成${NC}"
echo ""

# 步骤 4: 配置 PostgreSQL
echo "步骤 4: 配置 PostgreSQL..."
echo "检查 PostgreSQL 服务状态..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 检查数据库是否存在
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw prj_gis; then
    echo -e "${YELLOW}ℹ 数据库 'prj_gis' 已存在${NC}"
else
    echo "创建数据库 'prj_gis'..."
    sudo -u postgres psql -c "CREATE DATABASE prj_gis;"
    sudo -u postgres psql -d prj_gis -c "CREATE EXTENSION IF NOT EXISTS postgis;"
    echo -e "${GREEN}✓ 数据库创建完成${NC}"
fi
echo ""

# 步骤 5: 创建 Python 虚拟环境
echo "步骤 5: 创建 Python 虚拟环境..."
if [ -d "$PROJECT_DIR/venv" ]; then
    echo -e "${YELLOW}ℹ 虚拟环境已存在，跳过创建${NC}"
else
    python3 -m venv "$PROJECT_DIR/venv"
    echo -e "${GREEN}✓ 虚拟环境创建完成${NC}"
fi
echo ""

# 步骤 6: 安装 Python 依赖
echo "步骤 6: 安装 Python 依赖..."
source "$PROJECT_DIR/venv/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_DIR/requirements.txt"
echo -e "${GREEN}✓ Python 依赖安装完成${NC}"
echo ""

# 步骤 7: 配置项目
echo "步骤 7: 配置项目..."
echo "检查配置文件..."

# 备份原配置
if [ -f "$PROJECT_DIR/backend/config.py" ]; then
    if [ ! -f "$PROJECT_DIR/backend/config.py.backup" ]; then
        cp "$PROJECT_DIR/backend/config.py" "$PROJECT_DIR/backend/config.py.backup"
        echo "✓ 已备份原配置文件"
    fi
fi

# 提示用户配置数据库
echo ""
echo "请配置数据库连接信息:"
read -p "数据库主机 [localhost]: " db_host
db_host=${db_host:-localhost}

read -p "数据库端口 [5432]: " db_port
db_port=${db_port:-5432}

read -p "数据库用户 [postgres]: " db_user
db_user=${db_user:-postgres}

read -sp "数据库密码 (留空表示无密码): " db_password
echo ""

# 更新配置文件（简单方式，使用 sed）
if [ -f "$PROJECT_DIR/backend/config.py" ]; then
    # 这里可以添加自动更新配置的逻辑
    echo -e "${YELLOW}ℹ 请手动编辑 $PROJECT_DIR/backend/config.py 配置数据库连接${NC}"
    echo "   数据库配置:"
    echo "   host: $db_host"
    echo "   port: $db_port"
    echo "   user: $db_user"
    echo "   password: ${db_password:-'(无密码)'}"
fi
echo ""

# 步骤 8: 测试数据库连接
echo "步骤 8: 测试数据库连接..."
read -p "是否测试数据库连接? (y/n): " test_db
if [ "$test_db" = "y" ]; then
    if python3 -c "
import sys
sys.path.insert(0, '$PROJECT_DIR')
from backend.config import get_database_url
from sqlalchemy import create_engine, text
try:
    engine = create_engine(get_database_url())
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    print('✓ 数据库连接成功')
except Exception as e:
    print(f'✗ 数据库连接失败: {e}')
    sys.exit(1)
" 2>/dev/null; then
        echo -e "${GREEN}✓ 数据库连接测试成功${NC}"
    else
        echo -e "${RED}✗ 数据库连接测试失败${NC}"
        echo "   请检查数据库配置和连接"
    fi
fi
echo ""

# 步骤 9: 导入数据（可选）
echo "步骤 9: 导入数据..."
read -p "是否导入 Shapefile 数据? (y/n): " import_data
if [ "$import_data" = "y" ]; then
    if [ -f "$PROJECT_DIR/import_to_postgis_ubuntu.py" ]; then
        echo "运行数据导入脚本..."
        python3 "$PROJECT_DIR/import_to_postgis_ubuntu.py"
    else
        echo -e "${YELLOW}ℹ 导入脚本不存在，跳过${NC}"
    fi
fi
echo ""

# 步骤 10: 创建 systemd 服务（可选）
echo "步骤 10: 创建 systemd 服务..."
read -p "是否创建 systemd 服务? (y/n): " create_service
if [ "$create_service" = "y" ]; then
    SERVICE_FILE="/etc/systemd/system/gis-api.service"
    SERVICE_USER=$(whoami)
    
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=GIS Data API Service
After=network.target postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
ExecStart=$PROJECT_DIR/venv/bin/python3 $PROJECT_DIR/run_api.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    echo -e "${GREEN}✓ systemd 服务已创建${NC}"
    echo ""
    echo "服务管理命令:"
    echo "  启动: sudo systemctl start gis-api"
    echo "  停止: sudo systemctl stop gis-api"
    echo "  状态: sudo systemctl status gis-api"
    echo "  日志: sudo journalctl -u gis-api -f"
fi
echo ""

# 完成
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "下一步操作:"
echo "1. 编辑配置文件: nano $PROJECT_DIR/backend/config.py"
echo "2. 启动服务:"
echo "   开发模式: cd $PROJECT_DIR && source venv/bin/activate && python3 run_api.py"
echo "   生产模式: sudo systemctl start gis-api"
echo ""
echo "访问地址:"
echo "  API: http://localhost:5000"
echo "  前端: http://localhost:5000 (如果配置了静态文件服务)"
echo ""
echo "详细文档: docs/Ubuntu部署指南.md"
echo ""

