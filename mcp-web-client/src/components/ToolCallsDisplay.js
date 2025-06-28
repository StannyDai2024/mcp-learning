import React, { memo } from 'react';

// 🔥 优化：独立的工具调用展示组件 - 使用 React.memo 避免重复渲染
const ToolCallsDisplay = memo(({ 
  toolCalls, 
  messageIndex, 
  isExpanded, 
  onToggleExpanded 
}) => {
  // 🔍 渲染追踪 - 验证 React.memo 是否正常工作
  console.log(`🔧 ToolCallsDisplay[${messageIndex}] 渲染 - 工具数量: ${toolCalls?.length || 0}, 展开: ${isExpanded}`);
  
  if (!toolCalls || toolCalls.length === 0) return null;

  // 计算工具状态统计
  const stats = toolCalls.reduce((acc, tool) => {
    const status = tool.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, {});

  // 生成标题文本
  const getTitleText = () => {
    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const failed = stats.error || 0;
    
    if (completed + failed === total) {
      // 全部完成
      return `AI 使用了 ${total} 个工具 ${failed > 0 ? `(${failed} 个失败)` : '(全部成功)'}`;
    } else {
      // 还在执行中
      return `AI 正在使用 ${total} 个工具 (${completed + failed}/${total})`;
    }
  };

  return (
    <div className="tool-calls-container">
      <div className="tool-calls-header" onClick={onToggleExpanded}>
        <span className="tool-calls-icon">🔧</span>
        <span className="tool-calls-title">{getTitleText()}</span>
        
        {/* 状态统计小标签 */}
        <div className="tool-stats">
          {stats.executing > 0 && <span className="stat-badge executing">⚡ {stats.executing}</span>}
          {stats.completed > 0 && <span className="stat-badge completed">✅ {stats.completed}</span>}
          {stats.error > 0 && <span className="stat-badge error">❌ {stats.error}</span>}
        </div>
        
        <span className={`tool-calls-toggle ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      {isExpanded && (
        <div className="tool-calls-list">
          {toolCalls.map((toolCall, index) => (
            <ToolCallItem 
              key={`${toolCall.name}-${index}-${toolCall.status}`}
              toolCall={toolCall} 
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// 🔥 独立的工具调用项组件 - 进一步优化渲染性能
const ToolCallItem = memo(({ toolCall, index }) => {
  // 🔍 渲染追踪 - 验证单个工具项的渲染优化
  console.log(`  🛠️ ToolCallItem[${index}] 渲染 - ${toolCall.name} (${toolCall.status || 'unknown'})`);
  
  return (
    <div className={`tool-call-item ${toolCall.status || 'unknown'}`}>
      <div className="tool-call-header">
        <div className="tool-header-left">
          <span className="tool-name">{toolCall.name}</span>
          <span className={`tool-status-badge ${toolCall.status || 'unknown'}`}>
            {toolCall.status === 'pending' && '⏳ 等待'}
            {toolCall.status === 'executing' && '⚡ 执行中'}
            {toolCall.status === 'completed' && '✅ 完成'}
            {toolCall.status === 'error' && '❌ 失败'}
            {!toolCall.status && '🔍 未知'}
          </span>
        </div>
        <div className="tool-header-right">
          {toolCall.executionTime && (
            <span className="tool-time">{toolCall.executionTime}ms</span>
          )}
        </div>
      </div>
      <div className="tool-call-details">
        <div className="tool-arguments">
          <strong>📝 参数:</strong>
          <pre className="tool-args-code">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        </div>
        <div className="tool-result">
          <strong>
            {toolCall.status === 'error' ? '❌ 错误:' : 
             toolCall.status === 'completed' ? '✅ 结果:' : 
             '📄 结果:'}
          </strong>
          <div className="tool-result-content">
            {toolCall.status === 'error' ? (
              <div className="tool-error">
                <span className="error-message">{toolCall.error || '工具执行失败'}</span>
              </div>
            ) : typeof toolCall.result === 'object' ? (
              <pre className="tool-result-code">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            ) : (
              <span className="tool-result-text">{String(toolCall.result || '')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// 🔥 自定义比较函数，精确控制重新渲染条件
const arePropsEqual = (prevProps, nextProps) => {
  // 如果 messageIndex 不同，肯定需要重新渲染
  if (prevProps.messageIndex !== nextProps.messageIndex) {
    console.log(`🔄 ToolCallsDisplay[${prevProps.messageIndex}] props变化: messageIndex`);
    return false;
  }
  
  // 如果展开状态不同，需要重新渲染
  if (prevProps.isExpanded !== nextProps.isExpanded) {
    console.log(`🔄 ToolCallsDisplay[${prevProps.messageIndex}] props变化: isExpanded`);
    return false;
  }
  
  // 比较 toolCalls 数组
  if (!prevProps.toolCalls && !nextProps.toolCalls) return true;
  if (!prevProps.toolCalls || !nextProps.toolCalls) {
    console.log(`🔄 ToolCallsDisplay[${prevProps.messageIndex}] props变化: toolCalls existence`);
    return false;
  }
  
  if (prevProps.toolCalls.length !== nextProps.toolCalls.length) {
    console.log(`🔄 ToolCallsDisplay[${prevProps.messageIndex}] props变化: toolCalls length`);
    return false;
  }
  
  // 深度比较每个工具的关键属性
  for (let i = 0; i < prevProps.toolCalls.length; i++) {
    const prev = prevProps.toolCalls[i];
    const next = nextProps.toolCalls[i];
    
    if (prev.name !== next.name || 
        prev.status !== next.status || 
        prev.executionTime !== next.executionTime ||
        JSON.stringify(prev.arguments) !== JSON.stringify(next.arguments) ||
        JSON.stringify(prev.result) !== JSON.stringify(next.result) ||
        prev.error !== next.error) {
      console.log(`🔄 ToolCallsDisplay[${prevProps.messageIndex}] props变化: toolCall[${i}] content`);
      return false;
    }
  }
  
  // 所有属性都相同，不需要重新渲染
  console.log(`✅ ToolCallsDisplay[${prevProps.messageIndex}] props相同，跳过渲染`);
  return true;
};

// 使用自定义比较函数包装组件
const OptimizedToolCallsDisplay = memo(ToolCallsDisplay, arePropsEqual);

// 设置组件显示名称便于调试
OptimizedToolCallsDisplay.displayName = 'ToolCallsDisplay';
ToolCallItem.displayName = 'ToolCallItem';

export default OptimizedToolCallsDisplay; 