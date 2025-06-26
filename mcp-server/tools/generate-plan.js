import { z } from "zod";

export default function generatePlan() {
    return {
        name: "generate-plan",
        description: "基于搜索到的餐厅生成3个不同策略的团建方案供用户选择",
        schema: {
            restaurants: z.array(z.object({
                id: z.string(),
                name: z.string(),
                cuisine: z.string(),
                rating: z.number(),
                priceRange: z.string(),
                capacity: z.number(),
                address: z.string(),
                phone: z.string(),
                features: z.array(z.string()),
                distance: z.number(),
                averagePrice: z.number(),
                specialDishes: z.array(z.string())
            })).describe("搜索到的餐厅列表"),
            
            preferences: z.object({
                cuisine: z.string(),
                cuisineName: z.string(),
                groupSize: z.number(),
                budget: z.string(),
                budgetName: z.string(),
                specialRequirements: z.string()
            }).describe("用户偏好信息"),
            
            location: z.object({
                address: z.string(),
                city: z.string(),
                district: z.string()
            }).describe("活动地点信息")
        },
        handler: async ({ restaurants, preferences, location }) => {
            if (!restaurants || restaurants.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "❌ 没有可用的餐厅数据，无法生成方案。请先搜索餐厅。"
                        }
                    ],
                    plans: []
                };
            }

            // 生成三种不同策略的方案
            const plans = [];

            // 方案A：性价比之选
            const valueRestaurants = restaurants
                .filter(r => r.priceRange === "medium" || r.priceRange === "low")
                .sort((a, b) => (b.rating / a.averagePrice) - (a.rating / b.averagePrice))
                .slice(0, 1);

            if (valueRestaurants.length > 0) {
                const restaurant = valueRestaurants[0];
                const totalCost = restaurant.averagePrice * preferences.groupSize;
                
                plans.push({
                    id: "plan-a",
                    title: "💰 性价比优选方案",
                    strategy: "追求最佳性价比，在预算范围内选择评分最高的餐厅",
                    restaurant: restaurant,
                    highlights: [
                        `评分优秀：${restaurant.rating}/5.0 ⭐`,
                        `价格合理：人均${restaurant.averagePrice}元`,
                        `距离便利：仅${restaurant.distance}km`,
                        `设施完善：${restaurant.features.join("、")}`
                    ],
                    timeline: [
                        "12:00 - 集合出发",
                        "12:30 - 到达餐厅",
                        "12:45 - 开始用餐",
                        "14:30 - 用餐结束",
                        "15:00 - 活动总结/拍照留念"
                    ],
                    costs: {
                        perPerson: restaurant.averagePrice,
                        total: totalCost,
                        breakdown: [
                            { item: "餐费", amount: totalCost },
                            { item: "交通费（预估）", amount: 100 },
                            { item: "其他费用", amount: 200 }
                        ]
                    },
                    pros: [
                        "经济实惠，预算压力小",
                        "性价比高，物超所值", 
                        "评分良好，品质有保障"
                    ],
                    cons: [
                        "环境可能相对简单",
                        "服务标准中等水平"
                    ]
                });
            }

            // 方案B：高端体验方案
            const premiumRestaurants = restaurants
                .filter(r => r.priceRange === "high" || r.priceRange === "luxury")
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 1);

            if (premiumRestaurants.length > 0) {
                const restaurant = premiumRestaurants[0];
                const totalCost = restaurant.averagePrice * preferences.groupSize;
                
                plans.push({
                    id: "plan-b", 
                    title: "🌟 高端体验方案",
                    strategy: "追求优质体验，选择高端餐厅提升团建格调",
                    restaurant: restaurant,
                    highlights: [
                        `顶级评分：${restaurant.rating}/5.0 ⭐`,
                        `精致环境：${restaurant.features.join("、")}`,
                        `特色美食：${restaurant.specialDishes.slice(0,3).join("、")}`,
                        `优质服务：专业服务团队`
                    ],
                    timeline: [
                        "11:30 - 集合出发",
                        "12:00 - 到达餐厅，休息调整",
                        "12:15 - 开胃酒/茶水招待", 
                        "12:30 - 正式用餐开始",
                        "15:00 - 用餐结束，合影留念",
                        "15:30 - 返程"
                    ],
                    costs: {
                        perPerson: restaurant.averagePrice,
                        total: totalCost,
                        breakdown: [
                            { item: "餐费", amount: totalCost },
                            { item: "服务费", amount: Math.round(totalCost * 0.1) },
                            { item: "交通费", amount: 200 },
                            { item: "其他费用", amount: 300 }
                        ]
                    },
                    pros: [
                        "环境优雅，提升团队形象",
                        "服务专业，体验感佳",
                        "食材优质，口感出众"
                    ],
                    cons: [
                        "费用较高，预算压力大",
                        "可能需要提前预订"
                    ]
                });
            }

            // 方案C：特色推荐方案
            const specialtyRestaurants = restaurants
                .sort((a, b) => {
                    // 综合考虑评分、特色菜数量、设施特色
                    const scoreA = a.rating + a.specialDishes.length * 0.1 + a.features.length * 0.05;
                    const scoreB = b.rating + b.specialDishes.length * 0.1 + b.features.length * 0.05;
                    return scoreB - scoreA;
                })
                .slice(0, 1);

            if (specialtyRestaurants.length > 0) {
                const restaurant = specialtyRestaurants[0];
                const totalCost = restaurant.averagePrice * preferences.groupSize;
                
                plans.push({
                    id: "plan-c",
                    title: "🎭 特色体验方案", 
                    strategy: "注重特色和体验，选择有独特魅力的餐厅",
                    restaurant: restaurant,
                    highlights: [
                        `独特魅力：${restaurant.specialDishes.join("、")}`,
                        `特色设施：${restaurant.features.join("、")}`,
                        `优质评价：${restaurant.rating}/5.0 ⭐`,
                        `便利位置：距离${restaurant.distance}km`
                    ],
                    timeline: [
                        "11:45 - 集合，路线说明",
                        "12:15 - 到达餐厅",
                        "12:30 - 参观特色环境/设施",
                        "12:45 - 开始用餐体验",
                        "14:45 - 用餐结束",
                        "15:00 - 团建活动（如有特色活动）",
                        "15:30 - 总结分享，返程"
                    ],
                    costs: {
                        perPerson: restaurant.averagePrice,
                        total: totalCost,
                        breakdown: [
                            { item: "餐费", amount: totalCost },
                            { item: "特色体验费", amount: 150 },
                            { item: "交通费", amount: 150 },
                            { item: "其他费用", amount: 200 }
                        ]
                    },
                    pros: [
                        "体验独特，印象深刻",
                        "有话题性，增进交流",
                        "性价比平衡"
                    ],
                    cons: [
                        "可能需要适应期",
                        "体验效果因人而异"
                    ]
                });
            }

            // 格式化输出
            const planSummary = plans.map((plan, index) => {
                const totalWithExtras = plan.costs.breakdown.reduce((sum, item) => sum + item.amount, 0);
                return `## ${plan.title}

**核心策略**: ${plan.strategy}

**推荐餐厅**: ${plan.restaurant.name}
- 📍 地址：${plan.restaurant.address}  
- ⭐ 评分：${plan.restaurant.rating}/5.0
- 💰 人均：${plan.restaurant.averagePrice}元
- 📞 电话：${plan.restaurant.phone}

**活动亮点**:
${plan.highlights.map(h => `- ${h}`).join('\n')}

**时间安排**:
${plan.timeline.map(t => `- ${t}`).join('\n')}

**费用预算**:
- 人均餐费：${plan.costs.perPerson}元
- 总预算：${totalWithExtras}元（${preferences.groupSize}人）

**方案优势**:
${plan.pros.map(p => `✅ ${p}`).join('\n')}

**注意事项**:
${plan.cons.map(c => `⚠️ ${c}`).join('\n')}

---`;
            }).join('\n\n');

            return {
                content: [
                    {
                        type: "text",
                        text: `🎉 团建方案生成完成！为您准备了${plans.length}个不同风格的方案：

${planSummary}

🤔 **选择建议**：
- 预算优先 → 选择方案A
- 体验优先 → 选择方案B  
- 平衡考虑 → 选择方案C

请告诉我您选择哪个方案，我将为您生成完整的HTML团建规划报告！`
                    }
                ],
                plans: plans
            };
        }
    };
} 