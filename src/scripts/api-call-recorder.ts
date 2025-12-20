import * as db from "./db"
import lf from "lovefield"

export interface ApiCallRecord {
    id?: number
    model: string
    api_type: string
    call_context: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    timestamp: Date
}

export interface MonthlyStatistics {
    model: string
    requestCount: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

/**
 * 记录API调用到数据库
 */
export async function recordApiCall(
    model: string,
    apiType: string,
    callContext: string,
    usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }
): Promise<void> {
    // 等待数据库初始化
    let retries = 0
    while ((!db.itemsDB || !db.apiCalls) && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
    }

    if (!db.itemsDB || !db.apiCalls) {
        console.error('数据库未初始化，无法记录API调用')
        return
    }

    try {
        const row = db.apiCalls.createRow({
            model: model,
            api_type: apiType,
            call_context: callContext,
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || 0,
            timestamp: new Date()
        })

        await db.itemsDB.insert().into(db.apiCalls).values([row]).exec()
    } catch (error) {
        // 记录失败不应影响主业务流程
        console.error('记录API调用失败:', error)
    }
}

/**
 * 获取指定月份的API调用统计
 */
export async function getMonthlyStatistics(year: number, month: number): Promise<MonthlyStatistics[]> {
    // 等待数据库初始化
    let retries = 0
    while ((!db.itemsDB || !db.apiCalls) && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
    }

    if (!db.itemsDB || !db.apiCalls) {
        return []
    }

    try {
        // 计算月份的开始和结束时间
        const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
        const endDate = new Date(year, month, 1, 0, 0, 0, 0)

        // 查询指定月份的所有记录
        const records = await db.itemsDB
            .select()
            .from(db.apiCalls)
            .where(
                lf.op.and(
                    db.apiCalls.timestamp.gte(startDate),
                    db.apiCalls.timestamp.lt(endDate)
                )
            )
            .exec() as ApiCallRecord[]

        // 按模型分组并聚合统计
        const modelMap = new Map<string, MonthlyStatistics>()

        records.forEach(record => {
            const existing = modelMap.get(record.model)
            if (existing) {
                existing.requestCount += 1
                existing.promptTokens += record.prompt_tokens
                existing.completionTokens += record.completion_tokens
                existing.totalTokens += record.total_tokens
            } else {
                modelMap.set(record.model, {
                    model: record.model,
                    requestCount: 1,
                    promptTokens: record.prompt_tokens,
                    completionTokens: record.completion_tokens,
                    totalTokens: record.total_tokens
                })
            }
        })

        // 转换为数组并按模型名称排序
        return Array.from(modelMap.values()).sort((a, b) => a.model.localeCompare(b.model))
    } catch (error) {
        console.error('查询月度统计失败:', error)
        return []
    }
}

/**
 * 获取所有可用的月份列表
 */
export async function getAvailableMonths(): Promise<Array<{ year: number, month: number }>> {
    // 等待数据库初始化
    let retries = 0
    while ((!db.itemsDB || !db.apiCalls) && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
    }

    if (!db.itemsDB || !db.apiCalls) {
        return []
    }

    try {
        // 查询所有记录的时间戳
        const records = await db.itemsDB
            .select(db.apiCalls.timestamp)
            .from(db.apiCalls)
            .exec() as Array<{ timestamp: Date }>

        // 提取唯一的年月组合
        const monthSet = new Set<string>()
        records.forEach(record => {
            const date = new Date(record.timestamp)
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`
            monthSet.add(monthKey)
        })

        // 转换为数组并按时间倒序排列
        return Array.from(monthSet)
            .map(key => {
                const [year, month] = key.split('-').map(Number)
                return { year, month }
            })
            .sort((a, b) => {
                if (a.year !== b.year) {
                    return b.year - a.year
                }
                return b.month - a.month
            })
    } catch (error) {
        console.error('查询可用月份失败:', error)
        return []
    }
}


