import * as React from "react"
import intl from "react-intl-universal"
import { Stack } from "@fluentui/react"
import { Label } from "@fluentui/react/lib/Label"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { getMonthlyStatistics, getAvailableMonths, type MonthlyStatistics } from "../scripts/api-call-recorder"

type TokenUsageProps = {
    display: boolean
}

type TokenUsageState = {
    selectedMonth: string
    availableMonths: Array<{ year: number, month: number }>
    monthlyUsage: MonthlyStatistics[]
    loading: boolean
}


class TokenUsage extends React.Component<TokenUsageProps, TokenUsageState> {
    constructor(props) {
        super(props)
        // 初始化选中月份为当前月份
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        this.state = {
            selectedMonth: currentMonth,
            availableMonths: [],
            monthlyUsage: [],
            loading: true
        }
    }

    componentDidMount() {
        this.loadData()
    }

    loadData = async () => {
        this.setState({ loading: true })
        try {
            const availableMonths = await getAvailableMonths()
            const [year, month] = this.state.selectedMonth.split('-').map(Number)
            const monthlyUsage = await getMonthlyStatistics(year, month)
            this.setState({
                availableMonths,
                monthlyUsage,
                loading: false
            })
        } catch (error) {
            console.error('加载数据失败:', error)
            this.setState({ loading: false })
        }
    }

    componentDidUpdate(prevProps: TokenUsageProps, prevState: TokenUsageState) {
        // 当组件从隐藏变为显示时，重新加载数据
        if (!prevProps.display && this.props.display) {
            this.loadData()
        }
        // 当选中月份变化时，重新加载月度数据
        if (prevState.selectedMonth !== this.state.selectedMonth) {
            this.loadMonthlyData()
        }
    }

    loadMonthlyData = async () => {
        const [year, month] = this.state.selectedMonth.split('-').map(Number)
        try {
            const monthlyUsage = await getMonthlyStatistics(year, month)
            this.setState({ monthlyUsage })
        } catch (error) {
            console.error('加载月度数据失败:', error)
        }
    }


