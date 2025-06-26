import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001/api';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState([]);
  const [connected, setConnected] = useState(false);

  // 检查后端连接状态
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await axios.get(`${API_BASE}/health`);
        setConnected(response.data.success && response.data.mcpConnected);
      } catch (error) {
        setConnected(false);
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
      const response = await axios.post(`${API_BASE}/chat`, {
        message: messageToSend
      });

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
      // 建立SSE连接
      const eventSource = new EventSource(
        `${API_BASE}/chat-stream?message=${encodeURIComponent(messageToSend)}`
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
  const ToolCallsDisplay = ({ toolCalls }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
      <div className="tool-calls-container">
        <div className="tool-calls-header" onClick={() => setIsExpanded(!isExpanded)}>
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
                    <strong>结果:</strong>
                    <div className="tool-result-content">
                      {typeof toolCall.result === 'object' ? (
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
      <div className="header">
        <h1>🤖 MCP Chat Demo</h1>
        <div className="status">
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 已连接' : '🔴 未连接'}
          </span>
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
                onClick={() => handleExampleClick("计算 15 + 27")}
                disabled={loading || !connected}
              >
                🧮 计算 15 + 27
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("请告诉我经纬度 40.7128, -74.0060 的天气预报")}
                disabled={loading || !connected}
              >
                🌤️ 纽约天气预报
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("加利福尼亚州有什么天气警报吗？")}
                disabled={loading || !connected}
              >
                ⚠️ 加州天气警报
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("125 除以 5 等于多少？")}
                disabled={loading || !connected}
              >
                🔢 除法计算
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("请告诉我经洛杉矶的天气预报")}
                disabled={loading || !connected}
              >
                ☀️ 洛杉矶天气
              </button>
              <button 
                className="example-btn"
                onClick={() => handleExampleClick("纽约州有天气警报吗？")}
                disabled={loading || !connected}
              >
                🌪️ 纽约州警报
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
                             {tool.status === 'error' && '❌ 错误'}
                           </span>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* 工具调用信息展示（完成后） */}
                   {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && !msg.streaming && (
                     <ToolCallsDisplay toolCalls={msg.toolCalls} />
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
              onClick={() => handleExampleClick("计算 15 + 27")}
              disabled={loading || !connected}
            >
              🧮 计算 15 + 27
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("请告诉我经纬度 40.7128, -74.0060 的天气预报")}
              disabled={loading || !connected}
            >
              🌤️ 纽约天气预报
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("加利福尼亚州有什么天气警报吗？")}
              disabled={loading || !connected}
            >
              ⚠️ 加州天气警报
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("125 除以 5 等于多少？")}
              disabled={loading || !connected}
            >
              🔢 除法计算
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("请告诉我经洛杉矶的天气预报")}
              disabled={loading || !connected}
            >
              ☀️ 洛杉矶天气
            </button>
            <button 
              className="example-btn-bottom"
              onClick={() => handleExampleClick("纽约州有天气警报吗？")}
              disabled={loading || !connected}
            >
              🌪️ 纽约州警报
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
