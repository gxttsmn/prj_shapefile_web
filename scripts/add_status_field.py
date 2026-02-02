# -*- coding: utf-8 -*-
"""
执行数据库迁移脚本：添加status字段
"""

import sys
import os
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

# 添加项目根目录到Python路径
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.config import get_database_url
from sqlalchemy import create_engine, text

def execute_migration():
    """执行数据库迁移"""
    print("=" * 50)
    print("执行数据库迁移：添加status字段")
    print("=" * 50)
    
    db_url = get_database_url()
    print(f"数据库URL: {db_url}")
    
    try:
        engine = create_engine(db_url)
        
        with engine.connect() as conn:
            # 开始事务
            trans = conn.begin()
            
            try:
                # 1. 为villages表添加status字段
                print("\n[1/7] 为villages表添加status字段...")
                conn.execute(text("""
                    ALTER TABLE villages ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1
                """))
                conn.execute(text("""
                    COMMENT ON COLUMN villages.status IS '数据状态：1=有效，0=无效（软删除）'
                """))
                print("[OK] villages表status字段添加成功")
                
                # 2. 为rivers表添加status字段
                print("\n[2/7] 为rivers表添加status字段...")
                conn.execute(text("""
                    ALTER TABLE rivers ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1
                """))
                conn.execute(text("""
                    COMMENT ON COLUMN rivers.status IS '数据状态：1=有效，0=无效（软删除）'
                """))
                print("[OK] rivers表status字段添加成功")
                
                # 3. 为water_bodies表添加status字段
                print("\n[3/7] 为water_bodies表添加status字段...")
                conn.execute(text("""
                    ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1
                """))
                conn.execute(text("""
                    COMMENT ON COLUMN water_bodies.status IS '数据状态：1=有效，0=无效（软删除）'
                """))
                print("[OK] water_bodies表status字段添加成功")
                
                # 4. 更新现有数据
                print("\n[4/7] 更新现有数据status=1...")
                result1 = conn.execute(text("UPDATE villages SET status = 1 WHERE status IS NULL"))
                result2 = conn.execute(text("UPDATE rivers SET status = 1 WHERE status IS NULL"))
                result3 = conn.execute(text("UPDATE water_bodies SET status = 1 WHERE status IS NULL"))
                print(f"[OK] villages: {result1.rowcount} 条记录更新")
                print(f"[OK] rivers: {result2.rowcount} 条记录更新")
                print(f"[OK] water_bodies: {result3.rowcount} 条记录更新")
                
                # 5. 创建索引
                print("\n[5/7] 创建索引...")
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_villages_status ON villages(status)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rivers_status ON rivers(status)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_water_bodies_status ON water_bodies(status)"))
                print("[OK] 索引创建成功")
                
                # 提交事务
                trans.commit()
                print("\n[OK] 数据库迁移完成！")
                
                # 6. 验证字段
                print("\n[6/7] 验证字段添加...")
                result = conn.execute(text("""
                    SELECT 
                        table_name,
                        column_name,
                        data_type,
                        column_default
                    FROM information_schema.columns
                    WHERE table_name IN ('villages', 'rivers', 'water_bodies')
                        AND column_name = 'status'
                    ORDER BY table_name
                """))
                rows = result.fetchall()
                for row in rows:
                    print(f"  {row[0]}.{row[1]}: {row[2]} (默认值: {row[3]})")
                
                # 7. 验证索引
                print("\n[7/7] 验证索引创建...")
                result = conn.execute(text("""
                    SELECT 
                        tablename,
                        indexname
                    FROM pg_indexes
                    WHERE tablename IN ('villages', 'rivers', 'water_bodies')
                        AND indexname LIKE '%status%'
                    ORDER BY tablename
                """))
                rows = result.fetchall()
                for row in rows:
                    print(f"  {row[0]}: {row[1]}")
                
                print("\n" + "=" * 50)
                print("数据库迁移成功完成！")
                print("=" * 50)
                return True
                
            except Exception as e:
                trans.rollback()
                raise e
                
    except Exception as e:
        print(f"\n[ERROR] 数据库迁移失败: {e}")
        import traceback
        print(traceback.format_exc())
        return False

if __name__ == '__main__':
    success = execute_migration()
    sys.exit(0 if success else 1)

