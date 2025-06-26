import { z } from "zod";

export default function getLocation() {
    return {
        name: "get-location",
        description: "获取当前位置信息，支持手动输入地址或使用预设位置",
        schema: {
            address: z.string().optional().describe("手动输入的地址，如：'北京市朝阳区'"),
            useDefault: z.boolean().optional().default(true).describe("是否使用默认位置（公司地址）")
        },
        handler: async ({ address, useDefault = true }) => {
            // 默认位置（可以设置为你们公司的位置）
            const defaultLocation = {
                address: "北京市朝阳区建国门外大街1号",
                latitude: 39.9087,
                longitude: 116.4073,
                city: "北京市",
                district: "朝阳区"
            };

            let currentLocation;

            if (address && !useDefault) {
                // 简化版：解析用户输入的地址
                // 实际应用中可以调用地理编码API
                currentLocation = {
                    address: address,
                    latitude: 39.9087, // 模拟坐标
                    longitude: 116.4073,
                    city: address.includes("北京") ? "北京市" : "未知城市",
                    district: "未知区域"
                };
            } else {
                currentLocation = defaultLocation;
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `📍 当前位置信息：
地址：${currentLocation.address}
城市：${currentLocation.city}
区域：${currentLocation.district}
坐标：${currentLocation.latitude}, ${currentLocation.longitude}

位置获取成功！可以开始搜索附近的餐厅了。`,
                    },
                ],
                // 返回结构化数据供后续工具使用
                locationData: currentLocation
            };
        }
    };
} 