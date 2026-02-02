# -*- coding: utf-8 -*-
"""
API服务启动脚本
从项目根目录运行此脚本启动API服务
"""

import sys
from pathlib import Path

# 修复Windows控制台编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# 确保项目根目录在Python路径中
project_root = Path(__file__).resolve().parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 导入并运行Flask应用
from backend.app import main

if __name__ == '__main__':
    main()

