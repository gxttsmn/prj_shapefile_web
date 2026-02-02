# Ubuntu PostgreSQL 远程连接配置指南

## 问题现象

后端 API 尝试连接 Ubuntu 上的 PostgreSQL 数据库时出现错误：
```
connection to server at "192.168.50.5", port 5432 failed: Connection refused
```

## 问题原因

PostgreSQL 默认配置：
- ✅ 只监听 `localhost` (127.0.0.1)
- ❌ 不监听外部 IP 地址（如 192.168.50.5）
- ❌ 不允许远程连接

因此，即使 PostgreSQL 服务正常运行，也无法从其他机器（如 Windows）连接。

---

## 解决方案（逐步操作）

### 步骤 1: 检查 PostgreSQL 服务状态

在 Ubuntu 系统上执行：

```bash
sudo systemctl status postgresql
```

**如果服务未运行**:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

### 步骤 2: 检查当前监听地址

```bash
sudo netstat -tlnp | grep 5432
# 或
sudo ss -tlnp | grep 5432
```

**当前输出（只监听本地）**:
```
tcp  0  0  127.0.0.1:5432  0.0.0.0:*  LISTEN  ...
```

**目标输出（监听所有接口）**:
```
tcp  0  0  0.0.0.0:5432  0.0.0.0:*  LISTEN  ...
```

---

### 步骤 3: 查找 PostgreSQL 配置文件

```bash
# 查看 PostgreSQL 版本
psql --version

# 查找配置文件（假设是 PostgreSQL 14）
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
echo "PostgreSQL 版本: $PG_VERSION"
echo "配置文件路径: /etc/postgresql/${PG_VERSION}/main/"
```

---

### 步骤 4: 修改 postgresql.conf（允许监听所有接口）

```bash
# 编辑配置文件（根据实际版本修改）
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**找到以下行**（通常在文件开头附近）:
```
#listen_addresses = 'localhost'
```

**修改为**:
```
listen_addresses = '*'  # 监听所有网络接口
```

**或者只监听特定接口**:
```
listen_addresses = 'localhost,192.168.50.5'  # 监听本地和指定IP
```

**保存并退出**:
- 按 `Ctrl + O` 保存
- 按 `Enter` 确认
- 按 `Ctrl + X` 退出

---

### 步骤 5: 配置 pg_hba.conf（允许远程连接）

```bash
# 备份配置文件
sudo cp /etc/postgresql/14/main/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf.backup

# 编辑配置文件
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

**在文件末尾添加以下行**（允许来自局域网的所有连接）:

```
# 允许来自 192.168.50.0/24 网段的连接（无密码）
host    all             all             192.168.50.0/24          trust
```

**或者更安全的配置**（只允许特定 IP）:
```
# 允许来自特定 IP 的连接
host    all             all             192.168.50.5/32            trust
```

**保存并退出**

---

### 步骤 6: 重启 PostgreSQL 服务

```bash
sudo systemctl restart postgresql
```

**验证服务状态**:
```bash
sudo systemctl status postgresql
```

---

### 步骤 7: 验证监听地址

```bash
sudo netstat -tlnp | grep 5432
```

**应该看到**:
```
tcp  0  0  0.0.0.0:5432  0.0.0.0:*  LISTEN  ...
```

这表示 PostgreSQL 现在监听所有网络接口。

---

### 步骤 8: 配置防火墙（如果需要）

```bash
# 检查防火墙状态
sudo ufw status

# 如果防火墙启用，允许 PostgreSQL 端口
sudo ufw allow 5432/tcp

# 或只允许特定 IP
sudo ufw allow from 192.168.50.5 to any port 5432

# 重新加载防火墙
sudo ufw reload
```

---

### 步骤 9: 测试连接

#### 9.1 在 Ubuntu 上测试本地连接

```bash
psql -U postgres -d prj_gis -h localhost
```

#### 9.2 在 Ubuntu 上测试远程连接（模拟外部连接）

```bash
psql -U postgres -d prj_gis -h 192.168.50.5
```

如果成功，会进入 psql 提示符，输入 `\q` 退出。

#### 9.3 在 Windows 上测试连接

如果 Windows 上安装了 PostgreSQL 客户端：

```bash
psql -U postgres -d prj_gis -h 192.168.50.5
```

或者使用 Python 测试：

```python
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres@192.168.50.5:5432/prj_gis')
with engine.connect() as conn:
    result = conn.execute(text("SELECT version();"))
    print("连接成功!")
    print(result.scalar())
```

