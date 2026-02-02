# 后端 API 接口文档

## 目录

- [概述](#概述)
- [基础信息](#基础信息)
- [数据格式](#数据格式)
- [通用响应格式](#通用响应格式)
- [错误处理](#错误处理)
- [API 端点](#api-端点)
  - [村庄（点）数据](#村庄点数据)
  - [河渠（线）数据](#河渠线数据)
  - [水系（面）数据](#水系面数据)
- [示例代码](#示例代码)

---

## 概述

本 API 提供 GIS 数据的 RESTful 接口，支持对村庄（点）、河渠（线）、水系（面）三种地理要素进行 CRUD 操作。所有数据以 GeoJSON 格式传输，存储在 PostgreSQL + PostGIS 数据库中。

### 主要特性

- ✅ RESTful API 设计
- ✅ GeoJSON 数据格式
- ✅ 软删除机制（status 字段）
- ✅ CORS 跨域支持
- ✅ 完整的错误处理
- ✅ 支持按名称查询

---

## 基础信息

### 服务地址

- **开发环境**: `http://localhost:5000`
- **API 前缀**: `/api`

### 请求格式

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### 响应格

- **Content-Type**: `application/json`
- **字符编码**: UTF-8

### 认证

当前版本无需认证，后续版本可能添加。

---

## 数据格式

### GeoJSON Feature 格式

所有要素数据遵循 [GeoJSON 规范](https://geojson.org/)。

#### 点要素（村庄）示例

```json
{
  "type": "Feature",
  "id": 1,
  "properties": {
    "gid": 1,
    "name": "示例村庄",
    "fclass": "village",
    "code": 1003,
    "description": "村庄描述信息",
    "status": 1
  },
  "geometry": {
    "type": "Point",
    "coordinates": [111.03369140788223, 35.1161318971041]
  }
}
```

#### 线要素（河渠）示例

```json
{
  "type": "Feature",
  "id": 1,
  "properties": {
    "gid": 1,
    "name": "示例河渠",
    "fclass": "river",
    "description": "河渠描述信息",
    "status": 1
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [111.0, 35.0],
      [111.1, 35.1],
      [111.2, 35.2]
    ]
  }
}
```

#### 面要素（水系）示例

```json
{
  "type": "Feature",
  "id": 1,
  "properties": {
    "gid": 1,
    "name": "示例水域",
    "fclass": "water",
    "code": 8200,
    "description": "水域描述信息",
    "status": 1
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [111.0, 35.0],
      [111.1, 35.0],
      [111.1, 35.1],
      [111.0, 35.1],
      [111.0, 35.0]
    ]]
  }
}
```

### 坐标系统

- **坐标系**: WGS84 (EPSG:4326)
- **坐标顺序**: `[经度, 纬度]` (GeoJSON 标准)
- **面要素**: 必须闭合（首尾坐标相同）

### 属性说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `gid` | integer | 否 | 数据库主键，创建时自动生成 |
| `name` | string | 是 | 要素名称 |
| `fclass` | string | 否 | 要素类别（如：village, river, water） |
| `code` | integer/string | 否 | 分类代码 |
| `description` | string | 否 | 描述信息 |
| `status` | integer | 否 | 状态（1=有效，0=已删除），默认 1 |

---

## 通用响应格式

### 成功响应

#### 列表查询（FeatureCollection）

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "properties": { ... },
      "geometry": { ... }
    }
  ]
}
```

#### 单个要素（Feature）

```json
{
  "type": "Feature",
  "id": 1,
  "properties": { ... },
  "geometry": { ... }
}
```

#### 创建/更新/删除响应

```json
{
  "success": true,
  "message": "操作成功消息",
  "data": {
    "gid": 1
  }
}
```

### 错误响应

```json
{
  "error": "错误描述信息"
}
```

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 常见错误

#### 400 Bad Request

```json
{
  "error": "Invalid GeoJSON Feature"
}
```

**原因**: 请求体不是有效的 GeoJSON Feature 格式

#### 404 Not Found

```json
{
  "error": "Not found"
}
```

**原因**: 请求的资源不存在

#### 500 Internal Server Error

```json
{
  "error": "错误详情信息"
}
```

**原因**: 服务器处理请求时发生错误

---

## API 端点

### 村庄（点）数据

#### 1. 获取所有村庄

**请求**

```http
GET /api/villages
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 按名称模糊查询 |

**示例**

```bash
# 获取所有村庄
curl http://localhost:5000/api/villages

# 按名称查询
curl "http://localhost:5000/api/villages?name=示例"
```

**响应**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "properties": {
        "gid": 1,
        "name": "示例村庄",
        "fclass": "village",
        "code": 1003,
        "status": 1
      },
      "geometry": {
        "type": "Point",
        "coordinates": [111.03369140788223, 35.1161318971041]
      }
    }
  ]
}
```

---

#### 2. 获取单个村庄

**请求**

```http
GET /api/villages/{gid}
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `gid` | integer | 村庄 ID |

**示例**

```bash
curl http://localhost:5000/api/villages/1
```

**响应**

```json
{
  "type": "Feature",
  "id": 1,
  "properties": {
    "gid": 1,
    "name": "示例村庄",
    "fclass": "village",
    "code": 1003,
    "status": 1
  },
  "geometry": {
    "type": "Point",
    "coordinates": [111.03369140788223, 35.1161318971041]
  }
}
```

---

#### 3. 创建村庄

**请求**

```http
POST /api/villages
Content-Type: application/json
```

**请求体**

```json
{
  "type": "Feature",
  "properties": {
    "name": "新村庄",
    "fclass": "village",
    "code": 1003,
    "description": "村庄描述"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [111.03369140788223, 35.1161318971041]
  }
}
```

**示例**

```bash
curl -X POST http://localhost:5000/api/villages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Feature",
    "properties": {
      "name": "新村庄",
      "fclass": "village"
    },
    "geometry": {
      "type": "Point",
      "coordinates": [111.03369140788223, 35.1161318971041]
    }
  }'
```

**响应**

```json
{
  "success": true,
  "message": "村庄创建成功",
  "data": {
    "gid": 1
  }
}
```

**状态码**: `201 Created`

---

#### 4. 更新村庄

**请求**

```http
PUT /api/villages/{gid}
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `gid` | integer | 村庄 ID |

**请求体**

```json
{
  "type": "Feature",
  "properties": {
    "name": "更新后的村庄名称",
    "fclass": "village",
    "code": 1003
  },
  "geometry": {
    "type": "Point",
    "coordinates": [111.03369140788223, 35.1161318971041]
  }
}
```

**示例**

```bash
curl -X PUT http://localhost:5000/api/villages/1 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Feature",
    "properties": {
      "name": "更新后的村庄名称"
    },
    "geometry": {
      "type": "Point",
      "coordinates": [111.03369140788223, 35.1161318971041]
    }
  }'
```

**响应**

```json
{
  "success": true,
  "message": "村庄更新成功",
  "data": {
    "gid": 1
  }
}
```

---

#### 5. 删除村庄（软删除）

**请求**

```http
DELETE /api/villages/{gid}
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `gid` | integer | 村庄 ID |

**示例**

```bash
curl -X DELETE http://localhost:5000/api/villages/1
```

**响应**

```json
{
  "success": true,
  "message": "村庄已删除（软删除）",
  "data": {
    "gid": 1
  }
}
```

**说明**: 软删除会将 `status` 字段设置为 0，数据不会真正从数据库中删除。

---

#### 6. 恢复已删除的村庄

**请求**

```http
PUT /api/villages/{gid}/restore
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `gid` | integer | 村庄 ID |

**示例**

```bash
curl -X PUT http://localhost:5000/api/villages/1/restore
```

**响应**

```json
{
  "success": true,
  "message": "村庄已恢复",
  "data": {
    "gid": 1
  }
}
```

---

### 河渠（线）数据

河渠 API 的端点结构与村庄完全相同，只需将 `/api/villages` 替换为 `/api/rivers`。

#### 端点列表

- `GET /api/rivers` - 获取所有河渠
- `GET /api/rivers/{gid}` - 获取单个河渠
- `POST /api/rivers` - 创建河渠
- `PUT /api/rivers/{gid}` - 更新河渠
- `DELETE /api/rivers/{gid}` - 删除河渠（软删除）
- `PUT /api/rivers/{gid}/restore` - 恢复已删除的河渠

#### 请求示例

**创建河渠**

```bash
curl -X POST http://localhost:5000/api/rivers \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Feature",
    "properties": {
      "name": "新河渠",
      "fclass": "river"
    },
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [111.0, 35.0],
        [111.1, 35.1],
        [111.2, 35.2]
      ]
    }
  }'
```

**注意**: 线要素的 `coordinates` 是一个坐标数组，至少需要 2 个点。

---

### 水系（面）数据

水系 API 的端点结构与村庄完全相同，只需将 `/api/villages` 替换为 `/api/water_bodies`。

#### 端点列表

- `GET /api/water_bodies` - 获取所有水系
- `GET /api/water_bodies/{gid}` - 获取单个水系
- `POST /api/water_bodies` - 创建水系
- `PUT /api/water_bodies/{gid}` - 更新水系
- `DELETE /api/water_bodies/{gid}` - 删除水系（软删除）
- `PUT /api/water_bodies/{gid}/restore` - 恢复已删除的水系

#### 请求示例

**创建水系**

```bash
curl -X POST http://localhost:5000/api/water_bodies \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Feature",
    "properties": {
      "name": "新水域",
      "fclass": "water",
      "code": 8200
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [111.0, 35.0],
        [111.1, 35.0],
        [111.1, 35.1],
        [111.0, 35.1],
        [111.0, 35.0]
      ]]
    }
  }'
