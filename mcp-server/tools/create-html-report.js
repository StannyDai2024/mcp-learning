import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

export default function createHtmlReport() {
    return {
        name: "create_html_report",
        description: "生成精美的HTML格式团建规划报告，支持多餐厅对比、路线规划、天气预报等功能",
        schema: {
            eventDetails: z.object({
                eventName: z.string().optional().default("团队建设聚餐活动"),
                eventDate: z.string().optional().default("待定"),
                organizer: z.string().optional().default("团队负责人"),
                contact: z.string().optional().default("待补充"),
                participantCount: z.number().optional().default(20),
                location: z.object({
                    name: z.string(),
                    address: z.string(),
                    coordinates: z.string().optional()
                })
            }).describe("活动基本信息"),
            
            restaurants: z.array(z.object({
                id: z.string().optional(),
                name: z.string(),
                address: z.string(),
                phone: z.string().optional(),
                rating: z.number().optional(),
                averagePrice: z.number(),
                cuisine: z.string().optional(),
                specialDishes: z.array(z.string()).optional(),
                features: z.array(z.string()).optional(),
                businessHours: z.string().optional(),
                photos: z.array(z.string()).optional(),
                transportation: z.object({
                    walkingTime: z.string().optional(),
                    walkingDistance: z.string().optional(),
                    drivingTime: z.string().optional(),
                    route: z.string().optional()
                }).optional()
            })).describe("候选餐厅列表"),
            
            weather: z.object({
                date: z.string(),
                dayWeather: z.string(),
                nightWeather: z.string(),
                dayTemp: z.string(),
                nightTemp: z.string(),
                wind: z.string(),
                advice: z.string().optional()
            }).optional().describe("天气信息"),
            
            schedule: z.array(z.object({
                time: z.string(),
                activity: z.string(),
                note: z.string().optional()
            })).optional().describe("活动时间安排"),
            
            budget: z.object({
                totalParticipants: z.number(),
                restaurantOptions: z.array(z.object({
                    restaurantName: z.string(),
                    pricePerPerson: z.number(),
                    totalCost: z.number(),
                    costBreakdown: z.array(z.object({
                        item: z.string(),
                        amount: z.number()
                    })).optional()
                })),
                recommendations: z.string().optional()
            }).optional().describe("预算分析"),
            
            suggestions: z.object({
                weatherTips: z.array(z.string()).optional(),
                teamActivities: z.array(z.string()).optional(),
                diningTips: z.array(z.string()).optional(),
                bookingAdvice: z.array(z.string()).optional()
            }).optional().describe("活动建议")
        },
        handler: async ({ eventDetails, restaurants, weather, schedule, budget, suggestions }) => {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                const filename = `团建规划报告_${timestamp}.html`;
                
                const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eventDetails.eventName} - 团建规划报告</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            min-height: 100vh;
            position: relative;
        }
        
        .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 60px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,0.05) 10px,
                rgba(255,255,255,0.05) 20px
            );
            animation: slide 20s linear infinite;
        }
        
        @keyframes slide {
            0% { transform: translateX(-50px); }
            100% { transform: translateX(50px); }
        }
        
        .header h1 {
            font-size: 3em;
            margin-bottom: 15px;
            font-weight: 800;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1;
        }
        
        .header p {
            font-size: 1.3em;
            opacity: 0.95;
            position: relative;
            z-index: 1;
        }
        
        .overview-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            padding: 40px;
            margin: -30px 40px 0;
            position: relative;
            z-index: 2;
        }
        
        .overview-card {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border: 1px solid #f0f0f0;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .overview-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .overview-card i {
            font-size: 2.5em;
            margin-bottom: 15px;
            display: block;
        }
        
        .overview-card h3 {
            font-size: 1.1em;
            color: #666;
            margin-bottom: 10px;
        }
        
        .overview-card .value {
            font-size: 1.8em;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .content {
            padding: 60px 40px;
        }
        
        .section {
            margin-bottom: 60px;
        }
        
        .section-title {
            font-size: 2.2em;
            margin-bottom: 30px;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 15px;
            padding-bottom: 15px;
            border-bottom: 3px solid #3498db;
        }
        
        .restaurant-comparison {
            overflow-x: auto;
            margin: 30px 0;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .restaurant-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            min-width: 800px;
        }
        
        .restaurant-table th {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 20px 15px;
            text-align: left;
            font-weight: 600;
            font-size: 1.1em;
        }
        
        .restaurant-table th:first-child {
            border-top-left-radius: 15px;
        }
        
        .restaurant-table th:last-child {
            border-top-right-radius: 15px;
        }
        
        .restaurant-table td {
            padding: 18px 15px;
            border-bottom: 1px solid #ecf0f1;
            vertical-align: top;
        }
        
        .restaurant-table tr:hover {
            background: #f8f9fa;
        }
        
        .restaurant-table tr:last-child td:first-child {
            border-bottom-left-radius: 15px;
        }
        
        .restaurant-table tr:last-child td:last-child {
            border-bottom-right-radius: 15px;
        }
        
        .restaurant-name {
            font-weight: bold;
            color: #e74c3c;
            font-size: 1.1em;
        }
        
        .rating {
            color: #f39c12;
            font-weight: bold;
        }
        
        .price {
            color: #27ae60;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .route-info {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
        }
        
        .route-step {
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        
        .route-step::before {
            content: '→';
            position: absolute;
            left: 0;
            color: #3498db;
            font-weight: bold;
        }
        
        .weather-card {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            border-radius: 20px;
            padding: 30px;
            margin: 30px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            align-items: center;
        }
        
        .weather-main {
            text-align: center;
        }
        
        .weather-icon {
            font-size: 4em;
            margin-bottom: 15px;
            display: block;
        }
        
        .weather-temp {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .weather-desc {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .weather-details {
            display: grid;
            gap: 15px;
        }
        
        .weather-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
        }
        
        .weather-item i {
            width: 20px;
            text-align: center;
        }
        
        .timeline {
            position: relative;
            margin: 30px 0;
        }
        
        .timeline::before {
            content: '';
            position: absolute;
            left: 30px;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(to bottom, #3498db, #2980b9);
            border-radius: 2px;
        }
        
        .timeline-item {
            position: relative;
            margin: 30px 0;
            padding-left: 80px;
        }
        
        .timeline-time {
            position: absolute;
            left: 0;
            top: 0;
            width: 60px;
            height: 60px;
            background: #3498db;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 0.9em;
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.3);
        }
        
        .timeline-content {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
            border: 1px solid #ecf0f1;
        }
        
        .timeline-content h4 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        .timeline-content p {
            color: #7f8c8d;
            line-height: 1.6;
        }
        
        .budget-section {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
        }
        
        .budget-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-top: 20px;
        }
        
        .budget-option {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }
        
        .budget-option:hover {
            border-color: #3498db;
            transform: translateY(-2px);
        }
        
        .budget-option.recommended {
            border-color: #27ae60;
            background: linear-gradient(135deg, #d5f4e6 0%, #ffffff 100%);
        }
        
        .budget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .budget-restaurant {
            font-weight: bold;
            color: #2c3e50;
            font-size: 1.1em;
        }
        
        .budget-total {
            font-size: 1.5em;
            font-weight: bold;
            color: #e74c3c;
        }
        
        .suggestions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 25px;
            margin: 30px 0;
        }
        
        .suggestion-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
            border-left: 4px solid #3498db;
        }
        
        .suggestion-card.weather {
            border-left-color: #f39c12;
        }
        
        .suggestion-card.dining {
            border-left-color: #e74c3c;
        }
        
        .suggestion-card.booking {
            border-left-color: #27ae60;
        }
        
        .suggestion-title {
            font-weight: bold;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #2c3e50;
        }
        
        .suggestion-list {
            list-style: none;
        }
        
        .suggestion-list li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
            color: #555;
            line-height: 1.5;
        }
        
        .suggestion-list li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #27ae60;
            font-weight: bold;
        }
        
        @media (max-width: 768px) {
            .header {
                padding: 40px 20px;
            }
            
            .header h1 {
                font-size: 2.2em;
            }
            
            .overview-cards {
                grid-template-columns: 1fr;
                padding: 20px;
                margin: -20px 20px 0;
            }
            
            .content {
                padding: 40px 20px;
            }
            
            .section-title {
                font-size: 1.8em;
            }
            
            .weather-card {
                grid-template-columns: 1fr;
                text-align: center;
            }
            
            .budget-grid {
                grid-template-columns: 1fr;
            }
            
            .suggestions-grid {
                grid-template-columns: 1fr;
            }
        }
        
        @media print {
            body {
                background: white;
            }
            
            .container {
                box-shadow: none;
            }
            
            .header::before {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-users"></i> ${eventDetails.eventName}</h1>
            <p>精心策划的团建活动方案</p>
        </div>
        
        <div class="overview-cards">
            <div class="overview-card">
                <i class="fas fa-calendar-alt" style="color: #3498db;"></i>
                <h3>活动时间</h3>
                <div class="value">${eventDetails.eventDate}</div>
            </div>
            <div class="overview-card">
                <i class="fas fa-users" style="color: #e74c3c;"></i>
                <h3>参与人数</h3>
                <div class="value">${eventDetails.participantCount}人</div>
            </div>
            <div class="overview-card">
                <i class="fas fa-map-marker-alt" style="color: #27ae60;"></i>
                <h3>出发地点</h3>
                <div class="value">${eventDetails.location.name}</div>
            </div>
            <div class="overview-card">
                <i class="fas fa-user-tie" style="color: #f39c12;"></i>
                <h3>组织者</h3>
                <div class="value">${eventDetails.organizer}</div>
            </div>
        </div>

        <div class="content">
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-utensils"></i>
                    餐厅推荐方案
                </h2>
                
                <div class="restaurant-comparison">
                    <table class="restaurant-table">
                        <thead>
                            <tr>
                                <th>餐厅名称</th>
                                <th>地址</th>
                                <th>人均消费</th>
                                <th>特色菜</th>
                                <th>环境评分</th>
                                <th>交通建议</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${restaurants.map(restaurant => `
                                <tr>
                                    <td class="restaurant-name">${restaurant.name}</td>
                                    <td>${restaurant.address}</td>
                                    <td class="price">¥${restaurant.averagePrice}</td>
                                    <td>${restaurant.specialDishes ? restaurant.specialDishes.join('、') : '暂无信息'}</td>
                                    <td class="rating">${restaurant.rating ? `⭐`.repeat(Math.floor(restaurant.rating)) + '☆'.repeat(5-Math.floor(restaurant.rating)) + ` (${restaurant.rating})` : '暂无评分'}</td>
                                    <td>${restaurant.transportation ? `${restaurant.transportation.walkingTime || '步行可达'}` : '交通便利'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            ${weather ? `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-cloud-sun"></i>
                    天气情况
                </h2>
                
                <div class="weather-card">
                    <div class="weather-main">
                        <i class="fas fa-cloud-rain weather-icon"></i>
                        <div class="weather-temp">${weather.dayTemp}</div>
                        <div class="weather-desc">${weather.dayWeather}</div>
                    </div>
                    <div class="weather-details">
                        <div class="weather-item">
                            <i class="fas fa-thermometer-half"></i>
                            <span>白天：${weather.dayWeather} ${weather.dayTemp}</span>
                        </div>
                        <div class="weather-item">
                            <i class="fas fa-moon"></i>
                            <span>夜晚：${weather.nightWeather} ${weather.nightTemp}</span>
                        </div>
                        <div class="weather-item">
                            <i class="fas fa-wind"></i>
                            <span>风力：${weather.wind}</span>
                        </div>
                        ${weather.advice ? `
                        <div class="weather-item">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>${weather.advice}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}

            ${schedule && schedule.length > 0 ? `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-clock"></i>
                    时间安排
                </h2>
                
                <div class="timeline">
                    ${schedule.map((item, index) => `
                        <div class="timeline-item">
                            <div class="timeline-time">${item.time}</div>
                            <div class="timeline-content">
                                <h4>${item.activity}</h4>
                                ${item.note ? `<p>${item.note}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${budget ? `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-calculator"></i>
                    费用预算
                </h2>
                
                <div class="budget-section">
                    <div class="budget-grid">
                        ${budget.restaurantOptions.map((option, index) => `
                            <div class="budget-option ${index === 0 ? 'recommended' : ''}">
                                <div class="budget-header">
                                    <span class="budget-restaurant">${option.restaurantName}</span>
                                    <span class="budget-total">¥${option.totalCost.toLocaleString()}</span>
                                </div>
                                <p><strong>人均：</strong>¥${option.pricePerPerson}</p>
                                <p><strong>总计：</strong>${budget.totalParticipants}人 × ¥${option.pricePerPerson} = ¥${option.totalCost.toLocaleString()}</p>
                                ${index === 0 ? '<p style="color: #27ae60; font-weight: bold; margin-top: 10px;">💡 推荐方案</p>' : ''}
                            </div>
                        `).join('')}
                    </div>
                    ${budget.recommendations ? `<p style="margin-top: 20px; font-style: italic; color: #666;"><i class="fas fa-lightbulb"></i> ${budget.recommendations}</p>` : ''}
                </div>
            </div>
            ` : ''}

            ${suggestions ? `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-lightbulb"></i>
                    活动建议
                </h2>
                
                <div class="suggestions-grid">
                    ${suggestions.weatherTips && suggestions.weatherTips.length > 0 ? `
                    <div class="suggestion-card weather">
                        <div class="suggestion-title">
                            <i class="fas fa-umbrella"></i>
                            天气应对
                        </div>
                        <ul class="suggestion-list">
                            ${suggestions.weatherTips.map(tip => `<li>${tip}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${suggestions.teamActivities && suggestions.teamActivities.length > 0 ? `
                    <div class="suggestion-card">
                        <div class="suggestion-title">
                            <i class="fas fa-users"></i>
                            团队互动
                        </div>
                        <ul class="suggestion-list">
                            ${suggestions.teamActivities.map(activity => `<li>${activity}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${suggestions.diningTips && suggestions.diningTips.length > 0 ? `
                    <div class="suggestion-card dining">
                        <div class="suggestion-title">
                            <i class="fas fa-utensils"></i>
                            餐饮选择
                        </div>
                        <ul class="suggestion-list">
                            ${suggestions.diningTips.map(tip => `<li>${tip}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${suggestions.bookingAdvice && suggestions.bookingAdvice.length > 0 ? `
                    <div class="suggestion-card booking">
                        <div class="suggestion-title">
                            <i class="fas fa-phone"></i>
                            提前预订
                        </div>
                        <ul class="suggestion-list">
                            ${suggestions.bookingAdvice.map(advice => `<li>${advice}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-address-book"></i>
                    联系方式
                </h2>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin-top: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px;">
                        <div>
                            <h4 style="color: #2c3e50; margin-bottom: 10px;"><i class="fas fa-user-tie"></i> 活动组织者</h4>
                            <p style="font-size: 1.1em;">${eventDetails.organizer}</p>
                            <p style="color: #666;">${eventDetails.contact}</p>
                        </div>
                        <div>
                            <h4 style="color: #2c3e50; margin-bottom: 10px;"><i class="fas fa-map-marker-alt"></i> 出发地点</h4>
                            <p style="font-size: 1.1em;">${eventDetails.location.name}</p>
                            <p style="color: #666;">${eventDetails.location.address}</p>
                        </div>
                        ${restaurants.length > 0 && restaurants[0].phone ? `
                        <div>
                            <h4 style="color: #2c3e50; margin-bottom: 10px;"><i class="fas fa-phone"></i> 餐厅电话</h4>
                            ${restaurants.map(r => r.phone ? `<p>${r.name}: ${r.phone}</p>` : '').join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>

        <div style="background: #2c3e50; color: white; text-align: center; padding: 30px;">
            <p style="font-size: 1.1em;">
                <i class="fas fa-magic"></i> 
                本报告由 MCP 团建规划系统自动生成 | 生成时间：${new Date().toLocaleString('zh-CN')}
            </p>
            <p style="margin-top: 10px; opacity: 0.8;">
                祝您的团队建设活动圆满成功！
            </p>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });
            
            const tableRows = document.querySelectorAll('.restaurant-table tbody tr');
            tableRows.forEach(row => {
                row.addEventListener('click', function() {
                    tableRows.forEach(r => r.style.background = '');
                    this.style.background = '#e3f2fd';
                });
            });
            
            const budgetOptions = document.querySelectorAll('.budget-option');
            budgetOptions.forEach(option => {
                option.addEventListener('click', function() {
                    budgetOptions.forEach(o => o.classList.remove('selected'));
                    this.classList.add('selected');
                });
            });
            
            const style = document.createElement('style');
            style.textContent = \`
                .budget-option.selected {
                    border-color: #3498db !important;
                    background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%) !important;
                    transform: scale(1.02);
                }
            \`;
            document.head.appendChild(style);
        });
    </script>
</body>
</html>`;

                const filePath = path.join(process.cwd(), filename);
                await fs.writeFile(filePath, htmlContent, 'utf8');
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `🎉 HTML团建规划报告生成成功！

📁 文件信息：
- 文件名：${filename}
- 保存位置：${filePath}
- 文件大小：${Math.round(htmlContent.length / 1024)} KB

📋 报告内容包含：
✅ 现代化活动概览卡片
✅ 餐厅对比表格（支持多餐厅）
✅ 实时天气信息展示
✅ 可视化时间安排时间线
✅ 详细费用预算对比
✅ 智能活动建议分类
✅ 完整联系信息汇总

🌟 报告特色：
- 🎨 现代化UI设计，视觉冲击力强
- 📱 完全响应式，支持所有设备
- 🎯 FontAwesome图标，专业美观
- ⚡ 交互式元素，用户体验佳
- 🖨️ 打印友好，一键输出PDF
- 🎭 CSS动画效果，动态展示

💡 使用建议：
1. 在现代浏览器中打开效果最佳
2. 支持直接分享链接或PDF导出
3. 可以嵌入企业内网系统
4. 适合投影展示和手机查看

团建规划完成！请在浏览器中查看您的专业级团建报告。`
                        }
                    ],
                    filePath: filePath,
                    fileName: filename,
                    fileSize: htmlContent.length
                };
                
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ 生成HTML报告时出现错误：${error.message}\n\n请检查文件写入权限或磁盘空间。`
                        }
                    ],
                    error: error.message
                };
            }
        }
    };
} 