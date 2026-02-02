# -*- coding: utf-8 -*-
"""
Flask API服务主应用
"""

import sys
import os
from pathlib import Path

# 修复Windows控制台编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# 添加项目根目录到Python路径
# 确保无论从哪个目录运行，都能找到backend模块
current_file = Path(__file__).resolve()
backend_dir = current_file.parent
project_root = backend_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from flask import Flask, jsonify
from flask_cors import CORS
from backend.config import API_CONFIG
from backend.routes.villages import villages_bp
from backend.routes.rivers import rivers_bp
from backend.routes.water_bodies import water_bodies_bp

def create_app():
    """创建Flask应用"""
    app = Flask(__name__)
    
    # 启用CORS（跨域请求）
    if API_CONFIG['cors_enabled']:
        CORS(app)
    
    # 注册蓝图（API路由）
    app.register_blueprint(villages_bp, url_prefix='/api')
    app.register_blueprint(rivers_bp, url_prefix='/api')
    app.register_blueprint(water_bodies_bp, url_prefix='/api')
    
    # 根路径
    @app.route('/')
    def index():
        return jsonify({
            'message': 'GIS Data API Service',
            'version': '1.0',
            'endpoints': {
                'villages': '/api/villages',
                'rivers': '/api/rivers',
                'water_bodies': '/api/water_bodies'
            }
        })
    
    # 健康检查
    @app.route('/health')
    def health():
        return jsonify({'status': 'ok'})
    
    # 错误处理
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

def main():
    """主函数"""
    app = create_app()
    
    print("=" * 50)
    print("GIS Data API Service")
    print("=" * 50)
    print(f"服务地址: http://{API_CONFIG['host']}:{API_CONFIG['port']}")
    print(f"API文档: http://{API_CONFIG['host']}:{API_CONFIG['port']}/")
    print("\n可用端点:")
    print("  GET    /api/villages          - 获取所有村庄")
    print("  GET    /api/villages/{id}      - 获取单个村庄")
    print("  POST   /api/villages           - 创建村庄")
    print("  PUT    /api/villages/{id}      - 更新村庄")
    print("  DELETE /api/villages/{id}      - 删除村庄")
    print("\n  (同样适用于 /api/rivers 和 /api/water_bodies)")
    print("=" * 50)
    
    app.run(
        host=API_CONFIG['host'],
        port=API_CONFIG['port'],
        debug=API_CONFIG['debug']
    )

if __name__ == '__main__':
    main()

