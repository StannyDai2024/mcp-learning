import { z } from "zod";

export default function askUserPreference() {
    return {
        name: "ask-user-preference",
        description: "收集用户的就餐偏好信息，包括菜系类型、人数、预算等",
        schema: {
            cuisine: z.enum([
                "chinese", "sichuan", "cantonese", "japanese", 
                "korean", "western", "hotpot", "barbecue", "thai", "other"
            ]).describe("菜系类型：chinese(中餐), sichuan(川菜), cantonese(粤菜), japanese(日料), korean(韩餐), western(西餐), hotpot(火锅), barbecue(烧烤), thai(泰餐), other(其他)"),
            
            groupSize: z.number().min(2).max(50).describe("聚餐人数，2-50人"),
            
            budget: z.enum(["low", "medium", "high", "luxury"]).optional().default("medium").describe("预算范围：low(经济实惠), medium(中等), high(高端), luxury(奢华)"),
            
            specialRequirements: z.string().optional().describe("特殊要求，如：素食、无障碍通道、包间等")
        },
        handler: async ({ cuisine, groupSize, budget = "medium", specialRequirements }) => {
            // 菜系映射
            const cuisineMap = {
                "chinese": "中餐",
                "sichuan": "川菜", 
                "cantonese": "粤菜",
                "japanese": "日料",
                "korean": "韩餐",
                "western": "西餐",
                "hotpot": "火锅",
                "barbecue": "烧烤",
                "thai": "泰餐",
                "other": "其他"
            };

            // 预算映射
            const budgetMap = {
                "low": "经济实惠 (人均50-100元)",
                "medium": "中等消费 (人均100-200元)", 
                "high": "高端餐厅 (人均200-400元)",
                "luxury": "奢华体验 (人均400元以上)"
            };

            // 根据人数给出建议
            let sizeAdvice = "";
            if (groupSize <= 4) {
                sizeAdvice = "小型聚餐，建议选择精致餐厅";
            } else if (groupSize <= 10) {
                sizeAdvice = "中型团建，建议预订包间或大桌";
            } else if (groupSize <= 20) {
                sizeAdvice = "大型聚会，需要预订包间或分桌用餐";
            } else {
                sizeAdvice = "超大团建，建议选择宴会厅或分批用餐";
            }

            const preferences = {
                cuisine,
                cuisineName: cuisineMap[cuisine],
                groupSize,
                budget,
                budgetName: budgetMap[budget],
                specialRequirements: specialRequirements || "无特殊要求",
                sizeAdvice
            };

            return {
                content: [
                    {
                        type: "text",
                        text: `✅ 用户偏好信息收集完成：

🍽️ 菜系偏好：${preferences.cuisineName}
👥 聚餐人数：${preferences.groupSize}人
💰 预算范围：${preferences.budgetName}
📋 特殊要求：${preferences.specialRequirements}

💡 建议：${preferences.sizeAdvice}

偏好信息已记录，准备搜索符合条件的餐厅...`,
                    },
                ],
                // 返回结构化数据供后续工具使用
                preferences: preferences
            };
        }
    };
} 