/**
 * API Service
 * Handles API calls to the backend
 */

const API_URL = '/api';

/**
 * Make API request
 */
const request = async (endpoint, options = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
};

// ============================================
// CHATBOT API
// ============================================

export const chatbot = {
    send: (sessionId, message) => request('/ollama-chat/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message }),
    }),
    clearSession: (sessionId) => request('/ollama-chat/clear-session', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
    }),
};

export default { chatbot };
