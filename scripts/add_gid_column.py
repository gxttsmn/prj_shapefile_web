# -*- coding: utf-8 -*-
"""添加gid列作为主键"""

import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from backend.config import get_database_url

def add_gid_columns():
    """为表添加gid列"""
    print("=" * 50)
    print("添加gid列作为主键")
    print("=" * 50)
    
    engine = create_engine(get_database_url())
    tables = ['villages', 'rivers', 'water_bodies']
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for table in tables:
                # 检查gid列是否存在
                check_sql = text(f"""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_name = '{table}' AND column_name = 'gid'
                """)
                result = conn.execute(check_sql)
                has_gid = result.scalar() > 0
                
                if not has_gid:
                    print(f"\n[{table}] 添加gid列...")
                    # 添加gid列
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN gid SERIAL"))
                    # 设置为主键
                    conn.execute(text(f"ALTER TABLE {table} ADD PRIMARY KEY (gid)"))
                    print(f"[OK] {table}表gid列添加成功")
                else:
                    print(f"\n[{table}] gid列已存在，跳过")
            
            trans.commit()
            print("\n" + "=" * 50)
            print("gid列添加完成！")
            print("=" * 50)
            return True
        except Exception as e:
            trans.rollback()
            print(f"\n[ERROR] 添加gid列失败: {e}")
            import traceback
            print(traceback.format_exc())
            return False

if __name__ == '__main__':
    success = add_gid_columns()
    sys.exit(0 if success else 1)

