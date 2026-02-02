# -*- coding: utf-8 -*-
"""
村庄（点）数据API路由
"""

from flask import Blueprint, jsonify, request
from backend.utils.db import read_postgis_table, insert_feature, update_feature, delete_feature, update_feature_status
from backend.utils.geojson import gdf_to_geojson
import json

villages_bp = Blueprint('villages', __name__)

@villages_bp.route('/villages', methods=['GET'])
def get_villages():
    """获取所有村庄"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print("[REQUEST] GET /api/villages")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        # 获取查询参数
        name = request.args.get('name')
        bbox = request.args.get('bbox')  # minx,miny,maxx,maxy
        
        # 构建WHERE子句（使用参数化查询防止SQL注入）
        where_clause = None
        if name:
            # 转义单引号防止SQL注入
            escaped_name = name.replace("'", "''")
            where_clause = f"name LIKE '%{escaped_name}%'"
        
        # 读取数据
        print(f"[DEBUG] 查询村庄数据，WHERE子句: {where_clause}")
        gdf = read_postgis_table('villages', geom_col='geometry', where_clause=where_clause)
        
        if gdf is None:
            print("[DEBUG] GeoDataFrame为None")
            return jsonify({
                'type': 'FeatureCollection',
                'features': []
            })
        
        if gdf.empty:
            print(f"[DEBUG] GeoDataFrame为空，列名: {gdf.columns.tolist()}")
            return jsonify({
                'type': 'FeatureCollection',
                'features': []
            })
        
        print(f"[DEBUG] 查询到 {len(gdf)} 条村庄记录")
        
        # 转换为GeoJSON
        geojson = gdf_to_geojson(gdf)
        print(f"[DEBUG] GeoJSON转换完成，features数量: {len(geojson.get('features', []))}")
        return jsonify(geojson)
        
    except Exception as e:
        import traceback
        print(f"[ERROR] 获取村庄数据失败: {e}")
        print(f"[ERROR] 错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@villages_bp.route('/villages/<int:gid>', methods=['GET'])
def get_village(gid):
    """获取单个村庄"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] GET /api/villages/{gid}")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Path Parameter - gid: {gid} (type: {type(gid).__name__})")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        gdf = read_postgis_table('villages', where_clause=f'gid = {gid}')
        
        if gdf is None or gdf.empty:
            return jsonify({'error': 'Not found'}), 404
        
        geojson = gdf_to_geojson(gdf)
        if geojson['features']:
            return jsonify(geojson['features'][0])
        else:
            return jsonify({'error': 'Not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@villages_bp.route('/villages', methods=['POST'])
def create_village():
    """创建村庄"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print("[REQUEST] POST /api/villages")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print(f"[REQUEST] Headers: Content-Length={request.headers.get('Content-Length', 'N/A')}")
        print(f"[REQUEST] Raw Data (first 500 chars): {str(request.data)[:500] if request.data else 'None'}")
        
        feature = request.get_json()
        print(f"[REQUEST] Parsed JSON - type: {type(feature)}")
        if feature:
            print(f"[REQUEST] Parsed JSON - keys: {list(feature.keys()) if isinstance(feature, dict) else 'N/A'}")
            if isinstance(feature, dict):
                print(f"[REQUEST] Parsed JSON - 'type' field: {feature.get('type', 'N/A')}")
                if 'geometry' in feature:
                    geom = feature['geometry']
                    print(f"[REQUEST] Parsed JSON - geometry.type: {geom.get('type', 'N/A') if isinstance(geom, dict) else 'N/A'}")
                if 'properties' in feature:
                    props = feature['properties']
                    print(f"[REQUEST] Parsed JSON - properties keys: {list(props.keys()) if isinstance(props, dict) else 'N/A'}")
        else:
            print("[REQUEST] Parsed JSON: None or empty")
        print("=" * 60)
        
        if not feature or feature.get('type') != 'Feature':
            return jsonify({'error': 'Invalid GeoJSON Feature'}), 400
        
        # 插入数据库
        gid = insert_feature('villages', feature)
        
        return jsonify({
            'success': True,
            'message': '村庄创建成功',
            'data': {'gid': gid}
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@villages_bp.route('/villages/<int:gid>', methods=['PUT'])
def update_village(gid):
    """更新村庄"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] PUT /api/villages/{gid}")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Path Parameter - gid: {gid} (type: {type(gid).__name__})")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print(f"[REQUEST] Headers: Content-Length={request.headers.get('Content-Length', 'N/A')}")
        print(f"[REQUEST] Raw Data (first 500 chars): {str(request.data)[:500] if request.data else 'None'}")
        
        feature = request.get_json()
        print(f"[REQUEST] Parsed JSON - type: {type(feature)}")
        if feature:
            print(f"[REQUEST] Parsed JSON - keys: {list(feature.keys()) if isinstance(feature, dict) else 'N/A'}")
            if isinstance(feature, dict):
                print(f"[REQUEST] Parsed JSON - 'type' field: {feature.get('type', 'N/A')}")
                if 'geometry' in feature:
                    geom = feature['geometry']
                    print(f"[REQUEST] Parsed JSON - geometry.type: {geom.get('type', 'N/A') if isinstance(geom, dict) else 'N/A'}")
                if 'properties' in feature:
                    props = feature['properties']
                    print(f"[REQUEST] Parsed JSON - properties keys: {list(props.keys()) if isinstance(props, dict) else 'N/A'}")
        else:
            print("[REQUEST] Parsed JSON: None or empty")
        print("=" * 60)
        
        if not feature or feature.get('type') != 'Feature':
            return jsonify({'error': 'Invalid GeoJSON Feature'}), 400
        
        # 更新数据库
        success = update_feature('villages', gid, feature)
        
        if success:
            return jsonify({
                'success': True,
                'message': '村庄更新成功',
                'data': {'gid': gid}
            })
        else:
            return jsonify({'error': 'Update failed'}), 500
            
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@villages_bp.route('/villages/<int:gid>', methods=['DELETE'])
def delete_village(gid):
    """删除村庄（软删除：更新status=0）"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] DELETE /api/villages/{gid}")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Path Parameter - gid: {gid} (type: {type(gid).__name__})")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        # 先检查记录是否存在（包括已删除的记录）
        from backend.utils.db import read_postgis_table, update_feature_status
        gdf = read_postgis_table('villages', where_clause=f'gid = {gid}', include_inactive=True)
        if gdf is None or gdf.empty:
            return jsonify({'error': 'Not found'}), 404
        
        # 检查是否已经删除
        if gdf.iloc[0]['status'] == 0:
            return jsonify({'error': 'Already deleted'}), 400
        
        # 软删除：更新status为0
        success = update_feature_status('villages', gid, 0)
        
        if success:
            return jsonify({
                'success': True,
                'message': '村庄已删除（软删除）',
                'data': {'gid': gid}
            })
        else:
            return jsonify({'error': 'Delete failed'}), 500
            
    except Exception as e:
        import traceback
        print(f"[ERROR] 删除村庄失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@villages_bp.route('/villages/<int:gid>/restore', methods=['PUT'])
def restore_village(gid):
    """恢复已删除的村庄"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] PUT /api/villages/{gid}/restore")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Path Parameter - gid: {gid} (type: {type(gid).__name__})")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        from backend.utils.db import read_postgis_table, update_feature_status
        # 检查记录是否存在（包括已删除的记录）
        gdf = read_postgis_table('villages', where_clause=f'gid = {gid}', include_inactive=True)
        if gdf is None or gdf.empty:
            return jsonify({'error': 'Not found'}), 404
        
        # 检查是否已经有效
        if gdf.iloc[0]['status'] == 1:
            return jsonify({'error': 'Already active'}), 400
        
        # 恢复：更新status为1
        success = update_feature_status('villages', gid, 1)
        
        if success:
            return jsonify({
                'success': True,
                'message': '村庄已恢复',
                'data': {'gid': gid}
            })
        else:
            return jsonify({'error': 'Restore failed'}), 500
            
    except Exception as e:
        import traceback
        print(f"[ERROR] 恢复村庄失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

