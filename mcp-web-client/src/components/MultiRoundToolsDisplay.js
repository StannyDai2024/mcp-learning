import React, { memo, useState, useMemo } from 'react';

// 🔥 修复：工具状态判断辅助函数
const getToolStatus = (tool) => {
  // 优先检查明确的状态字段
  if (tool.status) {
    return tool.status;
  }
  
  // 检查是否有错误
  if (tool.error) {
    return 'error';
  }
  
  // 检查是否有结果
  if (tool.result !== undefined && tool.result !== null) {
    return 'completed';
  }
  
  // 检查旧版本的success字段
  if (tool.success === false) {
    return 'error';
  } else if (tool.success === true) {
    return 'completed';
  }
  
  // 检查executionTime，如果有说明已执行完成
  if (tool.executionTime) {
    return 'completed';
  }
  
  return 'unknown';
};

const getToolStatusText = (tool) => {
  const status = getToolStatus(tool);
  
  switch (status) {
    case 'pending':
      return '⏳ 等待';
    case 'executing':
      return '⚡ 执行中';
    case 'completed':
      return '✅ 完成';
    case 'error':
      return '❌ 失败';
    default:
      return '🔍 未知';
  }
};

// 🔥 多轮工具调用展示组件 - 优化多轮场景的用户体验
const MultiRoundToolsDisplay = memo(({ 
  toolCalls, 
  messageIndex, 
  isExpanded, 
  onToggleExpanded,
  totalRounds = 1,
  isStreaming = false 
}) => {
  // 🔥 简化：移除轮次导航相关的状态和计算
  // 计算整体统计
  const overallStats = useMemo(() => {
    if (!toolCalls || toolCalls.length === 0) {
      return { total: 0, completed: 0, executing: 0, error: 0, pending: 0 };
    }
    
    const stats = {
      total: toolCalls.length,
      completed: 0,
      executing: 0,
      error: 0,
      pending: 0
    };
    
    toolCalls.forEach(tool => {
      const status = getToolStatus(tool);
      stats[status] = (stats[status] || 0) + 1;
    });
    
    return stats;
  }, [toolCalls]);

  // Early return after all hooks
  if (!toolCalls || toolCalls.length === 0) return null;

  // 🔥 简化：生成标题
  const getMainTitle = () => {
    if (totalRounds === 1) {
      return `AI 使用了 ${overallStats.total} 个工具`;
    }
    
    if (isStreaming) {
      return `多轮工具调用 (共 ${overallStats.total} 个工具)`;
    } else {
      return `多轮工具调用完成 (共 ${overallStats.total} 个工具)`;
    }
  };

  return (
    <div className="multi-round-tools-container">
      {/* 主头部 */}
      <div className="multi-round-header" onClick={onToggleExpanded}>
        <span className="multi-round-icon">🔧</span>
        <span className="multi-round-title">{getMainTitle()}</span>
        
        {/* 整体状态统计 */}
        <div className="overall-stats">
          {overallStats.executing > 0 && (
            <span className="stat-badge executing">⚡ {overallStats.executing}</span>
          )}
          {overallStats.completed > 0 && (
            <span className="stat-badge completed">✅ {overallStats.completed}</span>
          )}
          {overallStats.error > 0 && (
            <span className="stat-badge error">❌ {overallStats.error}</span>
          )}
        </div>
        
        <span className={`multi-round-toggle ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div className="multi-round-content">
          {/* 🔥 简化：直接纵向展示所有工具 */}
          <div className="all-tools-display">
            {toolCalls.map((tool, index) => (
              <ToolCallCard key={`${tool.name}-${index}-${tool.status}`} tool={tool} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// 🔥 移除SingleRoundDisplay组件，直接使用ToolCallCard

// 🔥 工具调用卡片组件
const ToolCallCard = memo(({ tool, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`tool-call-card ${getToolStatus(tool)}`}>
      <div className="tool-card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-header-left">
          <span className="tool-name">{tool.name}</span>
          <span className={`tool-status-badge ${getToolStatus(tool)}`}>
            {getToolStatusText(tool)}
          </span>
        </div>
        <div className="tool-header-right">
          {tool.executionTime && (
            <span className="tool-execution-time">{tool.executionTime}ms</span>
          )}
          <span className={`tool-expand-btn ${isExpanded ? 'expanded' : ''}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="tool-card-content">
          <div className="tool-arguments-section">
            <h4 className="section-title">📝 调用参数</h4>
            <pre className="tool-args-display">
              {JSON.stringify(tool.arguments, null, 2)}
            </pre>
          </div>
          
          <div className="tool-result-section">
            <h4 className="section-title">
              {getToolStatus(tool) === 'error' ? '❌ 错误信息' : 
               getToolStatus(tool) === 'completed' ? '✅ 执行结果' : 
               '📄 结果'}
            </h4>
            <div className="tool-result-display">
              {getToolStatus(tool) === 'error' ? (
                <div className="error-display">
                  <span className="error-text">{tool.error || '工具执行失败'}</span>
                </div>
              ) : typeof tool.result === 'object' ? (
                <pre className="result-json">
                  {JSON.stringify(tool.result, null, 2)}
                </pre>
              ) : (
                <span className="result-text">{String(tool.result || '')}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// 设置组件显示名称
MultiRoundToolsDisplay.displayName = 'MultiRoundToolsDisplay';
ToolCallCard.displayName = 'ToolCallCard';

export default MultiRoundToolsDisplay; 