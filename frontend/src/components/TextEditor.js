import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContent } from '../context/EditorContext';
import '../assets/styles/TextEditor.css';

const TextEditor = () => {
  const { editorContent, setEditorContent } = useEditorContent();
  const textareaRef = useRef(null);

  // 多文档数据结构
  const [documents, setDocuments] = useState([
    { id: 1, title: '无标题文档', content: '' }
  ]);
  // 当前活动文档ID
  const [activeDocId, setActiveDocId] = useState(1);
  // 下一个文档ID (用于创建新文档时)
  const [nextDocId, setNextDocId] = useState(2);
  
  // 自动补全相关状态
  const [suggestion, setSuggestion] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
  const abortControllerRef = useRef(null);
  const [isComposing, setIsComposing] = useState(false); // 添加输入法组合状态
  const debounceTimerRef = useRef(null); // 添加防抖定时器引用
  
  // 获取当前活动文档
  const activeDocument = documents.find(doc => doc.id === activeDocId) || documents[0];
  
  // 监听Context中editorContent的变化，并更新当前活动文档
  useEffect(() => {
    // 如果当前活动文档的内容与Context中的内容不同，则更新当前文档
    if (activeDocument && activeDocument.content !== editorContent) {
      const updatedDocs = documents.map(doc => 
        doc.id === activeDocId ? { ...doc, content: editorContent } : doc
      );
      setDocuments(updatedDocs);
    }
  }, [editorContent]); // 仅在editorContent变化时执行
  
  const handleContentChange = (e) => {
    const updatedDocs = documents.map(doc => 
      doc.id === activeDocId ? { ...doc, content: e.target.value } : doc
    );
    setDocuments(updatedDocs);
  };
  
  // 防抖函数
  const debounce = (func, delay) => {
    return (...args) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };
  
  // 修改debounce函数为组件内的普通函数，不再需要useCallback
  const debouncedFetchSuggestion = (text, position) => {
    // 如果文本太短，不获取建议
    if (text.length < 5) {
      setSuggestion('');
      return;
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      // 再次检查是否仍在组合状态，如果不在则发送请求
      if (!isComposing) {
        console.log("Debounced request sending for:", text); // 调试日志
        fetchSuggestion(text, position);
      } else {
        console.log("Skipping request - still composing"); // 调试日志
      }
    }, 500); // 500毫秒的防抖延迟
  };
  
  const handleEditorChange = (e) => {
    // 更新编辑器内容
    const newContent = e.target.value;
    setEditorContent(newContent);
    
    // 保留原有的状态更新逻辑
    handleContentChange(e);
    
    // 更新光标位置
    const newPosition = e.target.selectionStart;
    setCursorPosition(newPosition);
    
    // 清除现有建议
    setSuggestion('');
    
    // 只有在不处于输入法组合状态时才获取建议
    // 在中文输入法处于组合状态时，不发送请求
    if (!isComposing) {
      // 如果有进行中的请求，取消它
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 使用防抖函数获取新的建议
      debouncedFetchSuggestion(newContent, newPosition);
    }
  };
  
  // 输入法组合开始事件处理函数
  const handleCompositionStart = () => {
    console.log("Composition started"); // 调试日志
    setIsComposing(true);
    
    // 取消任何待处理的请求
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };
  
  // 输入法组合结束事件处理函数
  const handleCompositionEnd = (e) => {
    console.log("Composition ended"); // 调试日志
    
    // 获取组合结束时的值和光标位置
    const newContent = e.target.value;
    const newPosition = e.target.selectionStart;
    
    // 先设置组合状态为false
    setIsComposing(false);
    
    // 发送新请求
    // 注意：这里直接调用fetchSuggestion而不是debouncedFetchSuggestion
    // 因为我们希望在组合结束后立即发送请求，而不是再等待防抖时间
    setTimeout(() => {
      // 使用延时确保isComposing状态已更新
      if (newContent.length >= 5) {
        console.log("Sending request after composition end"); // 调试日志
        fetchSuggestion(newContent, newPosition);
      }
    }, 0);
  };
  
  // 获取自动补全建议
  const fetchSuggestion = async (text, position) => {
    // 如果文本太短，不获取建议
    if (text.length < 5) {
      setSuggestion('');
      return;
    }
    
    try {
      setIsFetchingSuggestion(true);
      
      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // 准备要发送的数据
      const requestData = {
        text,
        cursorPosition: position
      };

      console.log("Sending request to /api/autoContent with:", requestData);
      
      // 发送请求
      const response = await fetch('/api/autoContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 处理流式响应
      const reader = response.body.getReader();
      let completeText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 解码接收到的文本块
        const chunk = new TextDecoder().decode(value);
        console.log("Received chunk:", chunk);
        
        // 处理返回的数据格式
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            try {
              // 提取JSON部分
              const jsonStr = line.substring(line.indexOf('{'), line.lastIndexOf('}') + 1);
              const data = JSON.parse(jsonStr);
              
              // 只处理autoContent相关的数据
              if (data.functionCalled === 'autoContent') {
                // 如果是开始或完成的标志，则跳过
                if (data.start || data.complete) {
                  continue;
                }
                
                // 如果有chunk数据，则添加到完整文本中
                if (data.chunk) {
                  completeText += data.chunk;
                  
                  // 更新建议 - 确保不和当前文本重复
                  setSuggestion(completeText);
                }
              }
            } catch (err) {
              console.error('Error parsing SSE data:', err);
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching suggestion:', error);
      }
      setSuggestion('');
    } finally {
      setIsFetchingSuggestion(false);
    }
  };
  
  // 处理键盘事件，接受建议
  const handleKeyDown = (e) => {
    // Tab 键接受建议
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault(); // 阻止默认 Tab 行为
      
      // 获取当前文本
      const currentContent = activeDocument.content;
      let newContent;
      
      // 检查文本是否有重叠部分
      if (suggestion.startsWith(currentContent)) {
        // 如果建议文本的开头就是当前文本，则直接使用建议文本
        newContent = suggestion;
      } else {
        // 否则，拼接当前文本和建议文本
        newContent = currentContent + suggestion;
      }
      
      // 更新编辑器内容
      setEditorContent(newContent);
      
      // 更新文档内容
      const updatedDocs = documents.map(doc => 
        doc.id === activeDocId ? { ...doc, content: newContent } : doc
      );
      setDocuments(updatedDocs);
      
      // 清除当前建议
      setSuggestion('');
      
      // 更新光标位置到文本末尾
      const newPosition = newContent.length;
      setCursorPosition(newPosition);
      
      // 在下一个事件循环中设置光标位置
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
        }
      }, 0);
    }
  };

  const createNewDocument = () => {
    const newDoc = { id: nextDocId, title: `无标题文档 ${nextDocId}`, content: '' };
    setDocuments([...documents, newDoc]);
    setActiveDocId(nextDocId);
    setNextDocId(nextDocId + 1);
  };
  
  const switchDocument = (docId) => {
    setActiveDocId(docId);
  };
  
  const closeDocument = (docId, e) => {
    e.stopPropagation(); // 防止触发标签点击事件
    
    if (documents.length === 1) {
      // 只剩一个文档时，清空内容但不删除
      const updatedDocs = documents.map(doc => 
        doc.id === docId ? { ...doc, title: '无标题文档', content: '' } : doc
      );
      setDocuments(updatedDocs);
      return;
    }
    
    // 移除文档
    const updatedDocs = documents.filter(doc => doc.id !== docId);
    setDocuments(updatedDocs);
    
    // 如果关闭的是当前激活的文档，则切换到第一个文档
    if (docId === activeDocId) {
      setActiveDocId(updatedDocs[0].id);
    }
  };

  return (
    <div className="text-editor">
      <div className="document-tabs">
        {documents.map(doc => (
          <div 
            key={doc.id} 
            className={`tab ${doc.id === activeDocId ? 'active' : ''}`} 
            onClick={() => switchDocument(doc.id)}
          >
            <span className="tab-title">{doc.title || '无标题文档'}</span>
            <button className="close-tab" onClick={(e) => closeDocument(doc.id, e)}>×</button>
          </div>
        ))}
        <button className="new-tab" onClick={createNewDocument}>+</button>
      </div>
      
      <div className="editor-container">
        <textarea
          ref={textareaRef}
          className="document-content"
          value={activeDocument.content}
          onChange={handleEditorChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="开始输入文档内容..."
        />
        {suggestion && (
          <div className="suggestion-overlay">
            {/* 不可见的原始文本，仅用于占位 */}
            <div className="invisible-text">{activeDocument.content}</div>
            {/* 只显示建议的文本 */}
            <div className="suggestion-container">
              <span className="suggestion-text">{suggestion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextEditor;