```

**注意**: 
- 面要素的 `coordinates` 是一个二维数组（外环）
- 面必须闭合（首尾坐标相同）
- 至少需要 3 个点才能形成有效的面

---

## 示例代码

### JavaScript (Fetch API)

#### 获取所有村庄

```javascript
async function loadVillages() {
  try {
    const response = await fetch('http://localhost:5000/api/villages');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const geojson = await response.json();
    return geojson;
  } catch (error) {
    console.error('加载村庄数据失败:', error);
    throw error;
  }
}
```

#### 创建村庄

```javascript
async function createVillage(feature) {
  try {
    const response = await fetch('http://localhost:5000/api/villages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(feature)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建失败');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('创建村庄失败:', error);
    throw error;
  }
}

// 使用示例
const newVillage = {
  type: 'Feature',
  properties: {
    name: '新村庄',
    fclass: 'village',
    code: 1003
  },
  geometry: {
    type: 'Point',
    coordinates: [111.03369140788223, 35.1161318971041]
  }
};

createVillage(newVillage)
  .then(result => {
    console.log('创建成功:', result);
  })
  .catch(error => {
    console.error('创建失败:', error);
  });
```

#### 更新村庄

```javascript
async function updateVillage(gid, feature) {
  try {
    const response = await fetch(`http://localhost:5000/api/villages/${gid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(feature)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '更新失败');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('更新村庄失败:', error);
    throw error;
  }
}
```

#### 删除村庄

```javascript
async function deleteVillage(gid) {
  try {
    const response = await fetch(`http://localhost:5000/api/villages/${gid}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '删除失败');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('删除村庄失败:', error);
    throw error;
  }
}
```

### Python (requests)

```python
import requests
import json

# API 基础 URL
BASE_URL = 'http://localhost:5000/api'

# 获取所有村庄
def get_villages(name=None):
    url = f'{BASE_URL}/villages'
    params = {'name': name} if name else None
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()

# 创建村庄
def create_village(feature):
    url = f'{BASE_URL}/villages'
    response = requests.post(
        url,
        json=feature,
        headers={'Content-Type': 'application/json'}
    )
    response.raise_for_status()
    return response.json()

# 更新村庄
def update_village(gid, feature):
    url = f'{BASE_URL}/villages/{gid}'
    response = requests.put(
        url,
        json=feature,
        headers={'Content-Type': 'application/json'}
    )
    response.raise_for_status()
    return response.json()

# 删除村庄
def delete_village(gid):
    url = f'{BASE_URL}/villages/{gid}'
    response = requests.delete(url)
    response.raise_for_status()
    return response.json()

# 使用示例
if __name__ == '__main__':
    # 获取所有村庄
    villages = get_villages()
    print(f'找到 {len(villages["features"])} 个村庄')
    
    # 创建新村庄
    new_village = {
        'type': 'Feature',
        'properties': {
            'name': '新村庄',
            'fclass': 'village',
            'code': 1003
        },
        'geometry': {
            'type': 'Point',
            'coordinates': [111.03369140788223, 35.1161318971041]
        }
    }
    result = create_village(new_village)
    print(f'创建成功，gid: {result["data"]["gid"]}')
```


