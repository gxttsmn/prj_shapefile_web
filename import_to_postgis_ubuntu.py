# -*- coding: utf-8 -*-
"""
将 Shapefile 数据导入 PostgreSQL + PostGIS (Ubuntu 22.04 版本)
适用于无密码的 postgres 用户
"""

import geopandas as gpd
from sqlalchemy import create_engine, text
import os
import sys

# 修复控制台编码问题（Linux系统通常不需要，但保留以防万一）
if sys.platform == 'linux':
    try:
        import locale
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except:
        pass

# 数据库连接配置（Ubuntu 22.04，无密码）
DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'prj_gis',  # 数据库名
    'user': 'postgres',      # 用户名
    'password': ''           # 无密码
}

def create_connection():
    """创建数据库连接"""
    # 如果密码为空，尝试多种连接方式
    if DB_CONFIG['password']:
        connection_string = (
            f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
            f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        )
        engine = create_engine(connection_string)
        return engine
    else:
        # 无密码连接方式1：优先尝试使用 Unix socket（peer 认证）
        # 这种方式不需要密码，使用系统用户认证
        connection_strings = [
            # 方式1: Unix socket 连接（推荐，使用 peer 认证）
            f"postgresql://{DB_CONFIG['user']}@/{DB_CONFIG['database']}",
            # 方式2: TCP/IP 连接（需要 pg_hba.conf 配置为 trust）
            f"postgresql://{DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        ]
        
        last_error = None
        for i, conn_str in enumerate(connection_strings, 1):
            try:
                print(f"[调试] 尝试连接方式 {i}: {conn_str}")
                engine = create_engine(conn_str)
                # 测试连接
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                print(f"[OK] 连接方式 {i} 成功")
                return engine
            except Exception as e:
                last_error = e
                print(f"[调试] 连接方式 {i} 失败: {e}")
                continue
        
        # 所有方式都失败，抛出最后一个错误
        raise last_error

def import_shapefile(shp_path, table_name, layer_name):
    """导入单个 Shapefile 到数据库"""
    print(f"\n正在导入 {layer_name}...")
    
    # 检查文件是否存在
    if not os.path.exists(shp_path):
        print(f"[错误] 文件不存在: {shp_path}")
        return False
    
    # 读取 Shapefile
    try:
        # Linux系统通常使用UTF-8编码，但也可以尝试其他编码
        encodings = ['utf-8', 'gbk', 'gb2312', 'latin1']
        gdf = None
        
        for encoding in encodings:
            try:
                gdf = gpd.read_file(shp_path, encoding=encoding)
                print(f"[OK] 成功读取: {len(gdf)} 个要素 (编码: {encoding})")
                break
            except (UnicodeDecodeError, LookupError):
                continue
        
        if gdf is None:
            print(f"[错误] 无法读取文件: {shp_path}")
            return False
            
    except Exception as e:
        print(f"[错误] 读取失败: {e}")
        return False
    
    # 确保坐标系为 WGS84 (EPSG:4326)
    if gdf.crs is None:
        print("⚠ 警告: 未检测到坐标系，设置为 WGS84")
        gdf.set_crs(epsg=4326, inplace=True)
    else:
        current_epsg = gdf.crs.to_epsg()
        if current_epsg != 4326:
            print(f"⚠ 坐标系为 EPSG:{current_epsg}，转换为 WGS84 (EPSG:4326)")
            gdf.to_crs(epsg=4326, inplace=True)
        else:
            print(f"[OK] 坐标系为 WGS84 (EPSG:4326)")
    
    # 创建数据库连接
    try:
        engine = create_connection()
        # 测试连接（SQLAlchemy 2.0 需要使用 text() 包装 SQL）
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            # 确保 PostGIS 扩展已启用
            try:
                # 检查 PostGIS 是否已安装
                result = conn.execute(text("SELECT COUNT(*) FROM pg_extension WHERE extname = 'postgis'"))
                ext_count = result.scalar()
                
                if ext_count == 0:
                    print("[提示] 正在启用 PostGIS 扩展...")
                    # 使用 autocommit 模式执行 CREATE EXTENSION
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
                    conn.commit()
                    print("[OK] PostGIS 扩展已启用")
                else:
                    print("[OK] PostGIS 扩展已存在")
                
                # 验证 geometry 类型是否存在
                result = conn.execute(text("SELECT COUNT(*) FROM pg_type WHERE typname = 'geometry'"))
                geom_count = result.scalar()
                if geom_count == 0:
                    print("[错误] PostGIS geometry 类型不存在")
                    print("   请手动在数据库中执行: CREATE EXTENSION IF NOT EXISTS postgis;")
                    print("   或检查 PostGIS 是否正确安装")
                    return False
                else:
                    print("[OK] PostGIS geometry 类型可用")
                    
            except Exception as ext_error:
                print(f"[警告] PostGIS 扩展检查失败: {ext_error}")
                print("   请手动在数据库中执行: CREATE EXTENSION IF NOT EXISTS postgis")
                return False
    except Exception as e:
        print(f"[错误] 数据库连接失败: {e}")
        print("   请检查:")
        print("   1. PostgreSQL 服务是否运行: sudo systemctl status postgresql")
        print("   2. 数据库 'prj_gis' 是否存在")
        print("   3. postgres 用户是否有权限访问数据库")
        print("   4. pg_hba.conf 配置是否正确（peer 或 trust 认证）")
        return False
    
    # 导入到数据库
    try:
        gdf.to_postgis(
            table_name,
            engine,
            if_exists='replace',  # 如果表存在则替换
            index=True,           # 创建索引
            schema='public'
        )
        print(f"[OK] 成功导入到表: public.{table_name}")
        
        # 显示表信息
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM public.{table_name}"))
            count = result.scalar()
            print(f"[OK] 表中现有 {count} 条记录")
        
        return True
    except Exception as e:
        print(f"[错误] 导入失败: {e}")
        return False

def main():
    """主函数"""
    print("=" * 50)
    print("Shapefile 导入 PostgreSQL + PostGIS (Ubuntu 22.04)")
    print("=" * 50)
    
    # 检查数据库配置
    print(f"\n数据库配置:")
    print(f"  主机: {DB_CONFIG['host']}")
    print(f"  端口: {DB_CONFIG['port']}")
    print(f"  数据库: {DB_CONFIG['database']}")
    print(f"  用户: {DB_CONFIG['user']}")
    print(f"  密码: {'(无密码)' if not DB_CONFIG['password'] else '***'}")
    
    # Shapefile 文件路径（Linux系统使用正斜杠）
    # 请根据实际路径修改
    base_path = 'shp示例'  # 或使用绝对路径，如: '/home/username/shp示例'
    
    shapefiles = [
        {
            'path': os.path.join(base_path, '点_村.shp'),
            'table': 'villages',
            'name': '村庄（点）'
        },
        {
            'path': os.path.join(base_path, '线_河渠.shp'),
            'table': 'rivers',
            'name': '河渠（线）'
        },
        {
            'path': os.path.join(base_path, '面_水系.shp'),
            'table': 'water_bodies',
            'name': '水系（面）'
        }
    ]
    
    # 检查文件是否存在
    print(f"\n检查 Shapefile 文件...")
    missing_files = []
    for shp_info in shapefiles:
        if not os.path.exists(shp_info['path']):
            missing_files.append(shp_info['path'])
            print(f"  [警告] 文件不存在: {shp_info['path']}")
    
    if missing_files:
        print(f"\n⚠ 警告: 发现 {len(missing_files)} 个文件不存在")
        print("   请检查:")
        print("   1. 文件路径是否正确")
        print("   2. base_path 变量是否指向正确的目录")
        print("   3. 文件是否已复制到 Ubuntu 系统")
        response = input("\n是否继续导入存在的文件? (y/n): ")
        if response.lower() != 'y':
            print("已取消导入")
            return
    
    # 导入所有 Shapefile
    success_count = 0
    for shp_info in shapefiles:
        if os.path.exists(shp_info['path']):
            if import_shapefile(shp_info['path'], shp_info['table'], shp_info['name']):
                success_count += 1
        else:
            print(f"\n跳过不存在的文件: {shp_info['name']}")
    
    print("\n" + "=" * 50)
    print(f"导入完成: {success_count}/{len(shapefiles)} 个文件成功")
    print("=" * 50)
    
    if success_count == len(shapefiles):
        print("\n[OK] 所有数据已成功导入！")
        print("\n可以在数据库中查看数据：")
        print("  1. 使用 psql: psql -U postgres -d prj_gis")
        print("  2. 使用 pgAdmin 或其他数据库管理工具")
        print("  3. 查看表: villages, rivers, water_bodies")
    else:
        print("\n⚠ 部分数据导入失败，请检查错误信息")

if __name__ == '__main__':
    main()

