/**
 * API Service
 * Handles all API calls to the backend
 */

const API_URL = '/api';

// Store token in memory
let authToken = localStorage.getItem('token');

/**
 * Set auth token
 */
export const setToken = (token) => {
    authToken = token;
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
};

/**
 * Get auth token
 */
export const getToken = () => authToken;

/**
 * Make API request
 */
const request = async (endpoint, options = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

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
// AUTH API
// ============================================

export const auth = {
    register: (userData) => request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    }),

    login: async (credentials) => {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
        if (data.data?.token) {
            setToken(data.data.token);
        }
        return data;
    },

    logout: () => {
        setToken(null);
    },

    me: () => request('/auth/me'),
};

// ============================================
// PRODUCTS API
// ============================================

export const products = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/products${query ? `?${query}` : ''}`);
    },

    get: (id) => request(`/products/${id}`),

    create: (data) => request('/products', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => request(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    delete: (id) => request(`/products/${id}`, {
        method: 'DELETE',
    }),

    getCostBreakdown: (id) => request(`/products/${id}/cost-breakdown`),
};

// ============================================
// INGREDIENTS API
// ============================================

export const ingredients = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/ingredients${query ? `?${query}` : ''}`);
    },

    get: (id) => request(`/ingredients/${id}`),

    create: (data) => request('/ingredients', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => request(`/ingredients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    delete: (id) => request(`/ingredients/${id}`, {
        method: 'DELETE',
    }),

    getLowStock: () => request('/ingredients/low-stock'),

    adjustStock: (id, data) => request(`/ingredients/${id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
};

// ============================================
// RECIPES API
// ============================================

export const recipes = {
    getByProduct: (productId) => request(`/recipes/product/${productId}`),

    create: (data) => request('/recipes', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    bulkUpdate: (data) => request('/recipes/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    delete: (id) => request(`/recipes/${id}`, {
        method: 'DELETE',
    }),
};

// ============================================
// ORDERS API
// ============================================

export const orders = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/orders${query ? `?${query}` : ''}`);
    },

    get: (id) => request(`/orders/${id}`),

    create: (data) => request('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => request(`/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    updateStatus: (id, status) => request(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    }),

    cancel: (id, reason = '') => request(`/orders/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
    }),

    getRevisions: (id) => request(`/orders/${id}/revisions`),
};

// ============================================
// REPORTS API
// ============================================

export const reports = {
    dashboard: () => request('/reports/dashboard'),
    salesSummary: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/reports/sales-summary${query ? `?${query}` : ''}`);
    },
    popularProducts: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/reports/popular-products${query ? `?${query}` : ''}`);
    },
    stockAlerts: () => request('/reports/stock-alerts'),
    profitMargin: () => request('/reports/profit-margin'),
};

// ============================================
// CHATBOT API
// ============================================

export const chatbot = {
    getMenu: () => request('/chatbot/menu'),
    checkAvailability: (products) => request('/chatbot/check-availability', {
        method: 'POST',
        body: JSON.stringify({ products }),
    }),
    createOrder: (data) => request('/chatbot/create-order', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
};

export default {
    auth,
    products,
    ingredients,
    recipes,
    orders,
    reports,
    chatbot,
    setToken,
    getToken,
};
