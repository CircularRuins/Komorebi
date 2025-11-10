# 步骤功能分析

## 代码结构

每个步骤都已封装为独立的函数，在主函数 `queryArticles` 中按顺序执行：

### 步骤函数列表

1. **`stepQueryDatabase`** - 步骤1: 查询数据库文章
2. **`stepComputeTopicEmbedding`** - 步骤2: 计算话题向量（仅在有话题时）
3. **`stepLoadEmbeddings`** - 步骤3: 加载已有文章向量（仅在有话题时）
4. **`stepComputeEmbeddings`** - 步骤4: 计算新文章向量（仅在有话题时）
5. **`stepCalculateSimilarity`** - 步骤5: 计算相似度并筛选（仅在有话题时）
6. **`clusterArticles`** - 步骤6: 分析文章内容并聚类

### 执行流程

```typescript
// 主函数 queryArticles 中的执行顺序：
1. stepQueryDatabase()           // 总是执行
2. stepComputeTopicEmbedding()   // 仅在有话题时
3. stepLoadEmbeddings()          // 仅在有话题时
4. stepComputeEmbeddings()       // 仅在有话题时
5. stepCalculateSimilarity()     // 仅在有话题时
6. clusterArticles()             // 在 handleGenerateSummary 中调用
```

## 步骤定义和执行时机对照

### 1. query-db (查询数据库文章)
- **步骤ID**: `query-db`
- **步骤标题**: `查询数据库文章`
- **执行位置**: `queryArticles` 函数开始处（第810行）
- **实际功能**:
  - 等待数据库初始化
  - 根据时间范围筛选文章（使用 Lovefield 查询）
  - 按日期降序排序，限制1000篇
- **完成时机**: 查询完成后（第847行）
- **状态更新**: ✅ 匹配

### 2. compute-topic-embedding (计算话题向量) - 仅在有话题时显示
- **步骤ID**: `compute-topic-embedding`
- **步骤标题**: `计算话题向量`
- **执行位置**: `queryArticles` 函数中，如果有话题（第859行）
- **实际功能**:
  - 调用 `computeTopicEmbedding` 计算话题的 embedding 向量
  - 如果失败，回退到全文匹配
- **完成时机**: 计算完成后（第863行）或失败时（第865行）
- **状态更新**: ✅ 匹配

### 3. load-embeddings (加载已有文章向量) - 仅在有话题时显示
- **步骤ID**: `load-embeddings`
- **步骤标题**: `加载已有文章向量`
- **执行位置**: `queryArticles` 函数中，计算话题向量后（第879行）
- **实际功能**:
  - 批量从数据库查询所有文章的 embedding 字段
  - 更新内存中的文章对象的 embedding
- **完成时机**: 加载完成后（第908行）
- **状态更新**: ✅ 匹配

### 4. compute-embeddings (计算新文章向量) - 仅在有话题时显示
- **步骤ID**: `compute-embeddings`
- **步骤标题**: `计算新文章向量`
- **执行位置**: `queryArticles` 函数中，加载已有向量后（第923行）
- **实际功能**:
  - 过滤出没有 embedding 的文章
  - 调用 `computeAndStoreEmbeddings` 批量计算并存储 embedding
  - 计算完成后重新加载这些文章的 embedding
- **完成时机**: 计算完成后（第954行）或所有文章已有向量时（第960行）
- **状态更新**: ✅ 匹配
- **注意**: 在 `computeAndStoreEmbeddings` 内部也有进度更新（第1075行）

### 5. calculate-similarity (计算相似度并筛选) - 仅在有话题时显示
- **步骤ID**: `calculate-similarity`
- **步骤标题**: `计算相似度并筛选`
- **执行位置**: `queryArticles` 函数中，计算完所有 embedding 后（第964行）
- **实际功能**:
  - 计算每篇文章与话题的余弦相似度
  - 筛选相似度 >= 阈值的文章
  - 按相似度降序排序
  - 选择前100篇
- **完成时机**: 筛选完成后（第996行）
- **状态更新**: ✅ 匹配
- **注意**: 有进度更新，每处理10%更新一次（第983行）

### 6. cluster-articles (分析文章内容并聚类)
- **步骤ID**: `cluster-articles`
- **步骤标题**: `分析文章内容并聚类`
- **执行位置**: `clusterArticles` 函数开始处（第1139行）
- **实际功能**:
  - 调用 LLM API 对文章进行聚类分析
  - 解析返回的 JSON 结果
  - 验证和转换聚类结果
- **完成时机**: 聚类完成后（第1341行）
- **状态更新**: ✅ 匹配
- **调用时机**: 在 `handleGenerateSummary` 中，查询完文章后调用（第1571行）

## 执行流程

### 无话题时的流程：
1. query-db → 2. cluster-articles

### 有话题时的流程：
1. query-db
2. compute-topic-embedding
3. load-embeddings
4. compute-embeddings
5. calculate-similarity
6. cluster-articles

## 发现的问题

1. ✅ **步骤顺序正确**: 所有步骤的执行顺序与定义顺序一致
2. ✅ **步骤时机匹配**: 每个步骤的更新时机与实际功能执行时机匹配
3. ✅ **条件显示正确**: 话题相关步骤只在有话题时显示
4. ⚠️ **潜在问题**: `cluster-articles` 步骤在 `queryArticles` 返回后才执行，但步骤定义在所有步骤的最后，这是正确的

## 建议

所有步骤的定义和执行时机都是匹配的，代码逻辑正确。

