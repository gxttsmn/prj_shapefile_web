# -*- coding: utf-8 -*-
"""
数据库操作工具
"""

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
import geopandas as gpd
from backend.config import get_database_url
import sys

# 修复Windows控制台编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# 创建数据库引擎（使用连接池）
_engine = None

def get_engine():
    """获取数据库引擎（单例模式）"""
    global _engine
    if _engine is None:
        _engine = create_engine(
            get_database_url(),
            poolclass=NullPool,  # 不使用连接池，避免PostGIS类型问题
            echo=False
        )
    return _engine

def execute_query(sql, params=None):
    """
    执行SQL查询
    
    参数:
        sql: SQL语句
        params: 参数字典
    
    返回:
        查询结果
    """
    engine = get_engine()
    with engine.connect() as conn:
        if params:
            result = conn.execute(text(sql), params)
        else:
            result = conn.execute(text(sql))
        return result

def get_table_columns(table_name, schema='public'):
    """
    Get list of column names for a PostGIS table (for filtering gdf columns on insert/update).
    """
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = :table_name
                ORDER BY ordinal_position
            """),
            {'schema': schema, 'table_name': table_name}
        )
        return [row[0] for row in result]


def get_table_not_null_columns_without_default(table_name, schema='public'):
    """
    Get (column_name, data_type) for columns that are NOT NULL and have no default.
    Used to fill default values on insert when request does not provide them.
    """
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT column_name, data_type FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = :table_name
                  AND is_nullable = 'NO'
                  AND (column_default IS NULL OR column_default = '')
                ORDER BY ordinal_position
            """),
            {'schema': schema, 'table_name': table_name}
        )
        return [(row[0], row[1]) for row in result]


def read_postgis_table(table_name, geom_col='geometry', where_clause=None, include_inactive=False):
    """
    从PostGIS表读取数据
    
    参数:
        table_name: 表名
        geom_col: 几何列名（默认'geometry'）
        where_clause: WHERE子句（可选）
        include_inactive: 是否包含无效数据（默认False，只查询status=1的记录）
    
    返回:
        GeoDataFrame对象
    """
    engine = get_engine()
    
    # 构建WHERE子句
    conditions = []
    
    # 默认只查询有效数据（status=1）
    if not include_inactive:
        conditions.append("status = 1")
    
    # 添加用户指定的WHERE子句
    if where_clause:
        conditions.append(f"({where_clause})")
    
    # 构建SQL
    sql = f"SELECT * FROM {table_name}"
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    
    print(f"[DEBUG] 执行SQL: {sql}")
    
    try:
        # 先检查表是否存在
        with engine.connect() as conn:
            check_sql = text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table_name}')")
            result = conn.execute(check_sql)
            table_exists = result.scalar()
            print(f"[DEBUG] 表 {table_name} 是否存在: {table_exists}")
            
            if not table_exists:
                print(f"[ERROR] 表 {table_name} 不存在")
                return None
            
            # 检查记录数（只统计有效数据）
            if not include_inactive:
                count_sql = text(f"SELECT COUNT(*) FROM {table_name} WHERE status = 1")
            else:
                count_sql = text(f"SELECT COUNT(*) FROM {table_name}")
            result = conn.execute(count_sql)
            count = result.scalar()
            print(f"[DEBUG] 表 {table_name} 有效记录数: {count}")
        
        gdf = gpd.read_postgis(
            sql,
            engine,
            geom_col=geom_col
        )
        
        if gdf is not None:
            print(f"[DEBUG] 读取成功，GeoDataFrame形状: {gdf.shape}, 列名: {gdf.columns.tolist()}")
            if 'geometry' in gdf.columns:
                print(f"[DEBUG] geometry列存在，非空几何数: {gdf['geometry'].notna().sum()}")
        
        return gdf
    except Exception as e:
        import traceback
        print(f"[错误] 读取表 {table_name} 失败: {e}")
        print(f"[错误] 错误详情: {traceback.format_exc()}")
        return None