---

### 步骤 10: 运行后端 API 测试

在 Windows 上运行后端 API：

```bash
python run_api.py
```

访问 API 端点测试：
```
http://localhost:5000/api/villages
```

如果配置正确，应该能正常返回数据。

---

## 快速配置脚本

创建一个自动化配置脚本 `configure_postgres_remote.sh`:

```bash
#!/bin/bash

echo "=========================================="
echo "PostgreSQL 远程连接配置脚本"
echo "=========================================="

# 获取 PostgreSQL 版本
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

echo "PostgreSQL 版本: $PG_VERSION"
echo "配置文件: $PG_CONF"
echo ""

# 1. 备份配置文件
echo "步骤 1: 备份配置文件..."
sudo cp "$PG_CONF" "${PG_CONF}.backup"
sudo cp "$PG_HBA" "${PG_HBA}.backup"
echo "✓ 备份完成"
echo ""

# 2. 修改 postgresql.conf
echo "步骤 2: 配置监听地址..."
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
echo "✓ 已配置监听所有接口"
echo ""

# 3. 修改 pg_hba.conf
echo "步骤 3: 配置远程连接权限..."
if ! sudo grep -q "192.168.50.0/24" "$PG_HBA"; then
    echo "host    all             all             192.168.50.0/24          trust" | sudo tee -a "$PG_HBA" > /dev/null
    echo "✓ 已添加远程连接规则"
else
    echo "✓ 远程连接规则已存在"
fi
echo ""

# 4. 重启 PostgreSQL
echo "步骤 4: 重启 PostgreSQL..."
sudo systemctl restart postgresql
echo "✓ 服务已重启"
echo ""

# 5. 验证监听地址
echo "步骤 5: 验证监听地址..."
sudo netstat -tlnp | grep 5432
echo ""

# 6. 配置防火墙
echo "步骤 6: 配置防火墙..."
sudo ufw allow 5432/tcp
echo "✓ 防火墙规则已添加"
echo ""

echo "=========================================="
echo "配置完成！"
echo "=========================================="
echo ""
echo "现在可以从其他机器连接到数据库："
echo "  psql -U postgres -d prj_gis -h 192.168.50.5"
```

**使用方法**:
```bash
chmod +x configure_postgres_remote.sh
./configure_postgres_remote.sh
```

---

## 常见问题

### Q1: 修改后仍然连接失败

**检查清单**:
1. ✅ PostgreSQL 服务是否重启: `sudo systemctl status postgresql`
2. ✅ 监听地址是否正确: `sudo netstat -tlnp | grep 5432`
3. ✅ pg_hba.conf 规则是否正确: `sudo cat /etc/postgresql/14/main/pg_hba.conf | grep 192.168.50`
4. ✅ 防火墙是否允许: `sudo ufw status`
5. ✅ 网络是否可达: `ping 192.168.50.5`

### Q2: 如何只允许特定 IP 连接？

在 `pg_hba.conf` 中使用具体 IP:
```
host    all             all             192.168.50.5/32            trust
```

### Q3: 如何更安全地配置？

1. **使用密码认证**:
   ```
   host    all             all             192.168.50.0/24          scram-sha-256
   ```
   然后修改后端配置添加密码。

2. **限制访问 IP**:
   只允许必要的 IP 地址。

3. **使用 SSL 连接**:
   配置 PostgreSQL SSL，后端使用 SSL 连接。

### Q4: 如何查看当前配置？

```bash
# 查看监听地址
sudo cat /etc/postgresql/14/main/postgresql.conf | grep listen_addresses

# 查看连接规则
sudo cat /etc/postgresql/14/main/pg_hba.conf | grep -v "^#" | grep -v "^$"
```

---

## 验证成功

配置成功后，应该能够：

1. ✅ PostgreSQL 监听所有接口: `0.0.0.0:5432`
2. ✅ 从 Ubuntu 本地连接成功
3. ✅ 从 Windows 远程连接成功
4. ✅ 后端 API 正常访问数据库

---

## 安全提示

⚠️ **重要**: 

1. **开发环境**: 可以使用 `trust` 认证（无密码）
2. **生产环境**: 
   - ❌ 不要使用 `trust` 认证
   - ✅ 使用 `scram-sha-256` 或 `md5` 认证
   - ✅ 设置强密码
   - ✅ 限制访问 IP
   - ✅ 使用防火墙
   - ✅ 考虑使用 VPN 或 SSH 隧道

---

**版本**: 1.0.0  
**最后更新**: 2024年

