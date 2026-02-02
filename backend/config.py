# -*- coding: utf-8 -*-
"""
数据库配置
"""

# 数据库连接配置
DATABASE_CONFIG = {
    'host': 'localhost', # ubuntu ip: 192.168.50.5
    'port': '5432',
    'database': 'prj_gis',
    'user': 'postgres',
    'password': 'postgres'
}

# 构建数据库连接字符串
def get_database_url():
    """获取数据库连接URL"""
    return (
        f"postgresql://{DATABASE_CONFIG['user']}:{DATABASE_CONFIG['password']}"
        f"@{DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}/{DATABASE_CONFIG['database']}"
    )

# API配置
API_CONFIG = {
    'host': '0.0.0.0',
    'port': 5000,
    'debug': True,
    'cors_enabled': True
}

