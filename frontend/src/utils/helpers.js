// This file contains helper functions to simplify code logic for the frontend application.

export const formatText = (text) => {
    // Function to format text (e.g., trim whitespace, convert to uppercase)
    return text.trim().toUpperCase();
};

export const validateInput = (input) => {
    // Function to validate user input
    return input && input.length > 0;
};

export const parseResponse = (response) => {
    // Function to parse AI response
    return response.data ? response.data : null;
};