# -*- coding: utf-8 -*-
"""检查表结构"""

import sys
sys.stdout.reconfigure(encoding='utf-8')

from sqlalchemy import create_engine, text
from backend.config import get_database_url

engine = create_engine(get_database_url())
with engine.connect() as conn:
    # 检查villages表结构
    result = conn.execute(text("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'villages'
        ORDER BY ordinal_position
    """))
    print("villages表列:")
    for row in result:
        print(f"  {row[0]}: {row[1]} (默认值: {row[2]})")
    
    # 检查主键
    result = conn.execute(text("""
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'villages'
    """))
    print("\n约束:")
    for row in result:
        print(f"  {row[0]}: {row[1]}")
    
    # 检查是否有gid列
    result = conn.execute(text("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'villages' AND column_name = 'gid'
    """))
    has_gid = result.scalar() > 0
    print(f"\ngid列存在: {has_gid}")
    
    # 如果没有gid，检查主键是什么
    if not has_gid:
        result = conn.execute(text("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'villages'::regclass AND i.indisprimary
        """))
        print("主键列:")
        for row in result:
            print(f"  {row[0]}")

