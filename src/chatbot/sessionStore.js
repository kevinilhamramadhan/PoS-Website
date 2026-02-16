/**
 * Session Store - In-memory session management for chatbot
 * Tracks conversation history and cart state per session
 * 
 * In production, replace with Redis or database-backed storage
 */

// Session storage: Map<sessionId, SessionData>
const sessions = new Map();

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Session data structure:
 * {
 *   cart: [{ product_name, quantity, price }],
 *   history: [{ role, content }],
 *   lastActivity: Date,
 *   customerEmail: string | null
 * }
 */

function getSession(sessionId) {
    let session = sessions.get(sessionId);

    if (!session) {
        session = {
            cart: [],
            history: [],
            lastActivity: Date.now(),
            customerEmail: null
        };
        sessions.set(sessionId, session);
    }

    session.lastActivity = Date.now();
    return session;
}

function addToCart(sessionId, productName, quantity = 1, price = null) {
    const session = getSession(sessionId);

    // Check if item already exists in cart
    const existingIndex = session.cart.findIndex(
        item => item.product_name.toLowerCase() === productName.toLowerCase()
    );

    if (existingIndex >= 0) {
        // Update quantity
        session.cart[existingIndex].quantity += quantity;
        if (price) session.cart[existingIndex].price = price;
    } else {
        session.cart.push({
            product_name: productName,
            quantity,
            price
        });
    }

    return session.cart;
}

function removeFromCart(sessionId, productName) {
    const session = getSession(sessionId);

    const index = session.cart.findIndex(
        item => item.product_name.toLowerCase() === productName.toLowerCase()
    );

    if (index >= 0) {
        const removed = session.cart.splice(index, 1)[0];
        return { removed, cart: session.cart };
    }

    return { removed: null, cart: session.cart };
}

function getCart(sessionId) {
    const session = getSession(sessionId);
    return session.cart;
}

function clearCart(sessionId) {
    const session = getSession(sessionId);
    session.cart = [];
    return session.cart;
}

function addMessage(sessionId, role, content) {
    const session = getSession(sessionId);
    session.history.push({ role, content });

    // Keep last 20 messages to avoid context overflow
    if (session.history.length > 20) {
        session.history = session.history.slice(-20);
    }
}

function getHistory(sessionId) {
    const session = getSession(sessionId);
    return session.history;
}

function clearSession(sessionId) {
    sessions.delete(sessionId);
}

// Cleanup expired sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
            sessions.delete(id);
        }
    }
}, 5 * 60 * 1000);

export default {
    getSession,
    addToCart,
    removeFromCart,
    getCart,
    clearCart,
    addMessage,
    getHistory,
    clearSession
};
