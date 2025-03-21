const OpenAI = require('openai');
// 加载 .env.local 文件的环境变量
require('dotenv').config({ path: '.env.local' });

// 创建 OpenAI 实例，从环境变量中读取配置信息
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

// 修改日志工具函数，只打印内容部分
function logStreamChunk(prefix, chunk) {
  // 如果有内容，只打印内容
  if (chunk.choices && chunk.choices[0]?.delta?.content) {
    const content = chunk.choices[0].delta.content;
    //process.stdout.write(`[${prefix}] 内容: ${content}`);
    process.stdout.write(content);
  } 
  // 如果是工具调用，处理更简洁的日志
  else if (chunk.choices && chunk.choices[0]?.delta?.tool_calls) {
    const toolCall = chunk.choices[0].delta.tool_calls[0];
    if (toolCall.function?.name) {
      console.log(`[${prefix}] 工具调用: 函数名 "${toolCall.function.name}"`);
    }
    if (toolCall.function?.arguments) {
      console.log(`[${prefix}] 工具参数: ${toolCall.function.arguments}`);
    }
  }
  // 如果是结束信号
  else if (chunk.choices && chunk.choices[0]?.finish_reason) {
    console.log(`[${prefix}] 完成原因: ${chunk.choices[0].finish_reason}`);
  }
}

// 优化SSE发送函数，确保立即发送数据
function sendSSE(res, data) {
  // 确保每个SSE数据包格式正确且立即发送
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  
  // 强制立即刷新数据到客户端
  if (res.flush && typeof res.flush === 'function') {
    res.flush();
  } else if (res.flushHeaders && typeof res.flushHeaders === 'function') {
    // 某些Node.js版本或环境使用flushHeaders而非flush
    res.flushHeaders();
  }
}

