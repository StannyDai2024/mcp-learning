import { z } from "zod";

export default function searchRestaurants() {
    return {
        name: "search-restaurants",
        description: "根据位置和用户偏好搜索附近的餐厅",
        schema: {
            latitude: z.number().describe("纬度"),
            longitude: z.number().describe("经度"),
            cuisine: z.string().describe("菜系类型"),
            groupSize: z.number().describe("聚餐人数"),
            budget: z.string().describe("预算范围"),
            radius: z.number().optional().default(5).describe("搜索半径(公里)")
        },
        handler: async ({ latitude, longitude, cuisine, groupSize, budget, radius = 5 }) => {
            // 模拟餐厅数据库（实际应用中会调用真实API）
            const mockRestaurants = [
                // 川菜餐厅
                {
                    id: "r001",
                    name: "巴蜀风情川菜馆",
                    cuisine: "sichuan",
                    rating: 4.6,
                    priceRange: "medium",
                    capacity: 15,
                    address: "朝阳区建国门外大街88号",
                    phone: "010-6588-1234",
                    features: ["包间可用", "停车位", "WiFi"],
                    distance: 0.8,
                    averagePrice: 158,
                    specialDishes: ["水煮鱼", "麻婆豆腐", "回锅肉"]
                },
                {
                    id: "r002", 
                    name: "蜀香阁",
                    cuisine: "sichuan",
                    rating: 4.8,
                    priceRange: "high",
                    capacity: 25,
                    address: "朝阳区东三环中路99号",
                    phone: "010-6589-5678",
                    features: ["豪华包间", "代客泊车", "茶艺表演"],
                    distance: 1.2,
                    averagePrice: 268,
                    specialDishes: ["干锅花菜", "蒜泥白肉", "毛血旺"]
                },
                // 粤菜餐厅
                {
                    id: "r003",
                    name: "港岛茶餐厅",
                    cuisine: "cantonese", 
                    rating: 4.4,
                    priceRange: "medium",
                    capacity: 20,
                    address: "朝阳区国贸大厦B1层",
                    phone: "010-6588-9999",
                    features: ["早茶", "点心", "包间"],
                    distance: 0.5,
                    averagePrice: 138,
                    specialDishes: ["白切鸡", "蒸排骨", "虾饺"]
                },
                {
                    id: "r004",
                    name: "翠华轩",
                    cuisine: "cantonese",
                    rating: 4.7,
                    priceRange: "high", 
                    capacity: 30,
                    address: "朝阳区金桐东路88号",
                    phone: "010-6677-8888",
                    features: ["宴会厅", "现场制作", "商务包间"],
                    distance: 2.1,
                    averagePrice: 328,
                    specialDishes: ["白云猪手", "蜜汁叉烧", "清蒸石斑鱼"]
                },
                // 日料餐厅
                {
                    id: "r005",
                    name: "樱花日本料理",
                    cuisine: "japanese",
                    rating: 4.5,
                    priceRange: "medium",
                    capacity: 12,
                    address: "朝阳区三里屯路19号",
                    phone: "010-6416-7890",
                    features: ["榻榻米包间", "现场制作", "清酒品鉴"],
                    distance: 1.8,
                    averagePrice: 198,
                    specialDishes: ["刺身拼盘", "天妇罗", "寿司套餐"]
                },
                // 火锅餐厅
                {
                    id: "r006",
                    name: "海底捞火锅",
                    cuisine: "hotpot",
                    rating: 4.3,
                    priceRange: "medium",
                    capacity: 40,
                    address: "朝阳区大望路SOHO现代城",
                    phone: "010-5869-1234",
                    features: ["24小时营业", "免费小食", "儿童游乐区"],
                    distance: 2.5,
                    averagePrice: 118,
                    specialDishes: ["毛肚", "虾滑", "手工面条"]
                }
            ];

            // 根据条件筛选餐厅
            let filteredRestaurants = mockRestaurants.filter(restaurant => {
                // 菜系匹配
                if (cuisine !== "other" && restaurant.cuisine !== cuisine) {
                    return false;
                }
                
                // 容量检查
                if (restaurant.capacity < groupSize) {
                    return false;
                }
                
                // 预算匹配
                if (restaurant.priceRange !== budget && budget !== "medium") {
                    return false;
                }
                
                // 距离限制
                if (restaurant.distance > radius) {
                    return false;
                }
                
                return true;
            });

            // 按评分和距离排序
            filteredRestaurants.sort((a, b) => {
                const scoreA = a.rating * 0.7 + (5 - a.distance) * 0.3;
                const scoreB = b.rating * 0.7 + (5 - b.distance) * 0.3;
                return scoreB - scoreA;
            });

            // 限制返回结果数量
            filteredRestaurants = filteredRestaurants.slice(0, 6);

            if (filteredRestaurants.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ 抱歉，在${radius}公里范围内没有找到符合条件的餐厅。
                            
建议：
1. 扩大搜索范围
2. 调整菜系选择  
3. 修改预算要求
4. 减少特殊要求限制`,
                        },
                    ],
                    restaurants: []
                };
            }

            // 格式化餐厅信息
            const restaurantList = filteredRestaurants.map((restaurant, index) => {
                return `${index + 1}. **${restaurant.name}**
   📍 地址：${restaurant.address}
   ⭐ 评分：${restaurant.rating}/5.0
   👥 可容纳：${restaurant.capacity}人
   💰 人均：${restaurant.averagePrice}元
   📞 电话：${restaurant.phone}
   🚗 距离：${restaurant.distance}km
   🎯 特色：${restaurant.specialDishes.join("、")}
   ✨ 设施：${restaurant.features.join("、")}`;
            }).join("\n\n");

            return {
                content: [
                    {
                        type: "text", 
                        text: `🔍 餐厅搜索结果（共找到${filteredRestaurants.length}家符合条件的餐厅）：

${restaurantList}

所有餐厅均符合您的条件：
- 菜系要求
- ${groupSize}人用餐需求  
- ${budget}预算范围
- ${radius}公里距离范围

准备为您生成推荐方案...`,
                    },
                ],
                restaurants: filteredRestaurants
            };
        }
    };
} 