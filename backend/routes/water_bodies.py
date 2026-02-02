# -*- coding: utf-8 -*-
"""
水系（面）数据API路由
"""

from flask import Blueprint, jsonify, request
from backend.utils.db import read_postgis_table, insert_feature, update_feature, delete_feature
from backend.utils.geojson import gdf_to_geojson

water_bodies_bp = Blueprint('water_bodies', __name__)

@water_bodies_bp.route('/water_bodies', methods=['GET'])
def get_water_bodies():
    """获取所有水系"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print("[REQUEST] GET /api/water_bodies")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        name = request.args.get('name')
        where_clause = None
        if name:
            # 转义单引号防止SQL注入
            escaped_name = name.replace("'", "''")
            where_clause = f"name LIKE '%{escaped_name}%'"
        
        gdf = read_postgis_table('water_bodies', geom_col='geometry', where_clause=where_clause)
        
        if gdf is None or gdf.empty:
            return jsonify({
                'type': 'FeatureCollection',
                'features': []
            })
        
        geojson = gdf_to_geojson(gdf)
        return jsonify(geojson)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@water_bodies_bp.route('/water_bodies/<int:gid>', methods=['GET'])
def get_water_body(gid):
    """获取单个水系"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] GET /api/water_bodies/{gid}")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Path Parameter - gid: {gid} (type: {type(gid).__name__})")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        gdf = read_postgis_table('water_bodies', where_clause=f'gid = {gid}')
        
        if gdf is None or gdf.empty:
            return jsonify({'error': 'Not found'}), 404
        
        geojson = gdf_to_geojson(gdf)
        if geojson['features']:
            return jsonify(geojson['features'][0])
        else:
            return jsonify({'error': 'Not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@water_bodies_bp.route('/water_bodies', methods=['POST'])
def create_water_body():
    """创建水系"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print("[REQUEST] POST /api/water_bodies")
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
        
        gid = insert_feature('water_bodies', feature)
        
        return jsonify({
            'success': True,
            'message': '水系创建成功',
            'data': {'gid': gid}
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        import traceback
        print(f"[ERROR] 创建水系失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@water_bodies_bp.route('/water_bodies/<int:gid>', methods=['PUT'])
def update_water_body(gid):
    """更新水系"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] PUT /api/water_bodies/{gid}")
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
        
        success = update_feature('water_bodies', gid, feature)
        
        if success:
            return jsonify({
                'success': True,
                'message': '水系更新成功',
                'data': {'gid': gid}
            })
        else:
            return jsonify({'error': 'Update failed'}), 500
            
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@water_bodies_bp.route('/water_bodies/<int:gid>', methods=['DELETE'])
def delete_water_body(gid):
    """删除水系（软删除：更新status=0）"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] DELETE /api/water_bodies/{gid}")
        print(f"[REQUEST] Method: {request.method}")
        print(f"[REQUEST] URL: {request.url}")
        print(f"[REQUEST] Path: {request.path}")
        print(f"[REQUEST] Path Parameter - gid: {gid} (type: {type(gid).__name__})")
        print(f"[REQUEST] Query String: {request.query_string.decode('utf-8') if request.query_string else 'None'}")
        print(f"[REQUEST] Args: {dict(request.args)}")
        print(f"[REQUEST] Headers: Content-Type={request.headers.get('Content-Type', 'N/A')}")
        print("=" * 60)
        
        from backend.utils.db import read_postgis_table, update_feature_status
        # 先检查记录是否存在（包括已删除的记录）
        gdf = read_postgis_table('water_bodies', where_clause=f'gid = {gid}', include_inactive=True)
        if gdf is None or gdf.empty:
            return jsonify({'error': 'Not found'}), 404
        
        # 检查是否已经删除
        if gdf.iloc[0]['status'] == 0:
            return jsonify({'error': 'Already deleted'}), 400
        
        # 软删除：更新status为0
        success = update_feature_status('water_bodies', gid, 0)
        
        if success:
            return jsonify({
                'success': True,
                'message': '水系已删除（软删除）',
                'data': {'gid': gid}
            })
        else:
            return jsonify({'error': 'Delete failed'}), 500
            
    except Exception as e:
        import traceback
        print(f"[ERROR] 删除水系失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@water_bodies_bp.route('/water_bodies/<int:gid>/restore', methods=['PUT'])
def restore_water_body(gid):
    """恢复已删除的水系"""
    try:
        # Print request parameters for debugging
        print("=" * 60)
        print(f"[REQUEST] PUT /api/water_bodies/{gid}/restore")
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
        gdf = read_postgis_table('water_bodies', where_clause=f'gid = {gid}', include_inactive=True)
        if gdf is None or gdf.empty:
            return jsonify({'error': 'Not found'}), 404
        
        # 检查是否已经有效
        if gdf.iloc[0]['status'] == 1:
            return jsonify({'error': 'Already active'}), 400
        
        # 恢复：更新status为1
        success = update_feature_status('water_bodies', gid, 1)
        
        if success:
            return jsonify({
                'success': True,
                'message': '水系已恢复',
                'data': {'gid': gid}
            })
        else:
            return jsonify({'error': 'Restore failed'}), 500
            
    except Exception as e:
        import traceback
        print(f"[ERROR] 恢复水系失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