// 生成文章大纲的具体实现 - 流式版本
async function generateArticleOutline(requirements, res) {
  console.log('开始生成大纲，请求参数:', requirements);
  console.log('正在流式生成大纲，内容如下:');
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是一个专业的内容编辑，擅长创建各种类型的文章大纲。请根据用户提供的要求，创建文章大纲。`
      },
      {
        role: 'user',
        content: requirements
      }
    ],
    temperature: 0.7,
    stream: true,
  });

  let accumulatedContent = '';
  
  // 发送函数调用开始标记 - 使用SSE格式
  sendSSE(res, { functionCalled: 'generateOutline', start: true, message: '开始生成大纲...' });
  
  // 确保立即发送探测性数据包，测试连接是否正常
  sendSSE(res, { functionCalled: 'generateOutline', ping: true, message: '连接测试' });
  
  for await (const chunk of stream) {
    // 打印原始流式响应
    logStreamChunk('大纲生成', chunk);
    
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      accumulatedContent += content;
      // 发送增量内容 - 使用SSE格式，并尽量减小数据包体积
      sendSSE(res, { 
        functionCalled: 'generateOutline', 
        chunk: content
      });
    }
  }
  
  // 发送完成信息 - 使用SSE格式
  sendSSE(res, { 
    functionCalled: 'generateOutline', 
    complete: true,
    result: {
      message: '大纲生成成功'
    }
  });
  
  console.log('大纲生成完成，内容长度:', accumulatedContent.length);
}

// 翻译文章的具体实现 - 流式版本
async function translateArticleContent(content, requirements, res) {
  console.log('开始翻译文章，翻译要求:', requirements);
  console.log('原始内容长度:', content.length);
  console.log('正在流式翻译文章，内容如下:');
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: '你是一个专业的文章翻译，擅长将文章翻译成各种语言。请翻译用户提供的内容，并确保保留原文的格式和结构。'
      },
      {
        role: 'user',
        content: `请根据以下要求翻译这篇文章：\n\n要求：${requirements}\n\n文章内容：\n${content}`
      }
    ],
    temperature: 0.7,
    stream: true
  });

  let accumulatedContent = '';
  
  // 发送函数调用开始标记 - 使用SSE格式
  sendSSE(res, { functionCalled: 'translateArticle', start: true });
  
  // 添加计时器记录流式传输性能
  const startTime = Date.now();
  let chunkCount = 0;
  
  for await (const chunk of stream) {
    // 打印原始流式响应
    logStreamChunk('文章翻译', chunk);
    
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      accumulatedContent += content;
      chunkCount++;
      
      // 发送增量内容 - 使用SSE格式
      sendSSE(res, { 
        functionCalled: 'translateArticle', 
        chunk: content,
        message: '正在翻译文章...'
      });
    }
  }
  
  const endTime = Date.now();
  console.log(`翻译流式传输完成：共 ${chunkCount} 个数据块，耗时 ${endTime - startTime} ms`);
  
  // 发送完成信息 - 使用SSE格式，不再包含完整内容
  sendSSE(res, { 
    functionCalled: 'translateArticle', 
    complete: true,
    result: {
      message: '文章翻译成功'
    }
  });
  
  console.log('翻译完成，内容长度:', accumulatedContent.length);
}

// 改写文章的具体实现 - 流式版本
async function rewriteArticleContent(content, requirements, res) {
  console.log('开始改写文章，改写要求:', requirements);
  console.log('原始内容长度:', content.length);
  console.log('正在流式改写文章，内容如下:');
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: '你是一个专业的文章编辑，擅长根据特定要求改写文章内容。'
      },
      {
        role: 'user',
        content: `请根据以下要求改写这篇文章：\n\n要求：${requirements}\n\n文章内容：\n${content}`
      }
    ],
    temperature: 0.7,
    stream: true
  });

  let accumulatedContent = '';
  
  // 发送函数调用开始标记 - 使用SSE格式
  sendSSE(res, { functionCalled: 'rewriteArticle', start: true });
  
  for await (const chunk of stream) {
    // 打印原始流式响应
    logStreamChunk('文章改写', chunk);
    
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      accumulatedContent += content;
      // 发送增量内容 - 使用SSE格式
      sendSSE(res, { 
        functionCalled: 'rewriteArticle', 
        chunk: content,
        message: '正在改写文章...'
      });
    }
  }
  
  // 发送完成信息 - 使用SSE格式，不再包含完整内容
  sendSSE(res, { 
    functionCalled: 'rewriteArticle', 
    complete: true,
    result: {
      message: '文章改写成功'
    }
  });
  
  console.log('改写完成，内容长度:', accumulatedContent.length);
}

// 检查文本是否为Markdown格式的辅助函数
function isMarkdownOutline(text) {
  // 检查是否包含Markdown标题格式 (#, ##, ###)
  const headingPattern = /^#+\s+.+$/m;
  
  // 检查是否包含Markdown列表格式 (-, *, 数字.)
  const listPattern = /^[\-\*\d\.]\s+.+$/m;
  
  // 检查是否包含常见Markdown格式元素
  const markdownElements = /(\#{1,6}\s+.+)|(\*\*.+\*\*)|(\*.+\*)|(\[.+\]\(.+\))|(\>.+)|(```[\s\S]*```)|(\-{3,})/;
  
  // 如果满足任一条件，可能是Markdown
  return headingPattern.test(text) || 
         listPattern.test(text) || 
         markdownElements.test(text);
}

// 解析Markdown大纲为段落结构
function parseOutlineIntoSections(outline) {
  const lines = outline.split('\n');
  const sections = [];
  let currentSection = null;
  
  for (const line of lines) {
    // 检测标题行
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // 如果已有当前段落，保存它
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // 创建新段落
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      currentSection = {
        type: 'heading',
        level,
        title,
        content: line,
        children: []
      };
    } 
    // 收集其他内容
    else if (currentSection && line.trim()) {
      currentSection.content += '\n' + line;
      currentSection.children.push(line);
    }
  }
  
  // 添加最后一个段落
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

// 根据大纲写作文章的增强版本 - 自动分段写作
async function writeFromOutline(outline, requirements, res) {
  console.log('开始根据大纲写作文章，写作要求:', requirements);
  console.log('大纲内容长度:', outline.length);
  
  // 1. 检查大纲是否为Markdown格式
  if (!isMarkdownOutline(outline)) {
    console.log('检测到非Markdown格式大纲，返回提示');
    
    // 发送函数调用开始标记
    sendSSE(res, { functionCalled: 'writeFromOutline', start: true });
    
    // 发送非Markdown格式提示
    sendSSE(res, { 
      functionCalled: 'writeFromOutline', 
      complete: true,
      result: {
        message: '请提供Markdown格式的大纲，包含标题(#)、子标题(##)或列表(-)等格式'
      }
    });
    
    return;
  }
  
  // 2. 大纲解析为逻辑段落，保留原始结构
  console.log('解析Markdown大纲为段落结构');
  const sections = parseOutlineIntoSections(outline);
  console.log(`解析完成，共发现${sections.length}个主要段落`);
  
  // 发送函数调用开始标记
  sendSSE(res, { functionCalled: 'writeFromOutline', start: true });
  
  // 3. 初始化累积内容变量
  let accumulatedContent = '';
  let totalCharsGenerated = 0;
  
  // 4. 直接根据解析后的大纲结构分段生成内容，不再单独生成介绍和结论
  console.log('开始分段生成文章内容');
  
  // 为每个段落生成详细内容
  const totalSections = sections.length;
  for (let i = 0; i < totalSections; i++) {
    const section = sections[i];
    console.log(`处理第 ${i+1}/${totalSections} 个段落: ${section.title}`);
    
    // 根据段落标题级别调整内容详细程度
    const detailLevel = section.level <= 2 ? "详细" : "简洁";
    
    // 判断是否是第一个或最后一个段落，分别作为引言和结论处理
    const isIntroduction = i === 0;
    const isConclusion = i === totalSections - 1;
    
    let sectionRole = "";
    if (isIntroduction) {
      sectionRole = "（这是文章的开头部分）";
    } else if (isConclusion) {
      sectionRole = "（这是文章的结论部分）";
    }
    
    // 构建段落上下文，包含已生成内容的最后部分以保持连贯性
    const sectionContext = `
完整大纲：
${outline}

当前已生成内容（最后部分）：
${accumulatedContent.slice(-300)}

当前需要扩写的段落：
${section.content}
${sectionRole}

写作要求：
${requirements}

请生成这部分的${detailLevel}内容，遵守以下规则：
1. 保持与原始大纲结构完全一致
2. 扩写当前段落，不要改变标题或删减内容
3. 保持与前文的连贯性
4. 根据大纲段落的重要性（标题级别为${section.level}）适当展开
${isIntroduction ? '5. 作为文章开头，需要适当引入主题并概述全文' : ''}
${isConclusion ? '5. 作为文章结尾，需要总结全文要点并给出适当收尾' : ''}

你的任务是扩写"${section.title}"这一部分，而不是重写整个大纲。生成的内容必须与原大纲的架构完全匹配。`;

    // 为这个段落生成内容
    const sectionStream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文章写作助手，请根据指定的大纲段落和上下文，生成连贯、详实的内容。严格遵守原始大纲结构，不要改变标题层次或内容组织。'
        },
        {
          role: 'user',
          content: sectionContext
        }
      ],
      temperature: 0.7,
      stream: true
    });
    
    // 处理段落内容的流式输出
    console.log(`处理第 ${i+1} 个段落的流式响应...`);
    let sectionContent = '';
    
    for await (const chunk of sectionStream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        sectionContent += content;
        accumulatedContent += content;
        totalCharsGenerated += content.length;
        
        // 发送增量内容，附加进度信息
        // 计算段落进度：每个段落占总进度的(100/totalSections)%
        const progressPercent = Math.round(((i + (sectionContent.length / 1000) / 5) / totalSections) * 100);
        // 限制进度在5-95%之间
        const progressValue = Math.min(95, Math.max(5, progressPercent));
        
        sendSSE(res, { 
          functionCalled: 'writeFromOutline', 
          chunk: content,
          message: `正在生成第 ${i+1}/${totalSections} 部分...`,
          progress: progressValue
        });
      }
    }
    
    console.log(`第 ${i+1} 个段落已完成，生成内容长度: ${sectionContent.length}`);
    
    // 添加适当换行，确保段落间有良好分隔
    if (i < totalSections - 1) {
      const separator = "\n\n";
      accumulatedContent += separator;
      
      // 发送分隔符
      sendSSE(res, { 
        functionCalled: 'writeFromOutline', 
        chunk: separator
      });
    }
  }
  
  // 发送完成信息
  sendSSE(res, { 
    functionCalled: 'writeFromOutline', 
    complete: true,
    result: {
      message: '文章写作完成，已生成完整内容'
    }
  });
  
  console.log('根据大纲写作完成，内容长度:', accumulatedContent.length, '字符');
  console.log('总共生成字符数:', totalCharsGenerated);
}

// 可用函数定义 - 重构为流式响应版本
const availableFunctions = {
  generateOutline: async (args, res) => {
    const { requirements } = args;
    await generateArticleOutline(requirements, res);
    return null;
  },
  translateArticle: async (args, res) => {
    const { sourceContent, requirements } = args;
    await translateArticleContent(sourceContent, requirements, res);
    return null;
  },
  rewriteArticle: async (args, res) => {
    const { sourceContent, requirements } = args;
    await rewriteArticleContent(sourceContent, requirements, res);
    return null;
  },
  writeFromOutline: async (args, res) => {
    const { outline, requirements } = args;
    await writeFromOutline(outline, requirements, res);
    return null;
  }
};

// 函数定义列表，用于OpenAI API调用
const functionDefinitions = [
  {
    name: 'generateOutline',
    description: '根据给定要求生成文章大纲',
    parameters: {
      type: 'object',
      properties: {
        requirements: {
          type: 'string',
          description: '写作要求',
        }
      },
      required: ['requirements']
    }
  },
  {
    name: 'translateArticle',
    description: '根据要求翻译现有文章',
    parameters: {
      type: 'object',
      properties: {
        sourceContent: {
          type: 'string',
          description: '需要翻译的原始文章内容'
        },
        requirements: {
          type: 'string',
          description: '翻译要求，例如：英文翻译为中文、日文翻译为中文、中文翻译为英文等'
        }
      },
      required: ['content', 'requirements']
    }
  },
  {
    name: 'rewriteArticle',
    description: '根据要求改写现有文章',
    parameters: {
      type: 'object',
      properties: {
        sourceContent: {
          type: 'string',
          description: '需要改写的原始文章内容'
        },
        requirements: {
          type: 'string',
          description: '改写要求，例如：调整语调、简化语言、增加专业术语等'
        }
      },
      required: ['content', 'requirements']
    }
  },
  {
    name: 'writeFromOutline',
    description: '根据提供的大纲和要求写作完整文章',
    parameters: {
      type: 'object',
      properties: {
        outline: {
          type: 'string',
          description: '文章大纲'
        },
        requirements: {
          type: 'string',
          description: '写作要求，例如：风格、语言、受众、字数等'
        }
      },
      required: ['outline']
    }
  }
];

// 主要的处理函数
const chatContent = async (req, res) => {
  try {
    const { messages, sourceContent } = req.body;

    if (!messages) {
      return res.status(400).json({ error: '请提供有效的提示内容' });
    }

    // 保存完整的sourceContent用于后续函数调用
    const fullSourceContent = sourceContent;
    
    // 打印请求信息
    console.log('接收到聊天请求:');
    console.log('消息数量:', messages.length);
    if (fullSourceContent) {
      console.log('包含源内容，长度:', fullSourceContent.length);
    }
    
    // 打印最后一条用户消息
    if (messages.length > 0 && messages[messages.length-1].role === 'user') {
      console.log('最后一条用户消息:', messages[messages.length-1].content);
    }

    // 设置标准SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    // 确保浏览器不缓存
    res.setHeader('Access-Control-Allow-Origin', '*');
    // 添加额外的头信息以防止任何形式的缓冲
    res.setHeader('Pragma', 'no-cache');
    
    // 立即发送一个初始数据包，测试连接是否正常工作
    sendSSE(res, { status: 'connected', message: '连接已建立' });

    // 添加系统消息到消息数组前面
    const systemMessage = {
      role: 'system',
      content: `你是一个专业的文档处理助手，可以使用一些处理文档的函数来帮客户完成各类任务。
      请遵循以下重要规则：
      1. 只有在确认用户明确需要处理文档内容时，才调用函数
      2. 如果用户只是一般问候、感谢或者闲聊，即便请求中包含了文档内容，也不需要调用函数
      `
    };
    
    // 复制 messages 数组，避免直接修改原始数据
    let updatedMessages = [...messages];
    
    // 如果存在 sourceContent 且 messages 不为空，将 sourceContent 的前100个字符添加到最后一条消息的 content 中
    if (fullSourceContent && updatedMessages.length > 0) {
      const lastIndex = updatedMessages.length - 1;
      // 只使用前100个字符，加上指示信息
      const previewContent = fullSourceContent.slice(0, 100) + (fullSourceContent.length > 100 ? '...' : '');
      updatedMessages[lastIndex] = {
        ...updatedMessages[lastIndex],
        content: `用户要求：\n${updatedMessages[lastIndex].content}\n\n文档内容：\n${previewContent}`
      };
    }

    const messagesWithSystem = [systemMessage, ...updatedMessages];

    // 向OpenAI API发送请求，使用流式响应
    console.log('开始向OpenAI发送请求...');
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesWithSystem,
      tools: functionDefinitions.map(func => ({
        type: 'function',
        function: func
      })),
      tool_choice: 'auto',
      temperature: 0.7,
      stream: true,
    });

    let accumulatedContent = '';
    let toolCall = null;

    // 处理流式响应
    console.log('开始接收流式响应...');
    console.log('流式响应内容如下:');
    
    for await (const chunk of stream) {
      // 打印原始流式响应
      logStreamChunk('主要对话', chunk);
      
      if (chunk.choices[0]?.delta?.tool_calls) {
        // 处理工具调用的增量更新
        const toolChunk = chunk.choices[0].delta.tool_calls[0];
        console.log('检测到工具调用:', toolChunk);
        
        if (!toolCall) {
          toolCall = {
            id: toolChunk.index,
            function: {
              name: toolChunk.function?.name || '',
              arguments: toolChunk.function?.arguments || ''
            }
          };
        } else {
          if (toolChunk.function?.name) {
            toolCall.function.name += toolChunk.function.name;
          }
          if (toolChunk.function?.arguments) {
            toolCall.function.arguments += toolChunk.function.arguments;
          }
        }
      } else if (chunk.choices[0]?.delta?.content) {
        // 处理普通内容增量更新
        const content = chunk.choices[0].delta.content;
        accumulatedContent += content;
        
        // 发送增量内容到客户端 - 使用SSE格式，简化数据结构
        sendSSE(res, { chunk: content });
      }
      
      // 检查是否有完成信号
      if (chunk.choices[0]?.finish_reason) {
        console.log(`检测到完成信号: ${chunk.choices[0].finish_reason}`);
      }
    }

    console.log('\n流式响应接收完成');
    
    // 如果存在工具调用，则处理工具调用
    if (toolCall && toolCall.function.name) {
      const functionName = toolCall.function.name;
      console.log(`准备调用函数: ${functionName}`);
      try {
        const functionArgs = JSON.parse(toolCall.function.arguments);
        console.log('函数参数:', functionArgs);
        
        // 检查是否有请求调用的函数
        if (availableFunctions[functionName]) {
          console.log(`开始执行函数: ${functionName}`);
          
          // 如果函数需要使用sourceContent，则使用完整内容替换参数中可能存在的截断内容
          if (functionName === 'translateArticle' || functionName === 'rewriteArticle') {
            if (fullSourceContent) {
              console.log('使用完整的源内容替换参数中的内容');
              functionArgs.sourceContent = fullSourceContent;
            }
          }
          
          // 执行函数并获取结果，传入res以供流式输出
          await availableFunctions[functionName](functionArgs, res);
          console.log(`函数 ${functionName} 执行完成，数据已流式发送`);
          
          // 移除这里的返回结果处理，避免重复发送数据
          // 函数内部已通过SSE发送了所有必要数据
        } else {
          console.error(`请求的函数 ${functionName} 不存在`);
          sendSSE(res, { error: '请求的函数不存在' });
        }
      } catch (error) {
        console.error('解析函数参数或执行函数失败:', error);
        sendSSE(res, { error: '函数执行失败', details: error.message });
      }
    } else if (accumulatedContent) {
      // 只有在没有工具调用的情况下才发送完成信号
      // 避免和工具函数内部的完成信号冲突
      /*sendSSE(res, { 
        complete: true,
        result: {
          content: accumulatedContent,
          message: '响应完成'
        }
      });*/
    }
    
    console.log('请求处理完成，关闭响应流');
    res.end();
  } catch (error) {
    console.error('AI处理出错:', error);
    sendSSE(res, { error: '处理请求时出错', details: error.message });
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.status(500);
    }
    res.end();
  }
};

const autoContent = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: '请提供需要补齐的文本内容' });
    }

    console.log('接收到内容补齐请求:');
    console.log('原始文本长度:', text.length);
    console.log('文本前100字符:', text.slice(0, 100));

    // 设置标准SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Pragma', 'no-cache');
    
    // 立即发送初始数据包
    sendSSE(res, { status: 'connected', message: '连接已建立' });

    // 使用 OpenAI API 生成补齐内容
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `你是一个文本补齐助手。请根据用户提供的文本，生成自然流畅的后续内容，使整体保持一致性。
          生成的内容必须简短，不超过200个字符。直接给出补齐内容，不要添加解释或引导语。`
        },
        {
          role: 'user',
          content: `请用相同的语言补齐以下文本内容（生成的补齐内容不要超过200个字符）：\n\n${text}`
        }
      ],
      temperature: 0.7,
      max_tokens: 150, // 限制输出token数量
      stream: true,
    });

    let accumulatedContent = '';
    
    // 发送函数调用开始标记
    sendSSE(res, { functionCalled: 'autoContent', start: true });
    
    // 处理流式响应
    console.log('开始接收补齐内容的流式响应...');
    
    for await (const chunk of stream) {
      // 打印原始流式响应
      logStreamChunk('内容补齐', chunk);
      
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        accumulatedContent += content;
        
        // 检查是否已经超过字符限制
        if (accumulatedContent.length > 200) {
          console.log('已达到字符限制，停止生成');
          break;
        }
        
        // 发送增量内容
        sendSSE(res, { 
          functionCalled: 'autoContent', 
          chunk: content
        });
      }
    }
    
    // 发送完成信息
    sendSSE(res, { 
      functionCalled: 'autoContent', 
      complete: true,
      result: {
        message: '内容补齐完成'
      }
    });
    
    console.log('内容补齐完成，总长度:', accumulatedContent.length);
    res.end();
    
  } catch (error) {
    console.error('自动补齐内容出错:', error);
    sendSSE(res, { error: '处理自动补齐请求时出错', details: error.message });
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.status(500);
    }
    res.end();
  }
};

module.exports = {
  chatContent,
  autoContent,
};