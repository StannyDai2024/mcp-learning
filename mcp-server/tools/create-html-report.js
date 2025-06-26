import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

export default function createHtmlReport() {
    return {
        name: "create_html_report",
        description: "生成精美的HTML格式团建规划报告",
        schema: {
            selectedPlan: z.object({
                id: z.string(),
                title: z.string(),
                strategy: z.string(),
                restaurant: z.object({
                    name: z.string(),
                    address: z.string(),
                    phone: z.string(),
                    rating: z.number(),
                    averagePrice: z.number(),
                    specialDishes: z.array(z.string()),
                    features: z.array(z.string())
                }),
                timeline: z.array(z.string()),
                costs: z.object({
                    perPerson: z.number(),
                    total: z.number(),
                    breakdown: z.array(z.object({
                        item: z.string(),
                        amount: z.number()
                    }))
                }),
                highlights: z.array(z.string()),
                pros: z.array(z.string()),
                cons: z.array(z.string())
            }).describe("用户选定的团建方案"),
            
            eventDetails: z.object({
                eventName: z.string().optional().default("团队建设聚餐活动"),
                eventDate: z.string().optional().default("待定"),
                organizer: z.string().optional().default("团队负责人"),
                contact: z.string().optional().default("待补充")
            }).describe("活动基本信息"),
            
            location: z.object({
                address: z.string(),
                city: z.string(),
                district: z.string()
            }).describe("出发地点信息")
        },
        handler: async ({ selectedPlan, eventDetails, location }) => {
            try {
                // 生成当前时间戳作为文件名
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                const filename = `团建规划报告_${timestamp}.html`;
                
                // 计算总费用
                const totalCost = selectedPlan.costs.breakdown.reduce((sum, item) => sum + item.amount, 0);
                
                // HTML模板
                const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eventDetails.eventName} - 团建规划报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 40px;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
        }
        
        .section-title {
            font-size: 1.8em;
            margin-bottom: 20px;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .plan-overview {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
        }
        
        .plan-overview h2 {
            color: white;
        }
        
        .restaurant-info {
            background: #f8f9fa;
            border-left: 5px solid #00b894;
        }
        
        .timeline {
            background: #fff3cd;
            border-left: 5px solid #ffc107;
        }
        
        .costs {
            background: #d1ecf1;
            border-left: 5px solid #17a2b8;
        }
        
        .notes {
            background: #f8d7da;
            border-left: 5px solid #dc3545;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .info-card {
            background: rgba(255,255,255,0.2);
            padding: 20px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        
        .info-card h3 {
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        .restaurant-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 20px;
        }
        
        .detail-item {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            font-size: 1.1em;
        }
        
        .icon {
            font-size: 1.2em;
            width: 25px;
        }
        
        .timeline-list {
            list-style: none;
            position: relative;
        }
        
        .timeline-list li {
            padding: 15px 0 15px 40px;
            position: relative;
            border-left: 2px solid #ffc107;
        }
        
        .timeline-list li:before {
            content: '';
            position: absolute;
            left: -6px;
            top: 20px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ffc107;
        }
        
        .cost-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .cost-table th,
        .cost-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .cost-table th {
            background: #17a2b8;
            color: white;
            font-weight: 600;
        }
        
        .cost-table .total {
            background: #e9ecef;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .highlight-list {
            list-style: none;
            margin-top: 15px;
        }
        
        .highlight-list li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        
        .highlight-list.pros li:before {
            content: '✅';
            position: absolute;
            left: 0;
        }
        
        .highlight-list.cons li:before {
            content: '⚠️';
            position: absolute;
            left: 0;
        }
        
        .highlight-list.features li:before {
            content: '🎯';
            position: absolute;
            left: 0;
        }
        
        .contact-info {
            background: #e8f5e8;
            border-left: 5px solid #28a745;
            padding: 20px;
            border-radius: 10px;
            margin-top: 30px;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            background: #f8f9fa;
            color: #6c757d;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            .restaurant-details {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .content {
                padding: 20px;
            }
            
            .section {
                padding: 20px;
            }
        }
        
        .print-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 50px;
            padding: 15px 25px;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,123,255,0.3);
            transition: all 0.3s ease;
        }
        
        .print-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,123,255,0.4);
        }
        
        @media print {
            .print-btn {
                display: none;
            }
            
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 ${eventDetails.eventName}</h1>
            <p>精心策划的团建活动方案</p>
        </div>
        
        <div class="content">
            <!-- 方案概览 -->
            <div class="section plan-overview">
                <h2 class="section-title">📋 ${selectedPlan.title}</h2>
                <p style="font-size: 1.2em; margin-bottom: 20px;">${selectedPlan.strategy}</p>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h3>活动日期</h3>
                        <p>${eventDetails.eventDate}</p>
                    </div>
                    <div class="info-card">
                        <h3>参与人数</h3>
                        <p>${selectedPlan.costs.total / selectedPlan.costs.perPerson}人</p>
                    </div>
                    <div class="info-card">
                        <h3>预算总计</h3>
                        <p>¥${totalCost.toLocaleString()}</p>
                    </div>
                    <div class="info-card">
                        <h3>人均费用</h3>
                        <p>¥${Math.round(totalCost / (selectedPlan.costs.total / selectedPlan.costs.perPerson))}</p>
                    </div>
                </div>
            </div>
            
            <!-- 餐厅信息 -->
            <div class="section restaurant-info">
                <h2 class="section-title">🍽️ 目标餐厅</h2>
                <h3 style="font-size: 1.5em; color: #00b894; margin-bottom: 20px;">${selectedPlan.restaurant.name}</h3>
                
                <div class="restaurant-details">
                    <div>
                        <div class="detail-item">
                            <span class="icon">📍</span>
                            <span>${selectedPlan.restaurant.address}</span>
                        </div>
                        <div class="detail-item">
                            <span class="icon">📞</span>
                            <span>${selectedPlan.restaurant.phone}</span>
                        </div>
                        <div class="detail-item">
                            <span class="icon">⭐</span>
                            <span>${selectedPlan.restaurant.rating}/5.0 分</span>
                        </div>
                        <div class="detail-item">
                            <span class="icon">💰</span>
                            <span>人均 ¥${selectedPlan.restaurant.averagePrice}</span>
                        </div>
                    </div>
                    <div>
                        <h4>🎯 活动亮点</h4>
                        <ul class="highlight-list features">
                            ${selectedPlan.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                <div style="margin-top: 25px;">
                    <h4>🍜 招牌菜品</h4>
                    <p style="margin-top: 10px; font-size: 1.1em; color: #555;">
                        ${selectedPlan.restaurant.specialDishes.join('、')}
                    </p>
                </div>
            </div>
            
            <!-- 时间安排 -->
            <div class="section timeline">
                <h2 class="section-title">⏰ 活动时间安排</h2>
                <ul class="timeline-list">
                    ${selectedPlan.timeline.map(time => `<li>${time}</li>`).join('')}
                </ul>
            </div>
            
            <!-- 费用明细 -->
            <div class="section costs">
                <h2 class="section-title">💰 费用预算明细</h2>
                <table class="cost-table">
                    <thead>
                        <tr>
                            <th>项目</th>
                            <th>金额</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedPlan.costs.breakdown.map(item => `
                            <tr>
                                <td>${item.item}</td>
                                <td>¥${item.amount.toLocaleString()}</td>
                                <td>${item.item === '餐费' ? `人均¥${selectedPlan.costs.perPerson}` : '预估费用'}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td>总计</td>
                            <td>¥${totalCost.toLocaleString()}</td>
                            <td>所有费用合计</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <!-- 注意事项 -->
            <div class="section notes">
                <h2 class="section-title">📝 注意事项</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px;">
                    <div>
                        <h4 style="color: #28a745; margin-bottom: 15px;">✅ 方案优势</h4>
                        <ul class="highlight-list pros">
                            ${selectedPlan.pros.map(pro => `<li>${pro}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <h4 style="color: #dc3545; margin-bottom: 15px;">⚠️ 注意事项</h4>
                        <ul class="highlight-list cons">
                            ${selectedPlan.cons.map(con => `<li>${con}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- 联系信息 -->
            <div class="contact-info">
                <h3 style="margin-bottom: 15px;">📱 联系信息</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <strong>活动组织者：</strong><br>
                        ${eventDetails.organizer}
                    </div>
                    <div>
                        <strong>联系方式：</strong><br>
                        ${eventDetails.contact}
                    </div>
                    <div>
                        <strong>出发地点：</strong><br>
                        ${location.address}
                    </div>
                    <div>
                        <strong>餐厅电话：</strong><br>
                        ${selectedPlan.restaurant.phone}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>本报告由 MCP 团建规划系统自动生成 | 生成时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
    
    <button class="print-btn" onclick="window.print()">🖨️ 打印报告</button>
    
    <script>
        // 添加一些交互效果
        document.addEventListener('DOMContentLoaded', function() {
            // 平滑滚动
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    document.querySelector(this.getAttribute('href')).scrollIntoView({
                        behavior: 'smooth'
                    });
                });
            });
            
            // 点击费用表行高亮
            document.querySelectorAll('.cost-table tr').forEach(row => {
                row.addEventListener('click', function() {
                    document.querySelectorAll('.cost-table tr').forEach(r => r.style.background = '');
                    this.style.background = '#f0f8ff';
                });
            });
        });
    </script>
</body>
</html>`;

                // 保存HTML文件
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
✅ 活动概览和基本信息
✅ 餐厅详细信息和特色
✅ 完整的时间安排表
✅ 详细的费用预算明细
✅ 方案优势和注意事项
✅ 完整的联系信息

🌐 使用方式：
1. 在浏览器中打开 ${filename}
2. 可以直接打印或保存为PDF
3. 支持手机和电脑查看
4. 可以分享给团队成员

💡 报告特色：
- 现代化设计，视觉效果佳
- 响应式布局，适配各种设备
- 包含打印友好样式
- 交互式元素，提升用户体验

团建规划完成！请在浏览器中查看您的专属团建报告。`
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