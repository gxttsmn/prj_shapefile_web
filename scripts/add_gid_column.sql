-- 为表添加gid列作为主键（如果不存在）

-- villages表
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'villages' AND column_name = 'gid') THEN
        ALTER TABLE villages ADD COLUMN gid SERIAL PRIMARY KEY;
    END IF;
END $$;

-- rivers表
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rivers' AND column_name = 'gid') THEN
        ALTER TABLE rivers ADD COLUMN gid SERIAL PRIMARY KEY;
    END IF;
END $$;

-- water_bodies表
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_bodies' AND column_name = 'gid') THEN
        ALTER TABLE water_bodies ADD COLUMN gid SERIAL PRIMARY KEY;
    END IF;
END $$;

