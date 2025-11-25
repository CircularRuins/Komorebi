// 直接导入JSON配置文件
import recommendedFeedsConfig from "../../recommended-feeds.json"
import { getFeedIcon } from "../utils"

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

/**
 * 更新推荐订阅源的图标
 * 在应用初始化时调用，预加载推荐订阅源的图标到缓存中
 * @param force 是否强制刷新，忽略缓存
 */
export async function updateRecommendedFeedIcons(force: boolean = false): Promise<void> {
    try {
        const groups = await loadRecommendedFeeds()
        const allFeeds = groups.flatMap(group => group.feeds)
        
        // 并行获取所有推荐订阅源的图标
        const iconPromises = allFeeds.map(async (feed) => {
            try {
                await getFeedIcon(feed.url, force)
            } catch (error) {
                console.error(`Failed to update icon for recommended feed ${feed.url}:`, error)
            }
        })
        
        await Promise.all(iconPromises)
    } catch (error) {
        console.error("Error updating recommended feed icons:", error)
    }
}

