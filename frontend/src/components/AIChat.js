import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '../assets/styles/AIChat.css';
import { useEditorContent } from '../context/EditorContext';
import { Send24Regular, ArrowReset24Regular } from '@fluentui/react-icons';

// 添加格式化时间戳的辅助函数
const formatTimestamp = () => {
    const now = new Date();
    return `${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
};

const AIChat = () => {
    const [userInput, setUserInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮你撰写、修改或润色你的文章。请告诉我你需要什么帮助？' }
    ]);
    const [loading, setLoading] = useState(false);
    const [isComposing, setIsComposing] = useState(false); // 跟踪输入法组合状态
    const textareaRef = useRef(null);
    const { editorContent, setEditorContent } = useEditorContent(); // 获取编辑器内容和更新函数

    // 添加状态用于跟踪流式响应
    const [currentStreamingMessage, setCurrentStreamingMessage] = useState(null);
    const [streamedEditorContent, setStreamedEditorContent] = useState('');
    const [activeFunctionCall, setActiveFunctionCall] = useState(null);

    // 添加引用来跟踪函数调用的累积字符长度
    const totalStreamedCharsRef = useRef(0);

    // 用于保存 EventSource 实例的引用
    const fetchControllerRef = useRef(null);

    // 添加状态保存原始内容和控制按钮显示
    const [originalEditorContent, setOriginalEditorContent] = useState('');
    const [showChangeButtons, setShowChangeButtons] = useState(false);

    // 清理函数
    useEffect(() => {
        return () => {
            // 组件卸载时关闭所有流式连接
            if (fetchControllerRef.current) {
                fetchControllerRef.current.abort();
            }
        };
    }, []);

    const handleInputChange = (e) => {
        setUserInput(e.target.value);
    };

    // 添加输入法组合事件处理
    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = () => {
        setIsComposing(false);
    };

    // 修改键盘事件处理函数，考虑输入法组合状态
    const handleKeyDown = (e) => {
        // 如果正在使用输入法组合，不处理回车键
        if (isComposing) {
            return;
        }
        
        // 如果按下回车键但没有按下Shift键，则发送消息
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 防止默认的换行行为
            if (userInput.trim() && !loading) {
                handleSubmit(e);
            }
        }
        // 如果按下Shift+回车，则允许默认的换行行为
    };

    // 添加一个标记来追踪重置消息历史
    const [shouldResetMessages, setShouldResetMessages] = useState(false);

    // 添加引用来保存当前消息内容，避免状态更新延迟问题
    const currentMessageContentRef = useRef('');
    const responseIdRef = useRef(0); // 添加响应ID引用，确保匹配正确的响应

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        // 递增响应ID
        const currentResponseId = responseIdRef.current + 1;
        responseIdRef.current = currentResponseId;
        
        console.log(`[${formatTimestamp()}] 开始新请求，ID: ${currentResponseId}`);

        // 保存当前编辑器内容以便后续可能需要恢复
        setOriginalEditorContent(editorContent);

        // 添加用户消息到聊天历史
        const userMessage = { role: 'user', content: userInput };
        
        // 处理当前流式消息，确保它被添加到消息历史中
        let updatedMessages = [...messages];
        
        if (currentStreamingMessage && currentStreamingMessage.content) {
            console.log('添加当前流式消息到历史记录:', currentStreamingMessage.content);
            // 将当前流式消息添加到历史记录
            updatedMessages = [...messages, {
                ...currentStreamingMessage,
                //finalized: true
            }];
            
            // 立即更新消息列表，这样它会包含AI的最后回复
            setMessages(updatedMessages);
        }
        
        // 重置流式消息状态和引用
        setCurrentStreamingMessage(null);
        currentMessageContentRef.current = '';
        
        // 添加用户消息
        updatedMessages = [...updatedMessages, userMessage];
        setMessages(updatedMessages);
        setUserInput('');
        setLoading(true);
        
        try {
            // 使用已更新的消息历史（包括AI的回复）
            const chatContent = {
                messages: updatedMessages.slice(-10), // 只取最近10条
                sourceContent: editorContent
            };

            console.log(`[请求ID:${currentResponseId}] 发送给API的消息历史:`, JSON.stringify(chatContent.messages, null, 2));

            // 创建 AbortController 实例用于取消请求
            const controller = new AbortController();
            fetchControllerRef.current = controller;

            // 创建新的流式消息占位符，但暂时不显示内容
            setCurrentStreamingMessage({ role: 'assistant', content: '' });
            setStreamedEditorContent('');
            setActiveFunctionCall(null);

            // 使用 fetch API 发送流式请求
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chatContent),
                signal: controller.signal
            });

            console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 收到响应头, 状态: ${response.status}`);

            // 使用 ReadableStream 直接处理流
            if (response.body) {
                console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 开始读取流`);
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = ''; // 用于存储跨块的不完整数据
                
                let done = false;
                
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    
                    if (done) {
                        console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 流读取完成`);
                        break;
                    }
                    
                    // 解码二进制数据并合并到缓冲区
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    
                    // 处理完整行，保留不完整的部分在缓冲区
                    let newlineIndex;
                    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                        const line = buffer.slice(0, newlineIndex).trim();
                        buffer = buffer.slice(newlineIndex + 1);
                        
                        if (line) {
                            try {
                                // 处理SSE特殊事件行
                                if (line.startsWith('event:')) {
                                    const eventType = line.substring(7).trim();
                                    console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 收到SSE事件: ${eventType}`);
                                    
                                    // 根据事件类型处理
                                    if (eventType === 'end') {
                                        console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 流结束事件，准备最终化响应`);
                                        if (responseIdRef.current === currentResponseId) {
                                            finalizeResponse(currentResponseId);
                                        }
                                    }
                                    continue;
                                }
                                
                                // 检查行是否是SSE数据行 (以 "data: " 开头)
                                if (line.startsWith('data: ')) {
                                    // 提取data: 后面的JSON部分
                                    const jsonStr = line.substring(6).trim(); // "data: "的长度是6
                                    if (jsonStr) {
                                        console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 解析SSE数据: ${jsonStr.substring(0, 50)}${jsonStr.length > 50 ? '...' : ''}`);
                                        const data = JSON.parse(jsonStr);
                                        await handleStreamData(data, currentResponseId);
                                    }
                                } else if (line) {
                                    // 尝试直接解析为JSON (兼容旧格式)
                                    console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 尝试解析常规JSON: ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`);
                                    const data = JSON.parse(line);
                                    await handleStreamData(data, currentResponseId);
                                }
                            } catch (error) {
                                console.error(`[${formatTimestamp()}][请求ID:${currentResponseId}] 解析流式数据错误:`, error, line);
                            }
                        }
                    }
                    
                    // 强制React刷新UI，确保内容实时显示
                    if (responseIdRef.current === currentResponseId && currentMessageContentRef.current) {
                        setCurrentStreamingMessage(prev => ({
                            ...prev,
                            content: currentMessageContentRef.current,
                            updateTime: Date.now() // 添加时间戳强制刷新
                        }));
                    }
                }
                
                // 处理可能剩余在缓冲区的内容
                if (buffer.trim()) {
                    try {
                        console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 处理缓冲区剩余内容: ${buffer.length}字节`);
                        // 尝试处理最后一块数据
                        if (buffer.startsWith('data: ')) {
                            const jsonStr = buffer.substring(6).trim();
                            const data = JSON.parse(jsonStr);
                            await handleStreamData(data, currentResponseId);
                        } else {
                            const data = JSON.parse(buffer);
                            await handleStreamData(data, currentResponseId);
                        }
                    } catch (error) {
                        console.error(`[${formatTimestamp()}][请求ID:${currentResponseId}] 处理剩余缓冲区错误:`, error);
                    }
                }
                
                // 流结束，确保最终化
                if (responseIdRef.current === currentResponseId) {
                    console.log(`[${formatTimestamp()}][请求ID:${currentResponseId}] 流式传输完成，准备最终化响应`);
                    finalizeResponse(currentResponseId);
                }
            } else {
                console.error(`[${formatTimestamp()}][请求ID:${currentResponseId}] 响应没有正文`);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '对不起，我在处理您的请求时遇到了问题。请稍后再试。'
                }]);
            }
                
        } catch (error) {
            console.error(`[${formatTimestamp()}][请求ID:${currentResponseId}] 与AI通信时出错:`, error);
            
            // 显示错误消息
            if (responseIdRef.current === currentResponseId) {
                setCurrentStreamingMessage(null);
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: '对不起，我在处理您的请求时遇到了问题。请稍后再试。' 
                }]);
            }
            
        } finally {
            if (responseIdRef.current === currentResponseId) {
                setLoading(false);
                fetchControllerRef.current = null;
            }
        }
    };

    // 修改为异步函数，以便可以等待状态更新
    const handleStreamData = async (data, responseId) => {
        // 检查是否是当前请求的响应
        if (responseId !== responseIdRef.current) {
            console.log(`[${formatTimestamp()}][请求ID:${responseId}] 忽略过时响应数据`);
            return;
        }

        //console.log(`[${formatTimestamp()}][请求ID:${responseId}] 处理数据:`, JSON.stringify(data).substring(0, 100));

        // 处理普通文本流
        if (data.chunk && data.functionCalled === undefined) {
            // 使用引用保存当前内容
            const previousLength = currentMessageContentRef.current.length;
            currentMessageContentRef.current += data.chunk;
            
            // 在这里打印每个流式块，以验证内容确实在流式到达
            //console.log(`[${formatTimestamp()}][请求ID:${responseId}] 接收普通文本流: "${data.chunk}" 当前总内容长度: ${currentMessageContentRef.current.length}`);
            
            // 立即更新流式消息，使用函数形式确保基于最新状态更新
            const newContent = currentMessageContentRef.current;
            setCurrentStreamingMessage(prev => {
                //console.log(`[${formatTimestamp()}][请求ID:${responseId}] 更新流式消息 +${newContent.length - previousLength}字符`);
                return {
                    role: 'assistant',
                    content: newContent,
                    responseId,
                    // 每次更新使用不同时间戳，确保React检测到变化
                    timestamp: Date.now()
                };
            });

            // 用Promise和setTimeout强制让UI有时间更新
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // 处理完整响应
        else if (data.complete && data.functionCalled === undefined) {
            if (typeof data.result === 'string') {
                currentMessageContentRef.current = data.result;
                
                setCurrentStreamingMessage({
                    role: 'assistant',
                    content: data.result,
                    complete: true,
                    responseId // 添加响应ID标记
                });
            }
        }
        
        // 处理函数调用流
        else if (data.functionCalled) {
            // 函数调用开始
            if (data.start) {
                setActiveFunctionCall(data.functionCalled);
                // 重置累积字符计数
                totalStreamedCharsRef.current = 0;
                
                // 根据不同函数类型设置初始消息
                let initialMessage = '';
                switch (data.functionCalled) {
                    case 'generateOutline':
                        initialMessage = '正在生成大纲...';
                        break;
                    case 'translateArticle':
                        initialMessage = '正在翻译文章...';
                        break;
                    case 'rewriteArticle':
                        initialMessage = '正在改写文章...';
                        break;
                    case 'writeFromOutline':
                        initialMessage = '正在根据大纲写作文章...';
                        break;
                    default:
                        initialMessage = '正在处理...';
                }
                
                currentMessageContentRef.current = initialMessage;
                setCurrentStreamingMessage({
                    role: 'assistant',
                    content: initialMessage,
                    responseId, // 添加响应ID标记
                    streaming: true // 标记为正在流式传输
                });
                
                // 重置编辑器内容引用，准备累积
                setStreamedEditorContent('');
                
                // 清空编辑器内容，为函数调用结果做准备
                if (data.functionCalled === 'translateArticle' || 
                    data.functionCalled === 'rewriteArticle' || 
                    data.functionCalled === 'generateOutline' ||
                    data.functionCalled === 'writeFromOutline') {
                    setEditorContent(''); // 确保编辑器从空白开始累积内容
                }
            }
            
            // 处理函数调用流式内容块 - 改进这里的处理逻辑
            else if (data.chunk) {
                // 累加新接收的字符数
                totalStreamedCharsRef.current += data.chunk.length;
                
                // 更新编辑器内容
                const newStreamContent = (streamedEditorContent || '') + data.chunk;
                setStreamedEditorContent(newStreamContent);
                
                // 1. 实时更新编辑器内容 - 确保所有类型的函数调用都正确更新
                if (data.functionCalled === 'translateArticle' || 
                    data.functionCalled === 'rewriteArticle' || 
                    data.functionCalled === 'generateOutline' ||
                    data.functionCalled === 'writeFromOutline') {
                    
                    // 实时预览生成的内容，立即更新编辑器
                    setEditorContent(prev => prev + data.chunk);
                }
                
                // 2. 在聊天消息中也显示流式进度
                let statusMessage = '';
                let percentComplete = 0;
                
                // 优先使用服务器返回的进度信息
                if (data.progress !== undefined) {
                    percentComplete = data.progress;
                } else {
                    // 使用客户端估算的进度（保持原有逻辑作为备用）
                    // 检测源文本是否主要为中文
                    const isMainlyChinese = editorContent && 
                        (editorContent.replace(/[\u4e00-\u9fa5]/g, '').length < editorContent.length * 0.6);
                    
                    // 根据任务类型调整估计总量 - 对翻译和改写使用源文档长度和语言特性
                    let estimatedTotal = 2000; // 默认估计长度
                    switch (data.functionCalled) {
                        case 'generateOutline':
                            estimatedTotal = 1000; // 大纲通常较短
                            break;
                        case 'translateArticle':
                            if (editorContent) {
                                // 中译英：英文通常比中文字符数多1.8到2倍左右
                                if (isMainlyChinese) {
                                    estimatedTotal = Math.max(200, Math.round(editorContent.length * 2.2));
                                } 
                                // 英译中：中文通常比英文字符数少约40-50%
                                else {
                                    estimatedTotal = Math.max(200, Math.round(editorContent.length * 0.6));
                                }
                            } else {
                                estimatedTotal = 3000; // 没有源内容时的默认值
                            }
                            break;
                        case 'rewriteArticle':
                            // 改写通常与原文长度相近
                            estimatedTotal = editorContent ? Math.max(200, Math.round(editorContent.length * 1.1)) : 2500;
                            break;
                        case 'writeFromOutline':
                            // 根据大纲写作通常比大纲本身长得多
                            estimatedTotal = editorContent ? Math.max(1000, Math.round(editorContent.length * 5)) : 5000;
                            break;
                    }
                    
                    // 进度计算
                    // 1. 确保开始时就显示有进度，设置基础进度5%
                    const baseProgress = 5;
                    
                    // 2. 计算动态进度，考虑中英文翻译的特殊性
                    let dynamicProgress;
                    
                    // 根据当前累积字符与估算总量的比例计算动态进度
                    const progressRatio = totalStreamedCharsRef.current / estimatedTotal;
                    
                    // 限制动态进度在0-95%之间，确保100%留给完成状态
                    dynamicProgress = Math.min(95, Math.round(progressRatio * 95));
                    
                    // 计算总进度
                    percentComplete = baseProgress + dynamicProgress;
                }
                
                // 添加调试日志，帮助排查进度问题
                console.log(`[进度] 功能:${data.functionCalled}, 累计字符:${totalStreamedCharsRef.current}, 进度:${percentComplete}%, 自定义消息:${data.message || 'N/A'}`);
                
                // 如果服务器提供了自定义消息，优先使用
                if (data.message) {
                    statusMessage = data.message;
                    // 如果消息中没有包含进度信息，添加进度
                    if (!statusMessage.includes('%')) {
                        statusMessage = `${statusMessage} (${percentComplete}%)`;
                    }
                } else {
                    // 使用默认消息
                    switch (data.functionCalled) {
                        case 'generateOutline':
                            statusMessage = `正在生成大纲... (已完成${percentComplete}%)`;
                            break;
                        case 'translateArticle':
                            statusMessage = `正在翻译文章... (已完成${percentComplete}%)`;
                            break;
                        case 'rewriteArticle':
                            statusMessage = `正在改写文章... (已完成${percentComplete}%)`;
                            break;
                        case 'writeFromOutline':
                            statusMessage = `正在根据大纲写作文章... (已完成${percentComplete}%)`;
                            break;
                        default:
                            statusMessage = `正在处理... (已完成${percentComplete}%)`;
                    }
                }
                
                // 更新消息内容，让用户知道有进度
                currentMessageContentRef.current = statusMessage;
                setCurrentStreamingMessage({
                    role: 'assistant',
                    content: statusMessage,
                    responseId,
                    streaming: true,
                    timestamp: Date.now() // 确保React检测到变化
                });
            }
            
            // 函数调用完成
            else if (data.complete) {
                setActiveFunctionCall(null);
                setShowChangeButtons(true);
                
                // 更新消息内容
                if (data.result && data.result.message) {
                    const finalMessage = `${data.result.message}，请查看编辑器中的内容。`;
                    currentMessageContentRef.current = finalMessage;
                    setCurrentStreamingMessage({
                        role: 'assistant',
                        content: finalMessage,
                        responseId,
                        streaming: false
                    });
                }
            }
        }
        
        // 处理错误
        else if (data.error) {
            const errorMessage = `出错了: ${data.error}`;
            currentMessageContentRef.current = errorMessage;
            
            setCurrentStreamingMessage({
                role: 'assistant',
                content: errorMessage,
                responseId // 添加响应ID标记
            });
        }
    };

    // 完成响应处理 - 添加请求ID参数确保匹配
    const finalizeResponse = (responseId) => {
        console.log(`[${formatTimestamp()}][请求ID:${responseId}] 完成响应处理`);
        
        // 直接打印引用中的内容
        console.log(`[${formatTimestamp()}][请求ID:${responseId}] 当前流式内容: "${getStreamingContent().substring(0, 50)}..."`);
        
        // 检查是否是当前请求的响应
        if (responseId !== responseIdRef.current) {
            console.log(`[${formatTimestamp()}][请求ID:${responseId}] 忽略过时的最终化操作`);
            return;
        }

        // 从流式消息或引用中获取最终内容
        let finalContent = currentMessageContentRef.current;
        
        // 如果引用为空但流式消息存在，使用流式消息内容
        if (!finalContent && currentStreamingMessage && currentStreamingMessage.content) {
            finalContent = currentStreamingMessage.content;
            console.log(`[${formatTimestamp()}][请求ID:${responseId}] 使用流式消息内容: "${finalContent.substring(0, 50)}..."`);
        }
        
        // 如果引用中有内容或从流式消息获取到了内容，确保它被添加到消息列表中
        if (finalContent) {
            // 创建最终消息对象
            const finalMessage = {
                role: 'assistant',
                content: finalContent,
                //finalized: true,
                //responseId
            };
            console.log(`[${formatTimestamp()}][请求ID:${responseId}] 添加最终消息到历史，长度: ${finalMessage.content.length}字符`);
            
            // 更新消息列表
            setMessages(prev => [...prev, finalMessage]);
            
            // 重要：清空当前流式消息和引用
            setCurrentStreamingMessage(null);
            currentMessageContentRef.current = '';
            
            // 检查是否需要显示接受/放弃更改按钮
            if (originalEditorContent !== editorContent && streamedEditorContent) {
                setShowChangeButtons(true);
            }
        } else {
            console.warn(`[${formatTimestamp()}][请求ID:${responseId}] 完成响应但无内容可显示，检查数据流`);
            // 在这种情况下添加一个默认消息
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '抱歉，我无法处理这个请求。请再试一次。',
                //finalized: true,
                //responseId
            }]);
        }
        
        // 如果有流式编辑器内容但没有最终更新过editorContent
        if (streamedEditorContent && activeFunctionCall) {
            setEditorContent(streamedEditorContent);
            setStreamedEditorContent('');
            
            // 检查是否需要显示接受/放弃更改按钮
            if (originalEditorContent !== streamedEditorContent) {
                setShowChangeButtons(true);
            }
        }
    };

    // 重新实现获取流式内容的函数，确保返回有效内容
    const getStreamingContent = () => {
        // 优先使用引用中的内容
        if (currentMessageContentRef.current && currentMessageContentRef.current.length > 0) {
            return currentMessageContentRef.current;
        }
        
        // 其次使用流式消息中的内容
        if (currentStreamingMessage && currentStreamingMessage.content) {
            return currentStreamingMessage.content;
        }
        
        // 没有内容可显示
        return '';
    };

    // 处理接受更改按钮点击
    const handleAcceptChanges = () => {
        // 保持当前编辑器内容不变
        console.log('更改已接受');
        setShowChangeButtons(false); // 隐藏按钮
    };

    // 处理放弃更改按钮点击
    const handleRejectChanges = () => {
        // 恢复到原始编辑器内容
        setEditorContent(originalEditorContent);
        console.log('更改已放弃，恢复原始内容');
        setShowChangeButtons(false); // 隐藏按钮
    };

    // 给组件添加一个新的函数来监控编辑器内容变化
    useEffect(() => {
        if (streamedEditorContent && activeFunctionCall) {
            // 当有流式编辑器内容更新时，可以在这里做额外处理
            //console.log(`编辑器内容流式更新，当前长度: ${streamedEditorContent.length}`);
        }
    }, [streamedEditorContent, activeFunctionCall]);

    // 编辑显示编辑器内容的预览组件
    const EditorPreview = () => {
        if (!loading || !streamedEditorContent) return null;
        
        const previewText = streamedEditorContent.length > 200 
            ? streamedEditorContent.substring(0, 200) + '...' 
            : streamedEditorContent;
            
        return (
            <div className="editor-preview">
                <div className="preview-content">
                    {previewText}
                </div>
            </div>
        );
    };

    // 添加重置聊天历史的函数
    const handleResetChat = () => {
        // 重置消息历史到初始状态
        setMessages([
            { role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮你撰写、修改或润色你的文章。请告诉我你需要什么帮助？' }
        ]);
        
        // 重置其他相关状态
        setCurrentStreamingMessage(null);
        currentMessageContentRef.current = '';
        setStreamedEditorContent('');
        setShowChangeButtons(false);
        
        console.log('聊天历史已重置');
    };

    return (
        <div className="ai-chat">
            <div className="chat-header">
                <h2>AI写作助手</h2>
                <div className="reset-chat">
                    <button 
                        className="reset-button" 
                        onClick={handleResetChat} 
                        title="重置聊天"
                    >
                        <ArrowReset24Regular />
                    </button>
                </div>
            </div>
            <div className="chat-messages">
                {/* 显示历史消息 */}
                {messages.map((message, index) => (
                    <div key={`msg-${index}`} className={`message ${message.role}`}>
                        <div className="bubble">{message.content}</div>
                    </div>
                ))}
                
                {/* 使用getStreamingContent函数获取当前流式内容 */}
                {(currentMessageContentRef.current || (currentStreamingMessage && currentStreamingMessage.content)) && (
                    <div 
                        // 使用内容长度和时间戳生成key，确保内容变化时会触发重新渲染
                        key={`streaming-msg-${currentStreamingMessage?.timestamp || Date.now()}-${(currentStreamingMessage?.content || currentMessageContentRef.current || '').length}`} 
                        className="message assistant streaming"
                    >
                        <div className="bubble">
                            {getStreamingContent()}
                            {loading && (
                                <span className="streaming-indicator">
                                    <span>.</span><span>.</span><span>.</span>
                                </span>
                            )}
                            {activeFunctionCall && (
                                <div className="function-progress">
                                    <div className="progress-bar" 
                                         style={{ 
                                             width: totalStreamedCharsRef.current 
                                                 ? Math.min(100, (totalStreamedCharsRef.current / 
                                                    (activeFunctionCall === 'generateOutline' ? 1000 : 
                                                     activeFunctionCall === 'translateArticle' ? 
                                                        (editorContent ? 
                                                            (editorContent.replace(/[\u4e00-\u9fa5]/g, '').length < editorContent.length * 0.6) ?
                                                                Math.max(500, Math.round(editorContent.length * 2.2)) :  // 中译英
                                                                Math.max(500, Math.round(editorContent.length * 0.6))    // 英译中
                                                            : 3000) : 
                                                     activeFunctionCall === 'rewriteArticle' ? 
                                                        (editorContent ? Math.max(500, Math.round(editorContent.length * 1.1)) : 2500) : 
                                                     activeFunctionCall === 'writeFromOutline' ?
                                                        (editorContent ? Math.max(1000, Math.round(editorContent.length * 5)) : 5000) : // 大纲写作通常生成更多内容
                                                     2000)) * 100) + '%' 
                                                 : '5%' 
                                         }}></div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* 仅当没有当前流式消息和引用内容时显示loading状态 */}
                {loading && !currentMessageContentRef.current && (!currentStreamingMessage || !currentStreamingMessage.content) && (
                    <div key="loading-msg" className="message assistant">
                        <div className="bubble loading">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                )}
                
                {/* 移动接受/放弃更改按钮到这里，紧跟在最新消息之后 */}
                {showChangeButtons && !loading && (
                    <div className="change-actions">
                        <button 
                            className="accept-changes-btn" 
                            onClick={handleAcceptChanges}
                        >
                            接受更改
                        </button>
                        <button 
                            className="reject-changes-btn" 
                            onClick={handleRejectChanges}
                        >
                            放弃更改
                        </button>
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit} className="chat-input-form">
                <div className="input-container">
                    <textarea 
                        ref={textareaRef}
                        value={userInput}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        placeholder="输入你的问题或要求... (按Enter发送，Shift+Enter换行)"
                        className="chat-input"
                    />
                    <button 
                        type="submit" 
                        className="send-button" 
                        disabled={loading || !userInput.trim()}
                    >
                        <Send24Regular />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AIChat;