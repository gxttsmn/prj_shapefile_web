-- ====================================================
-- 添加status字段实现软删除功能
-- 执行时间：2025-01-21
-- ====================================================

-- 1. 为villages表添加status字段
ALTER TABLE villages ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1;
COMMENT ON COLUMN villages.status IS '数据状态：1=有效，0=无效（软删除）';

-- 2. 为rivers表添加status字段
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1;
COMMENT ON COLUMN rivers.status IS '数据状态：1=有效，0=无效（软删除）';

-- 3. 为water_bodies表添加status字段
ALTER TABLE water_bodies ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1;
COMMENT ON COLUMN water_bodies.status IS '数据状态：1=有效，0=无效（软删除）';

-- 4. 更新现有数据，确保所有记录status=1（如果字段已存在但值为NULL）
UPDATE villages SET status = 1 WHERE status IS NULL;
UPDATE rivers SET status = 1 WHERE status IS NULL;
UPDATE water_bodies SET status = 1 WHERE status IS NULL;

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_villages_status ON villages(status);
CREATE INDEX IF NOT EXISTS idx_rivers_status ON rivers(status);
CREATE INDEX IF NOT EXISTS idx_water_bodies_status ON water_bodies(status);

-- 6. 验证字段添加成功
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name IN ('villages', 'rivers', 'water_bodies')
    AND column_name = 'status'
ORDER BY table_name;

-- 7. 验证索引创建成功
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('villages', 'rivers', 'water_bodies')
    AND indexname LIKE '%status%'
ORDER BY tablename;

