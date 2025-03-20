const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const aiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5050;

// 启用 CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'], // 允许的前端来源
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', aiRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});