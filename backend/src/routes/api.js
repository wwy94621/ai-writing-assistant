const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// AI 内容生成相关路由
router.post('/chat', aiController.chatContent);

router.post('/autoContent', aiController.autoContent);

// 健康检查端点
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'AI 写作服务运行正常' });
});

module.exports = router;