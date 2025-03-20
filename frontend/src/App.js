import React from 'react';
import TextEditor from './components/TextEditor';
import AIChat from './components/AIChat';
import { EditorProvider } from './context/EditorContext';
import './App.css';

function App() {
  return (
    <EditorProvider>
      <div className="app-container">
        <div className="editor-container">
          <TextEditor />
        </div>
        <div className="chat-container">
          <AIChat />
        </div>
      </div>
    </EditorProvider>
  );
}

export default App;