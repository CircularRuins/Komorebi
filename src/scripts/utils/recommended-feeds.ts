// 直接导入JSON配置文件
import recommendedFeedsConfig from "../../recommended-feeds.json"

export interface RecommendedFeed {
    name: string
    url: string
}

export interface RecommendedFeedGroup {
    groupName: string
    feeds: RecommendedFeed[]
}


/**
 * 从项目中的JSON配置文件加载推荐订阅源
 */
export async function loadRecommendedFeeds(): Promise<RecommendedFeedGroup[]> {
    try {
        if (recommendedFeedsConfig && Array.isArray(recommendedFeedsConfig)) {
            return recommendedFeedsConfig as RecommendedFeedGroup[]
        }
        return []
    } catch (error) {
        console.error("Error loading recommended feeds:", error)
        return []
    }
}

