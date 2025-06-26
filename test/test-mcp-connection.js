import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from 'dotenv';

dotenv.config();

async function testMCPConnections() {
    console.log('🧪 测试MCP连接...\n');
    
    // 测试高德MCP服务器
    console.log('1️⃣ 测试高德官方MCP服务器连接...');
    const apiKey = process.env.AMAP_MAPS_API_KEY;
    
    if (!apiKey || apiKey === '请在https://lbs.amap.com申请API_Key并替换此处') {
        console.log('⚠️ 高德API Key未配置');
        console.log('请按照 AMAP_SETUP.md 文档申请并配置API Key');
    } else {
        try {
            const amapClient = new Client({ 
                name: "test-amap-client", 
                version: "1.0.0" 
            });

            const transport = new StdioClientTransport({
                command: 'npx',
                args: ['-y', '@amap/amap-maps-mcp-server'],
                env: {
                    ...process.env,
                    AMAP_MAPS_API_KEY: apiKey
                }
            });

            await amapClient.connect(transport);
            console.log('✅ 高德MCP连接成功');
            
            // 获取工具列表
            const tools = await amapClient.listTools();
            console.log(`📊 高德MCP工具数量: ${tools.tools.length}`);
            console.log('🔧 可用工具:');
            tools.tools.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            // 测试一个简单的工具调用
            try {
                console.log('\n🧪 测试天气查询...');
                const weatherResult = await amapClient.callTool({
                    name: 'weather_query',
                    arguments: {
                        city: '北京'
                    }
                });
                console.log('✅ 天气查询成功!');
                console.log(JSON.stringify(weatherResult, null, 2));
            } catch (error) {
                console.log('❌ 天气查询失败:', error.message);
            }
            
        } catch (error) {
            console.error('❌ 高德MCP连接失败:', error.message);
        }
    }
    
    console.log('\n2️⃣ 测试自定义MCP服务器连接...');
    try {
        const customClient = new Client({ 
            name: "test-custom-client", 
            version: "1.0.0" 
        });

        const transport = new StdioClientTransport({
            command: process.execPath,
            args: ['./mcp-server/index.js']
        });

        await customClient.connect(transport);
        console.log('✅ 自定义MCP连接成功');
        
        // 获取工具列表
        const tools = await customClient.listTools();
        console.log(`📊 自定义MCP工具数量: ${tools.tools.length}`);
        console.log('🔧 可用工具:');
        tools.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
        });
        
    } catch (error) {
        console.error('❌ 自定义MCP连接失败:', error.message);
    }
    
    console.log('\n🎉 MCP连接测试完成！');
}

// 运行测试
testMCPConnections().catch(console.error); 