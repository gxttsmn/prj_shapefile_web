# Dify 工作流变量配置说明

## 概述

根据前端发送的数据结构，Dify 工作流的开始节点需要定义以下输入变量。

## 必需变量

### 1. `user_input` (字符串类型)

- **变量名**: `user_input`
- **类型**: String / Text
- **必需**: 是
- **描述**: 用户在AI聊天窗口中输入的文本内容
- **示例值**: `"新增水域要素"`, `"如何创建村庄？"`, `"查询要素"`

## 可选变量

### 2. `latest_feature` (对象类型)

- **变量名**: `latest_feature`
- **类型**: Object / JSON
- **必需**: 否（只有在用户绘制了要素但未保存时才会传递）
- **描述**: 最新添加或正在编辑的要素数据

#### 对象结构：

```json
{
  "type": "point|line|polygon",
  "name": "要素名称",
  "gid": "要素ID或null",
  "geometry_type": "Point|LineString|Polygon|MultiLineString|MultiPolygon",
  "coordinates": [...],
  "properties": {...},
  "saved_at": "ISO时间戳或null"
}
```

#### 字段说明：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `type` | String | 要素类型：'point'（村庄）、'line'（河渠）、'polygon'（水域） | `"polygon"` |
| `name` | String | 要素名称，如果未命名则为"未命名" | `"测试水域"` |
| `gid` | String/Number/null | 要素ID，如果未保存则为null | `"123"` 或 `null` |
| `geometry_type` | String | GeoJSON几何类型 | `"Polygon"` |
| `coordinates` | Array | 坐标数组，格式遵循GeoJSON规范 | `[[[111.1, 35.2], [111.2, 35.3], ...]]` |
| `properties` | Object | 要素属性对象 | `{"name": "测试", "fclass": "water"}` |
| `saved_at` | String/null | 保存时间（ISO格式），如果未保存则为null | `"2024-01-23T07:40:00.000Z"` 或 `null` |

#### 坐标格式说明：

- **Point (点)**: `[longitude, latitude]`
  ```json
  [111.123456, 35.654321]
  ```

- **LineString (线)**: `[[lon1, lat1], [lon2, lat2], ...]`
  ```json
  [[111.1, 35.2], [111.2, 35.3], [111.3, 35.4]]
  ```

- **Polygon (面)**: `[[[lon1, lat1], [lon2, lat2], ..., [lon1, lat1]]]`
  ```json
  [[[111.1, 35.2], [111.2, 35.2], [111.2, 35.3], [111.1, 35.3], [111.1, 35.2]]]
  ```
  注意：Polygon的第一个点和最后一个点必须相同（闭合）

## 在 Dify 中配置变量

### 步骤：

1. **打开工作流编辑页面**
   - 进入 Dify 工作流编排界面

2. **配置开始节点**
   - 点击开始节点（Start Node）
   - 添加输入变量

3. **添加变量 `user_input`**
   - 变量名：`user_input`
   - 变量类型：选择 `String` 或 `Text`
   - 变量描述：`用户输入的文本内容`
   - 是否必需：是

4. **添加变量 `latest_feature`（可选）**
   - 变量名：`latest_feature`
   - 变量类型：选择 `Object` 或 `JSON`
   - 变量描述：`最新添加的要素数据（可选）`
   - 是否必需：否

### 注意事项：

1. **变量名必须完全匹配**
   - 前端代码中使用的是 `user_input` 和 `latest_feature`
   - 变量名必须与代码中的键名完全一致（区分大小写）

2. **变量类型选择**
   - `user_input`: 选择 `String` 或 `Text` 类型
   - `latest_feature`: 选择 `Object` 或 `JSON` 类型

3. **可选变量的处理**
   - `latest_feature` 是可选变量，可能不存在
   - 在工作流中需要判断该变量是否存在再使用

## 数据示例

### 示例1：只有用户输入（没有要素）

```json
{
  "inputs": {
    "user_input": "如何创建村庄？"
  },
  "response_mode": "blocking",
  "user": "map_user"
}
```

### 示例2：用户输入 + 最新要素（已保存）

```json
{
  "inputs": {
    "user_input": "新增水域要素",
    "latest_feature": {
      "type": "polygon",
      "name": "测试水域",
      "gid": "123",
      "geometry_type": "Polygon",
      "coordinates": [[[111.1, 35.2], [111.2, 35.2], [111.2, 35.3], [111.1, 35.3], [111.1, 35.2]]],
      "properties": {
        "name": "测试水域",
        "fclass": "water"
      },
      "saved_at": "2024-01-23T07:40:00.000Z"
    }
  },
  "response_mode": "blocking",
  "user": "map_user"
}
```

### 示例3：用户输入 + 最新要素（未保存）

```json
{
  "inputs": {
    "user_input": "新增水域要素",
    "latest_feature": {
      "type": "polygon",
      "name": "未命名",
      "gid": null,
      "geometry_type": "Polygon",
      "coordinates": [[[111.1, 35.2], [111.2, 35.2], [111.2, 35.3], [111.1, 35.3], [111.1, 35.2]]],
      "properties": {},
      "saved_at": null
    }
  },
  "response_mode": "blocking",
  "user": "map_user"
}
```

## 在工作流中使用变量

### 访问用户输入：

```
{{#user_input#}}
```

### 访问要素数据：

```
{{#latest_feature.type#}}        // 获取要素类型
{{#latest_feature.name#}}        // 获取要素名称
{{#latest_feature.coordinates#}}  // 获取坐标数组
```

### 条件判断（检查要素是否存在）：

在 Dify 中可以使用条件节点判断 `latest_feature` 是否存在：

```
如果 latest_feature 不为空
  则：使用要素数据
否则：只使用用户输入
```

## 修改变量名

如果需要在 Dify 中使用不同的变量名，需要修改前端代码：

**文件**: `output/js/ai-chat.js`

**函数**: `buildDifyPayload()`

修改示例：
```javascript
const inputs = {
    query: userInput,  // 如果Dify中使用 "query" 而不是 "user_input"
    feature_data: {    // 如果Dify中使用 "feature_data" 而不是 "latest_feature"
        // ...
    }
};
```

## 总结

**必需变量**：
- `user_input` (String) - 用户输入的文本

**可选变量**：
- `latest_feature` (Object) - 最新要素数据（包含几何坐标）

**重要提示**：
- 变量名必须与代码中的键名完全匹配
- `latest_feature` 可能不存在，需要在工作流中做判断
- 坐标格式遵循 GeoJSON 规范

---

**版本**: 1.0.0  
**最后更新**: 2024年