    // 获取可用的月份列表
    getAvailableMonths = (): IDropdownOption[] => {
        const { availableMonths } = this.state
        
        // 转换为选项列表
        const currentLocale = window.settings?.getCurrentLocale() || "en-US"
        const isChinese = currentLocale.startsWith("zh")
        
        // 如果数据库中没有记录，至少显示当前月份
        let monthsToShow = availableMonths
        if (monthsToShow.length === 0) {
            const now = new Date()
            monthsToShow = [{ year: now.getFullYear(), month: now.getMonth() + 1 }]
        }
        
        const options: IDropdownOption[] = monthsToShow.map(({ year, month }) => {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`
            const text = isChinese
                ? `${year}年${month}月`
                : `${new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })} ${year}`
            return {
                key: monthKey,
                text: text
            }
        })
        
        return options
    }

    // 处理月份选择变化
    handleMonthChange = (option?: IDropdownOption) => {
        if (option) {
            this.setState({ selectedMonth: option.key as string })
        }
    }

    render = () => {
        if (!this.props.display) {
            return null
        }

        return (
            <div className="tab-body" style={{ paddingBottom: "20px" }}>
                {/* 每月用量区域 */}
                <div
                    style={{
                        padding: "20px",
                        marginBottom: "24px",
                        backgroundColor: "var(--neutralLighterAlt)",
                        borderRadius: "4px",
                        border: "1px solid var(--neutralLight)",
                    }}>
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} style={{ marginBottom: "24px", justifyContent: "space-between" }}>
                        <Label style={{ fontSize: "14px", fontWeight: 600, marginTop: "0", marginBottom: "0" }}>
                            {intl.get("tokenUsage.monthlyUsage") || "每月用量"}
                        </Label>
                        <Dropdown
                            selectedKey={this.state.selectedMonth}
                            options={this.getAvailableMonths()}
                            onChanged={this.handleMonthChange}
                            style={{ width: 120 }}
                        />
                    </Stack>
                    {(() => {
                        const { monthlyUsage, loading } = this.state
                        if (loading) {
                            return (
                                <div style={{ fontSize: "12px", color: "var(--neutralSecondary)", padding: "20px", textAlign: "center" }}>
                                    {intl.get("tokenUsage.loading") || "加载中..."}
                                </div>
                            )
                        }
                        return monthlyUsage.length === 0 ? (
                            <div style={{ fontSize: "12px", color: "var(--neutralSecondary)", padding: "20px", textAlign: "center" }}>
                                {intl.get("tokenUsage.noMonthlyData") || "该月暂无使用记录"}
                            </div>
                        ) : (
                            <div style={{ 
                                border: "1px solid white",
                                backgroundColor: "var(--neutralLighterAlt)",
                                overflowX: "auto",
                            }}>
                                <table style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: "12px",
                                    backgroundColor: "var(--neutralLighterAlt)",
                                    color: "white",
                                }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "var(--neutralLighterAlt)" }}>
                                            <th style={{ 
                                                padding: "12px 8px", 
                                                textAlign: "center", 
                                                borderBottom: "1px solid var(--neutralLight)",
                                                fontWeight: 600,
                                                color: "white",
                                            }}>
                                                {intl.get("tokenUsage.model") || "模型"}
                                            </th>
                                            <th style={{ 
                                                padding: "12px 8px", 
                                                textAlign: "center", 
                                                borderBottom: "1px solid var(--neutralLight)",
                                                fontWeight: 600,
                                                color: "white",
                                            }}>
                                                {intl.get("tokenUsage.apiRequests") || "API请求次数"}
                                            </th>
                                            <th style={{ 
                                                padding: "12px 8px", 
                                                textAlign: "center", 
                                                borderBottom: "1px solid var(--neutralLight)",
                                                fontWeight: 600,
                                                color: "white",
                                            }}>
                                                {intl.get("tokenUsage.inputTokens") || "输入 Tokens"}
                                            </th>
                                            <th style={{ 
                                                padding: "12px 8px", 
                                                textAlign: "center", 
                                                borderBottom: "1px solid var(--neutralLight)",
                                                fontWeight: 600,
                                                color: "white",
                                            }}>
                                                {intl.get("tokenUsage.outputTokens") || "输出 Tokens"}
                                            </th>
                                            <th style={{ 
                                                padding: "12px 8px", 
                                                textAlign: "center", 
                                                borderBottom: "1px solid var(--neutralLight)",
                                                fontWeight: 600,
                                                color: "white",
                                            }}>
                                                {intl.get("tokenUsage.totalTokens") || "总计 Tokens"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyUsage.map((item, index) => (
                                            <tr 
                                                key={item.model}
                                                style={{ 
                                                    backgroundColor: "var(--neutralLighterAlt)",
                                                    borderBottom: index < monthlyUsage.length - 1 ? "1px solid var(--neutralLight)" : "none",
                                                }}
                                            >
                                                <td style={{ padding: "12px 8px", textAlign: "center", color: "white" }}>
                                                    {item.model}
                                                </td>
                                                <td style={{ padding: "12px 8px", textAlign: "center", color: "white" }}>
                                                    {item.requestCount.toLocaleString()}
                                                </td>
                                                <td style={{ padding: "12px 8px", textAlign: "center", color: "white" }}>
                                                    {item.promptTokens.toLocaleString()}
                                                </td>
                                                <td style={{ padding: "12px 8px", textAlign: "center", color: "white" }}>
                                                    {item.completionTokens.toLocaleString()}
                                                </td>
                                                <td style={{ padding: "12px 8px", textAlign: "center", color: "white" }}>
                                                    {item.totalTokens.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })()}
                </div>
            </div>
        )
    }
}

export default TokenUsage

