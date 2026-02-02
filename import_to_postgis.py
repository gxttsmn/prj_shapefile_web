# -*- coding: utf-8 -*-
"""
将 Shapefile 数据导入 PostgreSQL + PostGIS
"""

import geopandas as gpd
from sqlalchemy import create_engine, text
import os
import sys

# 修复Windows控制台编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# 数据库连接配置
DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'prj_gis',  # 修改为你的数据库名
    'user': 'postgres',      # 修改为你的用户名
    'password': 'postgres'           # 修改为你的密码
}

def create_connection():
    """创建数据库连接"""
    connection_string = (
        f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
        f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
    )
    engine = create_engine(connection_string)
    return engine

def import_shapefile(shp_path, table_name, layer_name):
    """导入单个 Shapefile 到数据库"""
    print(f"\n正在导入 {layer_name}...")
    
    # 检查文件是否存在
    if not os.path.exists(shp_path):
        print(f"[错误] 文件不存在: {shp_path}")
        return False
    
    # 读取 Shapefile
    try:
        # 尝试多种编码
        encodings = ['gbk', 'gb2312', 'utf-8', 'cp936']
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
                    print("   请在 pgAdmin 4 中手动执行: CREATE EXTENSION IF NOT EXISTS postgis;")
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
        print("   请检查数据库配置和密码")
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
    print("Shapefile 导入 PostgreSQL + PostGIS")
    print("=" * 50)
    
    # 检查数据库配置
    if not DB_CONFIG['password']:
        print("\n⚠ 警告: 请在脚本中设置数据库密码！")
        print("   修改 DB_CONFIG['password'] 的值")
        sys.exit(1)
    
    # Shapefile 文件路径
    base_path = 'shp示例'
    
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
    
    # 导入所有 Shapefile
    success_count = 0
    for shp_info in shapefiles:
        if import_shapefile(shp_info['path'], shp_info['table'], shp_info['name']):
            success_count += 1
    
    print("\n" + "=" * 50)
    print(f"导入完成: {success_count}/{len(shapefiles)} 个文件成功")
    print("=" * 50)
    
    if success_count == len(shapefiles):
        print("\n[OK] 所有数据已成功导入！")
        print("\n可以在 pgAdmin 4 中查看数据：")
        print("  1. 展开数据库 gis_data")
        print("  2. 展开 Schemas → public → Tables")
        print("  3. 查看表: villages, rivers, water_bodies")
    else:
        print("\n⚠ 部分数据导入失败，请检查错误信息")

if __name__ == '__main__':
    main()

