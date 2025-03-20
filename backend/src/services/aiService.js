const axios = require('axios');

const AI_API_URL = 'http://your-ai-api-url/api/ai/assist';

const aiService = {
    assist: async (action, content, options) => {
        try {
            const response = await axios.post(AI_API_URL, {
                action,
                content,
                options
            });
            return response.data;
        } catch (error) {
            console.error('Error calling AI API:', error);
            throw error;
        }
    }
};

module.exports = aiService;