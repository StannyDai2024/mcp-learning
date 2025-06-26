import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001/api';

// 生成唯一sessionId
const generateSessionId = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState([]);
  const [connected, setConnected] = useState(false);
  const [mcpStatus, setMcpStatus] = useState(null); // 🔥 新增：MCP状态详情
  
  // 🔥 新增：多轮对话控制
  const [multiChatEnabled, setMultiChatEnabled] = useState(false); // 默认关闭
  const [sessionId, setSessionId] = useState(null);
  
  // 🔥 新增：工具调用展开状态管理（避免health检查重置展开状态）
  const [toolCallsExpandedState, setToolCallsExpandedState] = useState({});

  // 🔥 新增：管理sessionId
  useEffect(() => {
    if (multiChatEnabled && !sessionId) {
      // 启用多轮对话时生成新的sessionId
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      console.log('🆔 新建会话:', newSessionId);
    } else if (!multiChatEnabled && sessionId) {
      // 关闭多轮对话时清除sessionId
      setSessionId(null);
      console.log('🧹 清除会话');
    }
  }, [multiChatEnabled, sessionId]);

  // 🔥 新增：切换多轮对话模式
  const toggleMultiChat = () => {
    const newEnabled = !multiChatEnabled;
    setMultiChatEnabled(newEnabled);
    
          if (newEnabled) {
        // 开启多轮对话时，可选择是否清空聊天记录开始新会话
        if (messages.length > 0) {
          const shouldClear = window.confirm('开启多轮对话模式建议清空当前聊天记录，开始新的会话。是否清空？');
          if (shouldClear) {
            setMessages([]);
            setToolCallsExpandedState({}); // 🔥 清空工具调用展开状态
          }
        }
      }
  };

  // 🔥 新增：重置会话
  const resetSession = () => {
    if (window.confirm('确认要重置当前会话吗？这将清空所有聊天记录。')) {
      setMessages([]);
      setToolCallsExpandedState({}); // 🔥 清空工具调用展开状态
      if (multiChatEnabled) {
        const newSessionId = generateSessionId();
        setSessionId(newSessionId);
        console.log('🔄 重置会话:', newSessionId);
      }
    }
  };

  // 检查后端连接状态
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await axios.get(`${API_BASE}/health`);
        // 🔥 更新：适配多MCP架构的连接检查
        const mcpStatusData = response.data.mcp;
        const hasConnection = mcpStatusData && (
          (mcpStatusData.amap && mcpStatusData.amap.connected) || 
          (mcpStatusData.custom && mcpStatusData.custom.connected)
        );
        const newConnected = response.data.success && hasConnection;
        
        // 🔥 优化：只在状态真正变化时才更新，避免不必要的重新渲染
        setConnected(prevConnected => {
          if (prevConnected !== newConnected) {
            console.log('🔍 连接状态变化:', prevConnected, '->', newConnected);
            return newConnected;
          }
          return prevConnected;
        });
        
        setMcpStatus(prevStatus => {
          // 深度比较MCP状态，只在实际变化时更新
          const hasChanged = !prevStatus || 
            JSON.stringify(prevStatus) !== JSON.stringify(mcpStatusData);
          
          if (hasChanged) {
            console.log('🔍 MCP状态更新:', mcpStatusData);
            return mcpStatusData;
          }
          return prevStatus;
        });
        
      } catch (error) {
        console.error('连接检查失败:', error);
        setConnected(prevConnected => {
          if (prevConnected !== false) {
            console.log('🔍 连接状态变化: 连接失败');
            return false;
          }
          return prevConnected;
        });
        setMcpStatus(prevStatus => {
          if (prevStatus !== null) {
            return null;
          }
          return prevStatus;
        });
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000); // 每5秒检查一次
    return () => clearInterval(interval);
  }, []);

  // 获取可用工具
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await axios.get(`${API_BASE}/tools`);
        if (response.data.success) {
          setTools(response.data.tools);
        }
      } catch (error) {
        console.error('Failed to fetch tools:', error);
      }
    };

    if (connected) {
      fetchTools();
    }
  }, [connected]);

  // 原始的非流式发送方法（保留作为备用）
  const sendMessageOld = async (messageText = null) => {
    const messageToSend = String(messageText || input || '');
    // 检查消息是否为空或正在加载
    if (!messageToSend.trim() || loading) return;

    const userMessage = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // 🔥 修改：包含多轮对话信息
      const requestBody = {
        message: messageToSend,
        multiChatEnabled,
        sessionId: multiChatEnabled ? sessionId : undefined
      };

      const response = await axios.post(`${API_BASE}/chat`, requestBody);

      if (response.data.success) {
        const botMessage = { 
          role: 'assistant', 
          content: response.data.response,
          toolCalls: response.data.toolCalls || []
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error(response.data.error || '请求失败');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { 
        role: 'error', 
        content: error.response?.data?.error || error.message || '请求失败，请检查后端服务是否正常运行' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // 新的流式发送方法
  const sendMessage = async (messageText = null) => {
    const messageToSend = String(messageText || input || '');
    // 检查消息是否为空或正在加载
    if (!messageToSend.trim() || loading) return;

    const userMessage = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // 添加初始的助手消息框
    const initialBotMessage = { 
      role: 'assistant', 
      content: '',
      toolCalls: [],
      phase: 'thinking',
      streaming: true
    };
    setMessages(prev => [...prev, initialBotMessage]);

    try {
      // 🔥 修改：构建包含多轮对话信息的URL参数
      const params = new URLSearchParams({
        message: messageToSend
      });
      
      if (multiChatEnabled && sessionId) {
        params.append('multiChatEnabled', 'true');
        params.append('sessionId', sessionId);
      }

      // 建立SSE连接
      const eventSource = new EventSource(
        `${API_BASE}/chat-stream?${params.toString()}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleStreamUpdate(data, eventSource);
        } catch (error) {
          console.error('Error parsing stream data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        
        // 只有在真正的错误情况下才显示错误消息
        // 正常的连接关闭不应该显示错误
        if (eventSource.readyState === EventSource.CLOSED && !loading) {
          // 连接已正常关闭，不显示错误
          return;
        }
        
        if (eventSource.readyState === EventSource.CONNECTING) {
          // 正在重连，不显示错误
          return;
        }
        
        eventSource.close();
        setLoading(false);
        
        // 只在异常情况下添加错误消息
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg?.streaming) {
            // 更新最后一条流式消息为错误状态
            return prev.map((msg, index) => 
              index === prev.length - 1 
                ? { ...msg, streaming: false, phase: 'error', error: '连接异常，请重试' }
                : msg
            );
          } else {
            // 添加新的错误消息
            return [...prev, { 
              role: 'error', 
              content: '连接异常，请重试' 
            }];
          }
        });
      };

    } catch (error) {
      console.error('Stream setup error:', error);
      setLoading(false);
      
      const errorMessage = { 
        role: 'error', 
        content: error.message || '流式连接失败，请检查网络' 
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // 处理流式更新
  const handleStreamUpdate = (data, eventSource) => {
    const { type, data: payload, phase } = data;

    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessageIndex = newMessages.length - 1;
      const lastMessage = newMessages[lastMessageIndex];

      // 确保最后一条消息是助手消息
      if (lastMessage?.role !== 'assistant') {
        return newMessages;
      }

      const updatedMessage = { ...lastMessage };

      switch (type) {
        case 'content':
          // 更新思考过程的内容
          updatedMessage.content = payload;
          updatedMessage.phase = phase;
          break;

        case 'thinking_complete':
          // 思考阶段完成
          updatedMessage.content = payload.content;
          updatedMessage.phase = 'tool_execution';
          updatedMessage.pendingTools = payload.toolCalls;
          break;

        case 'tool_start':
          // 工具调用开始
          updatedMessage.phase = 'tool_execution';
          updatedMessage.toolCalls = payload.tools.map(tool => ({
            name: tool.name,
            arguments: tool.arguments,
            status: 'pending'
          }));
          break;

        case 'tool_progress':
          // 工具执行进度更新
          if (updatedMessage.toolCalls) {
            updatedMessage.toolCalls = updatedMessage.toolCalls.map((tool, index) => {
              if (index === payload.index) {
                return {
                  ...tool,
                  status: payload.status,
                  result: payload.result,
                  executionTime: payload.executionTime,
                  error: payload.error
                };
              }
              return tool;
            });
          }
          break;

        case 'final_thinking_start':
          // 开始最终回答
          updatedMessage.phase = 'final_response';
          updatedMessage.finalContent = '';
          break;

        case 'final_content':
          // 最终回答内容流
          updatedMessage.finalContent = payload;
          updatedMessage.phase = 'final_response';
          break;

        case 'complete':
          // 完成 - 简化逻辑
          // 优先使用finalContent，如果没有则使用content
          if (payload.finalContent) {
            updatedMessage.finalContent = payload.finalContent;
          } else if (payload.content) {
            updatedMessage.content = payload.content;
          }
          
          updatedMessage.toolCalls = payload.toolCalls || [];
          updatedMessage.phase = 'complete';
          updatedMessage.streaming = false;
          
          // 调试信息
          console.log('✅ Complete:', {
            finalContent: payload.finalContent,
            content: payload.content,
            toolCalls: payload.toolCalls?.length || 0
          });
          
          // 关闭SSE连接并取消loading状态
          eventSource?.close();
          setLoading(false);
          break;

        case 'error':
          // 错误处理
          updatedMessage.phase = 'error';
          updatedMessage.error = payload.error;
          updatedMessage.streaming = false;
          
          // 关闭SSE连接并取消loading状态
          eventSource?.close();
          setLoading(false);
          break;
      }

      newMessages[lastMessageIndex] = updatedMessage;
      return newMessages;
    });
  };

  // 处理示例问题点击
  const handleExampleClick = (exampleText) => {
    if (loading || !connected) return;
    sendMessage(exampleText);
  };

  // 工具调用展示组件
  const ToolCallsDisplay = ({ toolCalls, messageIndex }) => {
    const isExpanded = toolCallsExpandedState[messageIndex] || false;
    
    const toggleExpanded = () => {
      setToolCallsExpandedState(prev => ({
        ...prev,
        [messageIndex]: !isExpanded
      }));
    };
    
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
      <div className="tool-calls-container">
        <div className="tool-calls-header" onClick={toggleExpanded}>
          <span className="tool-calls-icon">🔧</span>
          <span className="tool-calls-title">AI 使用了以下工具</span>
          <span className={`tool-calls-toggle ${isExpanded ? 'expanded' : ''}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        {isExpanded && (
          <div className="tool-calls-list">
            {toolCalls.map((toolCall, index) => (
              <div key={index} className="tool-call-item">
                <div className="tool-call-header">
                  <span className="tool-name">{toolCall.name}</span>
                  <span className="tool-time">{toolCall.executionTime}ms</span>
                </div>
                <div className="tool-call-details">
                  <div className="tool-arguments">
                    <strong>参数:</strong>
                    <pre className="tool-args-code">
                      {JSON.stringify(toolCall.arguments, null, 2)}
                    </pre>
                  </div>
                  <div className="tool-result">
                    <strong>{toolCall.success === false ? '错误:' : '结果:'}</strong>
                    <div className="tool-result-content">
                      {toolCall.success === false ? (
                        <div className="tool-error">
                          <span className="error-message">❌ {toolCall.error || '工具执行失败'}</span>
                        </div>
                      ) : typeof toolCall.result === 'object' ? (
                        <pre className="tool-result-code">
                          {JSON.stringify(toolCall.result, null, 2)}
                        </pre>
                      ) : (
                        <span className="tool-result-text">{String(toolCall.result)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Markdown 渲染组件
  const MarkdownRenderer = ({ children }) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // 自定义表格样式
          table: ({ children }) => (
            <div className="markdown-table-wrapper">
              <table className="markdown-table">{children}</table>
            </div>
          ),
          // 自定义链接样式
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
              {children}
            </a>
          ),
          // 自定义引用块样式
          blockquote: ({ children }) => (
            <blockquote className="markdown-blockquote">{children}</blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    );
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      {/* 🔥 多轮对话控制面板 - 固定在右上角 */}
      <div className="multi-chat-controls-fixed">
        <div className="multi-chat-toggle">
          <label className="toggle-label">
            <span className="toggle-text">
              {multiChatEnabled ? '💬 多轮对话' : '🔄 单轮对话'}
            </span>
            <input
              type="checkbox"
              checked={multiChatEnabled}
              onChange={toggleMultiChat}
              className="toggle-checkbox"
            />
            <span className="toggle-slider"></span>
          </label>
          {multiChatEnabled && (
            <div className="session-info">
              <span className="session-id">会话: {sessionId?.slice(-8)}</span>
              <button 
                className="reset-session-btn"
                onClick={resetSession}
                title="重置会话"
              >
                🔄
              </button>
            </div>
          )}
        </div>
        <div className="token-warning">
          {multiChatEnabled ? (
            <span className="warning-text">⚠️ 多轮模式消耗更多Token</span>
          ) : (
            <span className="save-text">💰 单轮模式节省Token</span>
          )}
        </div>
      </div>

      <div className="header">
        <h1>🤖 MCP Chat Demo</h1>
        
        <div className="header-center">
          <div className="status">
            <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '🟢 已连接' : '🔴 未连接'}
            </span>
            {/* 🔥 新增：详细MCP状态显示 */}
            {mcpStatus && (
              <div className="mcp-status-details">
                {mcpStatus.amap && (
                  <span className={`mcp-item ${mcpStatus.amap.connected ? 'connected' : 'disconnected'}`}>
                    🗺️ 高德({mcpStatus.amap.toolCount})
                  </span>
                )}
                {mcpStatus.custom && (
                  <span className={`mcp-item ${mcpStatus.custom.connected ? 'connected' : 'disconnected'}`}>
                    🔧 自定义({mcpStatus.custom.toolCount})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {tools.length > 0 && (
          <div className="tools">
            📦 可用工具: {tools.map(t => t.function.name).join(', ')}
            <span className="stream-mode-badge">⚡ 流式模式</span>
          </div>
        )}
      </div>

      <div className="chat-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <p>👋 欢迎使用 MCP Chat！</p>
            <p>你可以点击下面的示例问题快速体验：</p>
            <div className="example-questions">
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("帮我规划一个团建活动，我们有8个人想在北京朝阳区吃川菜")}
                disabled={loading || !connected}
              >
                🍽️ 团建活动规划
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("搜索北京国贸附近的餐厅")}
                disabled={loading || !connected}
              >
                🔍 搜索附近餐厅
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("查询上海的天气情况")}
                disabled={loading || !connected}
              >
                🌤️ 天气查询
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("从北京西站到天安门怎么走？")}
                disabled={loading || !connected}
              >
                🚶 路线导航
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("将地址'北京市朝阳区国贸'转换为经纬度坐标")}
                disabled={loading || !connected}
              >
                📍 地址转坐标
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("搜索广州塔周边2公里内的景点")}
                disabled={loading || !connected}
              >
                🗺️ 周边搜索
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("我们公司在深圳南山区，想组织15人的聚餐，预算每人150元")}
                disabled={loading || !connected}
              >
                👥 公司聚餐规划
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("计算 15 + 27")}
                disabled={loading || !connected}
              >
                🧮 简单计算
              </button>
            </div>
            <p className="tip">💡 或者在下方输入框中输入你的问题</p>
          </div>
        )}
        
                 {messages.map((msg, index) => (
           <div key={index} className={`message ${msg.role}`}>
             <div className="message-inner">
               <div className="message-avatar">
                 {msg.role === 'user' ? '👤' : 
                  msg.role === 'assistant' ? '🤖' : '❌'}
               </div>
               
               <div className="message-content">
                 <div className="message-header">
                   {msg.role === 'user' ? '你' : 
                    msg.role === 'assistant' ? '助手' : '错误'}
                 </div>
                 
                 <div className="message-bubble">
                   {/* 工具调用实时进度（流式时） */}
                   {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && msg.streaming && (
                     <div className="tool-progress">
                       <div className="tool-progress-header">🔧 AI 正在执行以下工具</div>
                       {msg.toolCalls.map((tool, index) => (
                         <div key={index} className={`tool-item ${tool.status}`}>
                           <span className="tool-name">{tool.name}</span>
                           <span className={`tool-status ${tool.status}`}>
                             {tool.status === 'pending' && '⏳ 等待中'}
                             {tool.status === 'executing' && '⚡ 执行中'}
                             {tool.status === 'completed' && `✅ 完成 (${tool.executionTime}ms)`}
                             {tool.status === 'error' && `❌ 失败 (${tool.executionTime}ms)`}
                           </span>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* 工具调用信息展示（完成后） */}
                   {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && !msg.streaming && (
                     <ToolCallsDisplay toolCalls={msg.toolCalls} messageIndex={index} />
                   )}
                   
                                      <div className="content">
                     {msg.role === 'assistant' ? (
                       <div>
                         {/* 简化逻辑：优先显示finalContent，否则显示content */}
                         <MarkdownRenderer>
                           {msg.finalContent || msg.content || ''}
                         </MarkdownRenderer>
                         
                         {/* 流式光标 */}
                         {msg.streaming && (
                           <span className="stream-cursor">▊</span>
                         )}
                       </div>
                     ) : (
                       <span className="plain-text">{msg.content}</span>
                     )}
                   </div>
                 </div>
               </div>
             </div>
           </div>
         ))}
      </div>

      <div className="bottom-section">
        {messages.length > 0 && (
          <div className="example-questions-bottom">
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("帮我规划一个团建活动，我们有8个人想在北京朝阳区吃川菜")}
              disabled={loading || !connected}
            >
              🍽️ 团建活动规划
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("搜索北京国贸附近的餐厅")}
              disabled={loading || !connected}
            >
              🔍 搜索附近餐厅
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("查询上海的天气情况")}
              disabled={loading || !connected}
            >
              🌤️ 天气查询
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("从北京西站到天安门怎么走？")}
              disabled={loading || !connected}
            >
              🚶 路线导航
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("将地址'北京市朝阳区国贸'转换为经纬度坐标")}
              disabled={loading || !connected}
            >
              📍 地址转坐标
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("搜索广州塔周边2公里内的景点")}
              disabled={loading || !connected}
            >
              🗺️ 周边搜索
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("我们公司在深圳南山区，想组织15人的聚餐，预算每人150元")}
              disabled={loading || !connected}
            >
              👥 公司聚餐规划
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("计算 15 + 27")}
              disabled={loading || !connected}
            >
              🧮 简单计算
            </button>
          </div>
        )}
        
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={connected ? "输入你的问题... (Enter发送, Shift+Enter换行)" : "等待后端连接..."}
              disabled={loading || !connected}
              rows="2"
            />
            <button 
              onClick={() => sendMessage()} 
              disabled={loading || !connected || !input.trim()}
            >
              {loading ? '⏳' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