def insert_feature(table_name, feature, geom_col='geometry'):
    """
    插入单个要素到PostGIS表
    
    参数:
        table_name: 表名
        feature: GeoJSON Feature对象
        geom_col: 几何列名
    
    返回:
        插入的记录ID（gid）
    """
    engine = get_engine()
    
    # 将Feature转换为GeoDataFrame
    import geopandas as gpd
    from backend.utils.geojson import feature_to_gdf, validate_and_fix_geometry
    
    feature = validate_and_fix_geometry(feature)
    gdf = feature_to_gdf(feature)
    
    # Only keep columns that exist in the target table (e.g. rivers has no fclass)
    table_columns = get_table_columns(table_name)
    if table_columns:
        valid_cols = [c for c in gdf.columns if c in table_columns]
        if valid_cols:
            gdf = gdf[valid_cols]
        else:
            # Keep at least geometry
            if 'geometry' in gdf.columns:
                gdf = gdf[['geometry']]
    
    # Fill NOT NULL columns that have no default and are missing from gdf (e.g. water_bodies.osm_id, code)
    not_null_cols = get_table_not_null_columns_without_default(table_name)
    for col, data_type in not_null_cols:
        if col in gdf.columns or col == 'geometry' or col == 'gid':
            continue
        if data_type in ('character varying', 'text', 'char'):
            gdf[col] = ''
        elif data_type in ('integer', 'bigint', 'smallint'):
            gdf[col] = 0
        else:
            gdf[col] = ''  # fallback for other types (e.g. varchar)
    
    # 调试：输出插入前的坐标数据
    if not gdf.empty and 'geometry' in gdf.columns:
        geom = gdf.iloc[0]['geometry']
        if geom is not None:
            if hasattr(geom, 'x') and hasattr(geom, 'y'):
                print(f"[DEBUG] 插入前的坐标 - 经度: {geom.x}, 纬度: {geom.y}")
            elif hasattr(geom, 'exterior') and geom.exterior is not None:
                coords = list(geom.exterior.coords)
                print(f"[DEBUG] 插入前的坐标数据 (Polygon): {coords}")
            elif hasattr(geom, 'coords'):
                try:
                    coords = list(geom.coords)
                    print(f"[DEBUG] 插入前的坐标数据: {coords}")
                except NotImplementedError:
                    pass
    
    # 插入到数据库
    try:
        gdf.to_postgis(
            table_name,
            engine,
            if_exists='append',
            index=False
        )
        
        # 获取插入的记录ID
        with engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT MAX(gid) FROM {table_name}")
            )
            gid = result.scalar()
            
            # 调试：验证插入后的几何（ST_X/ST_Y 仅适用于 POINT，线/面用 ST_AsText 即可）
            if gid:
                verify_sql = text(
                    f"SELECT ST_AsText(geometry) as geom_text, ST_GeometryType(geometry) as geom_type FROM {table_name} WHERE gid = :gid"
                )
                verify_result = conn.execute(verify_sql, {'gid': gid})
                verify_row = verify_result.fetchone()
                if verify_row:
                    print(f"[DEBUG] 插入后的几何类型: {verify_row.geom_type}")
                    print(f"[DEBUG] 几何文本: {verify_row.geom_text}")
                    if verify_row.geom_type and 'Point' in str(verify_row.geom_type):
                        point_sql = text(f"SELECT ST_X(geometry) as lon, ST_Y(geometry) as lat FROM {table_name} WHERE gid = :gid")
                        point_result = conn.execute(point_sql, {'gid': gid})
                        point_row = point_result.fetchone()
                        if point_row:
                            print(f"[DEBUG] 插入后的坐标验证 - 经度: {point_row.lon}, 纬度: {point_row.lat}")
            
            return gid
    except Exception as e:
        import traceback
        print(f"[错误] 插入要素失败: {e}")
        print(traceback.format_exc())
        raise

def update_feature(table_name, gid, feature, geom_col='geometry'):
    """
    更新PostGIS表中的要素
    
    参数:
        table_name: 表名
        gid: 记录ID
        feature: GeoJSON Feature对象（包含更新后的数据）
        geom_col: 几何列名
    
    返回:
        bool: 是否成功
    """
    engine = get_engine()
    
    # 将Feature转换为GeoDataFrame
    from backend.utils.geojson import feature_to_gdf, validate_and_fix_geometry
    feature = validate_and_fix_geometry(feature)
    gdf = feature_to_gdf(feature)
    
    # Only keep columns that exist in the target table (e.g. rivers has no fclass)
    table_columns = get_table_columns(table_name)
    if table_columns:
        valid_cols = [c for c in gdf.columns if c in table_columns]
        if valid_cols:
            gdf = gdf[valid_cols]
        else:
            if 'geometry' in gdf.columns:
                gdf = gdf[['geometry']]
    
    # 更新数据库
    try:
        # 先删除旧记录
        with engine.connect() as conn:
            conn.execute(text(f"DELETE FROM {table_name} WHERE gid = :gid"), {'gid': gid})
            conn.commit()
        
        # 插入新记录（保持相同的gid）
        gdf['gid'] = gid
        gdf.to_postgis(
            table_name,
            engine,
            if_exists='append',
            index=False
        )
        return True
    except Exception as e:
        print(f"[错误] 更新要素失败: {e}")
        return False

def update_feature_status(table_name, gid, status):
    """
    更新要素状态（软删除/恢复）
    
    参数:
        table_name: 表名
        gid: 记录ID
        status: 状态值（1=有效，0=无效）
    
    返回:
        bool: 是否成功
    """
    engine = get_engine()
    
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(f"UPDATE {table_name} SET status = :status WHERE gid = :gid"),
                {'status': status, 'gid': gid}
            )
            conn.commit()
            updated = result.rowcount > 0
            if updated:
                print(f"[DEBUG] 更新表 {table_name} 记录 {gid} 状态为 {status}")
            return updated
    except Exception as e:
        print(f"[错误] 更新状态失败: {e}")
        import traceback
        print(traceback.format_exc())
        return False

def delete_feature(table_name, gid):
    """
    从PostGIS表删除要素（软删除：更新status=0）
    
    参数:
        table_name: 表名
        gid: 记录ID
    
    返回:
        bool: 是否成功
    """
    return update_feature_status(table_name, gid, 0)

