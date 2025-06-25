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

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || input;
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
                   {/* 工具调用信息展示 */}
                   {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                     <ToolCallsDisplay toolCalls={msg.toolCalls} />
                   )}
                   
                   <div className="content">
                     {msg.role === 'assistant' ? (
                       <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                     ) : (
                       <span className="plain-text">{msg.content}</span>
                     )}
                   </div>
                 </div>
               </div>
             </div>
           </div>
         ))}
        
        {loading && (
          <div className="message assistant">
            <div className="message-inner">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="message-header">助手</div>
                <div className="message-bubble">
                  <div className="loading">正在思考中...</div>
                </div>
              </div>
            </div>
          </div>
        )}
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
              onClick={sendMessage} 
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
