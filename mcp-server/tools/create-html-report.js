import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

export default function createHtmlReport() {
    return {
        name: "create_html_report",
        description: "生成精美的HTML格式团建规划报告（简化版，确保稳定性）",
        schema: {
            // 🎯 核心活动信息 - 精简到最必要字段
            eventInfo: z.object({
                name: z.string().default("团建活动"),
                date: z.string().default("待定"),
                location: z.string(),
                organizer: z.string().default("团队负责人"),
                contact: z.string().optional(),
                participants: z.number().default(20)
            }).describe("活动基本信息"),
            
            // 🍽️ 餐厅列表 - 大幅简化，只保留核心字段
            restaurants: z.array(z.object({
                name: z.string(),
                address: z.string(),
                price: z.number(),
                cuisine: z.string().optional(),
                rating: z.number().optional(),
                distance: z.string().optional(),
                time: z.string().optional()
            })).max(10).describe("推荐餐厅列表（最多10个）"),
            
            // 🌤️ 天气信息 - 简化为基础字段
            weather: z.object({
                date: z.string(),
                condition: z.string(),
                temperature: z.string(),
                tips: z.string().optional()
            }).optional().describe("天气情况"),
            
            // ⏰ 时间安排 - 简化结构
            schedule: z.array(z.object({
                time: z.string(),
                activity: z.string()
            })).optional().describe("活动安排"),
            
            // 💡 建议信息 - 简化为字符串数组
            suggestions: z.array(z.string()).optional().describe("活动建议")
        },
        handler: async ({ eventInfo, restaurants, weather, schedule, suggestions }) => {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                const filename = `团建规划报告_${timestamp}.html`;
                
                // 🎨 现代化HTML模板（保留美观设计，简化数据结构）
                const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eventInfo.name} - 团建规划报告</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            margin-top: 20px;
            margin-bottom: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 60px 40px;
            text-align: center;
            position: relative;
        }
        
        .header h1 {
            font-size: 3em;
            margin-bottom: 15px;
            font-weight: 800;
        }
        
        .header p {
            font-size: 1.3em;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 50px;
        }
        
        .section-title {
            font-size: 2em;
            margin-bottom: 25px;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 15px;
            padding-bottom: 15px;
            border-bottom: 3px solid #3498db;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .info-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 15px;
            border-left: 4px solid #3498db;
        }
        
        .info-card h3 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        
        .info-card p {
            color: #666;
            font-size: 1.1em;
        }
        
        .restaurant-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin: 30px 0;
        }
        
        .restaurant-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            border: 1px solid #ecf0f1;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .restaurant-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        }
        
        .restaurant-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }
        
        .restaurant-name {
            font-size: 1.3em;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 5px;
        }
        
        .restaurant-cuisine {
            color: #666;
            font-size: 0.95em;
        }
        
        .restaurant-price {
            font-size: 1.5em;
            font-weight: bold;
            color: #27ae60;
        }
        
        .restaurant-details {
            margin-top: 15px;
        }
        
        .restaurant-detail {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 8px 0;
            color: #666;
        }
        
        .restaurant-detail i {
            width: 16px;
            color: #3498db;
        }
        
        .weather-card {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }
        
        .weather-icon {
            font-size: 4em;
            margin-bottom: 15px;
        }
        
        .weather-temp {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .weather-condition {
            font-size: 1.2em;
            margin-bottom: 15px;
        }
        
        .weather-tips {
            background: rgba(255,255,255,0.15);
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
        }
        
        .timeline {
            position: relative;
            margin: 30px 0;
        }
        
        .timeline-item {
            display: flex;
            align-items: center;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 15px;
            border-left: 4px solid #3498db;
        }
        
        .timeline-time {
            min-width: 80px;
            font-weight: bold;
            color: #3498db;
            font-size: 1.1em;
        }
        
        .timeline-activity {
            margin-left: 20px;
            font-size: 1.1em;
            color: #2c3e50;
        }
        
        .suggestions-list {
            display: grid;
            gap: 15px;
            margin: 30px 0;
        }
        
        .suggestion-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #27ae60;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .suggestion-item i {
            color: #27ae60;
            font-size: 1.2em;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 30px;
            margin-top: 50px;
        }
        
        @media (max-width: 768px) {
            .header h1 { font-size: 2em; }
            .content { padding: 20px; }
            .restaurant-grid { grid-template-columns: 1fr; }
            .info-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-users"></i> ${eventInfo.name}</h1>
            <p>精心规划，完美体验</p>
        </div>
        
        <div class="content">
            <!-- 活动信息概览 -->
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-info-circle"></i>
                    活动信息
                </h2>
                <div class="info-grid">
                    <div class="info-card">
                        <h3><i class="fas fa-calendar"></i> 活动时间</h3>
                        <p>${eventInfo.date}</p>
                    </div>
                    <div class="info-card">
                        <h3><i class="fas fa-map-marker-alt"></i> 集合地点</h3>
                        <p>${eventInfo.location}</p>
                    </div>
                    <div class="info-card">
                        <h3><i class="fas fa-user-tie"></i> 活动负责人</h3>
                        <p>${eventInfo.organizer}${eventInfo.contact ? ` (${eventInfo.contact})` : ''}</p>
                    </div>
                    <div class="info-card">
                        <h3><i class="fas fa-users"></i> 参与人数</h3>
                        <p>${eventInfo.participants}人</p>
                    </div>
                </div>
            </div>
            
            <!-- 推荐餐厅 -->
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-utensils"></i>
                    推荐餐厅 (${restaurants.length}家)
                </h2>
                <div class="restaurant-grid">
                    ${restaurants.map(restaurant => `
                        <div class="restaurant-card">
                            <div class="restaurant-header">
                                <div>
                                    <div class="restaurant-name">${restaurant.name}</div>
                                    ${restaurant.cuisine ? `<div class="restaurant-cuisine">${restaurant.cuisine}</div>` : ''}
                                </div>
                                <div class="restaurant-price">¥${restaurant.price}</div>
                            </div>
                            <div class="restaurant-details">
                                <div class="restaurant-detail">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${restaurant.address}</span>
                                </div>
                                ${restaurant.rating ? `
                                <div class="restaurant-detail">
                                    <i class="fas fa-star"></i>
                                    <span>评分 ${restaurant.rating}分</span>
                                </div>` : ''}
                                ${restaurant.distance ? `
                                <div class="restaurant-detail">
                                    <i class="fas fa-route"></i>
                                    <span>距离 ${restaurant.distance}</span>
                                </div>` : ''}
                                ${restaurant.time ? `
                                <div class="restaurant-detail">
                                    <i class="fas fa-clock"></i>
                                    <span>车程 ${restaurant.time}</span>
                                </div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${weather ? `
            <!-- 天气信息 -->
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-cloud-sun"></i>
                    天气预报
                </h2>
                <div class="weather-card">
                    <div class="weather-icon">
                        <i class="fas fa-${weather.condition.includes('雨') ? 'cloud-rain' : 
                                        weather.condition.includes('晴') ? 'sun' : 
                                        weather.condition.includes('云') ? 'cloud' : 'cloud-sun'}"></i>
                    </div>
                    <div class="weather-temp">${weather.temperature}</div>
                    <div class="weather-condition">${weather.condition}</div>
                    <div class="weather-date">${weather.date}</div>
                    ${weather.tips ? `
                    <div class="weather-tips">
                        <i class="fas fa-lightbulb"></i> ${weather.tips}
                    </div>` : ''}
                </div>
            </div>` : ''}
            
            ${schedule && schedule.length > 0 ? `
            <!-- 时间安排 -->
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-clock"></i>
                    时间安排
                </h2>
                <div class="timeline">
                    ${schedule.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-time">${item.time}</div>
                            <div class="timeline-activity">${item.activity}</div>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
            
            ${suggestions && suggestions.length > 0 ? `
            <!-- 活动建议 -->
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-lightbulb"></i>
                    活动建议
                </h2>
                <div class="suggestions-list">
                    ${suggestions.map(suggestion => `
                        <div class="suggestion-item">
                            <i class="fas fa-check-circle"></i>
                            <span>${suggestion}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        </div>
        
        <div class="footer">
            <p><i class="fas fa-heart"></i> 祝团建活动圆满成功！</p>
            <p style="margin-top: 10px; opacity: 0.8;">报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>`;

                // 获取完整文件路径
                const fullPath = path.resolve(filename);
                
                // 写入文件
                await fs.writeFile(filename, htmlContent, 'utf8');
                
                // 🔥 符合MCP协议规范的返回格式
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `团建规划报告已生成`,
                            filename: filename,
                            filePath: fullPath,
                            fileUrl: `file://${fullPath}`,
                            summary: {
                                eventName: eventInfo.name,
                                eventDate: eventInfo.date,
                                location: eventInfo.location,
                                participantCount: eventInfo.participants,
                                restaurantCount: restaurants.length,
                                hasWeather: !!weather,
                                hasSchedule: !!(schedule && schedule.length > 0),
                                suggestionCount: suggestions ? suggestions.length : 0
                            }
                        }, null, 2)
                    }],
                    isError: false
                };
                
            } catch (error) {
                console.error('生成HTML报告失败:', error);
                // 🔥 符合MCP协议规范的错误返回格式
                return {
                    content: [{
                        type: "text",
                        text: `生成HTML报告失败: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    };
} 