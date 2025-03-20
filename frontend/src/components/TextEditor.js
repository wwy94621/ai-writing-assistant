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
  const [cursorCoords, setCursorCoords] = useState({ top: 0, left: 0 }); // 添加光标位置状态
  
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
    // 检查光标是否在当前段落末尾
    const paragraphs = text.split('\n');
    let currentParagraphIndex = 0;
    let currentPosition = 0;
    
    // 找出光标所在的段落索引
    for (let i = 0; i < paragraphs.length; i++) {
      currentPosition += paragraphs[i].length + 1; // +1 是因为 '\n' 字符
      if (currentPosition >= position) {
        currentParagraphIndex = i;
        break;
      }
    }
    
    // 检查光标是否在当前段落的末尾
    const currentParagraph = paragraphs[currentParagraphIndex];
    const paragraphEndPosition = currentPosition - (currentParagraphIndex < paragraphs.length - 1 ? 1 : 0);
    const isAtParagraphEnd = position === paragraphEndPosition - currentParagraph.length + paragraphs[currentParagraphIndex].length;
    
    // 如果不在段落末尾或段落太短（少于5个字符），不获取建议
    if (!isAtParagraphEnd || currentParagraph.length < 5) {
      setSuggestion('');
      return;
    }
    
    // 准备要发送的文本内容，包括当前段落，如果当前段落文本较少，则加上上一个段落
    let textToSend = currentParagraph;
    if (currentParagraph.length < 20 && currentParagraphIndex > 0) {
      textToSend = paragraphs[currentParagraphIndex - 1] + '\n' + textToSend;
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      // 再次检查是否仍在组合状态，如果不在则发送请求
      if (!isComposing) {
        console.log("Debounced request sending for paragraph:", textToSend); // 调试日志
        fetchSuggestion(textToSend, textToSend.length);
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
    
    // 获取光标坐标
    updateCursorCoordinates();
    
    // 清除现有建议
    setSuggestion('');
    
    // 只有在不处于输入法组合状态时才获取建议
    if (!isComposing) {
      // 如果有进行中的请求，取消它
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 使用防抖函数获取新的建议
      debouncedFetchSuggestion(newContent, newPosition);
    }
  };
  
  // 添加更新光标坐标的函数
  const updateCursorCoordinates = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const cursorPosition = textarea.selectionStart;
      
      // 简化光标位置计算，避免DOM操作导致的问题
      // 获取视窗中文本区域的位置
      const rect = textarea.getBoundingClientRect();
      
      // 计算每行高度（行高）
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
      
      // 计算光标前文本中的换行符数量来估计行数
      const textBeforeCursor = textarea.value.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const lineCount = lines.length;
      
      // 最后一行的文本长度
      const lastLineLength = lines[lines.length - 1].length;
      
      // 估计每个字符的宽度（使用平均值）
      const charWidth = 8; // 假设平均字符宽度为8px
      
      // 计算光标坐标
      const top = (lineCount - 1) * lineHeight + textarea.scrollTop;
      const left = lastLineLength * charWidth + 15; // 15px是文本区域左内边距
      
      setCursorCoords({ top, left });
    }
  };

  // 监听光标位置变化
  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === textareaRef.current) {
        updateCursorCoordinates();
      }
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', updateCursorCoordinates);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', updateCursorCoordinates);
    };
  }, []);
  
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
    setTimeout(() => {
      // 使用延时确保isComposing状态已更新
      if (newContent.length >= 5) {
        console.log("Sending request after composition end"); // 调试日志
        debouncedFetchSuggestion(newContent, newPosition);
      }
    }, 0);
    
    // 更新光标坐标
    setTimeout(() => {
      updateCursorCoordinates();
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
      
      // 获取当前文本和光标位置
      const currentContent = activeDocument.content;
      const curPos = textareaRef.current.selectionStart;
      
      // 将建议内容插入到光标所在位置
      const beforeCursor = currentContent.substring(0, curPos);
      const afterCursor = currentContent.substring(curPos);
      
      // 检查当前段落末尾与建议开头是否有重叠
      // 找出光标所在的段落
      const paragraphsBeforeCursor = beforeCursor.split('\n');
      const currentParagraph = paragraphsBeforeCursor[paragraphsBeforeCursor.length - 1];
      
      // 如果建议文本与当前段落尾部有重叠，则移除重叠部分
      let suggestionToInsert = suggestion;
      if (currentParagraph.length > 0) {
        // 检查当前段落结尾是否与建议文本开头有重叠
        for (let i = Math.min(currentParagraph.length, suggestion.length); i > 0; i--) {
          if (currentParagraph.endsWith(suggestion.substring(0, i))) {
            suggestionToInsert = suggestion.substring(i);
            break;
          }
        }
      }
      
      // 组合新文本
      const newContent = beforeCursor + suggestionToInsert + afterCursor;
      
      // 更新编辑器内容
      setEditorContent(newContent);
      
      // 更新文档内容
      const updatedDocs = documents.map(doc => 
        doc.id === activeDocId ? { ...doc, content: newContent } : doc
      );
      setDocuments(updatedDocs);
      
      // 清除当前建议
      setSuggestion('');
      
      // 更新光标位置到插入文本后的位置
      const newPosition = curPos + suggestionToInsert.length;
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
          <div 
            className="suggestion-display"
            style={{
              position: 'absolute',
              top: `${cursorCoords.top + 25 + 20}px`, // 增加垂直偏移量，多下移一行
              left: `${cursorCoords.left}px`,
              maxWidth: '400px',
              width: 'auto',
              zIndex: 1000 // 确保在最上层
            }}
          >
            <div className="suggestion-info">
              按Tab键接受建议
              <span className="suggestion-key">Tab ↹</span>
            </div>
            <div className="suggestion-content">
              <span className="suggestion-text">{suggestion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextEditor;
