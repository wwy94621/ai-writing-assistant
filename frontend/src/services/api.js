import axios from 'axios';

const API_URL = 'http://localhost:5050/api/ai/assist';

export const aiAssist = async (action, content, options) => {
    try {
        const response = await axios.post(API_URL, {
            action,
            content,
            options
        });
        return response.data;
    } catch (error) {
        console.error('Error calling AI assist API:', error);
        throw error;
    }
};