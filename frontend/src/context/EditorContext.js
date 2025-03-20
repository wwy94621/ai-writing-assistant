// 导入必要的 React 钩子和功能
import React, { createContext, useState, useContext } from 'react';

// 创建一个新的 Context 对象
const EditorContext = createContext();

// 定义一个 Provider 组件，它将包裹需要访问编辑器内容的组件
export const EditorProvider = ({ children }) => {
  // 使用 useState 钩子创建编辑器内容状态和设置函数
  const [editorContent, setEditorContent] = useState('');
  
  // 向 Context 提供编辑器内容和设置函数，使子组件能够访问
  return (
    <EditorContext.Provider value={{ editorContent, setEditorContent }}>
      {children}
    </EditorContext.Provider>
  );
};

// 自定义钩子，简化在其他组件中访问 EditorContext 的方式
export const useEditorContent = () => useContext(EditorContext);
