/**
 * Ollama Chatbot Controller
 * Handler untuk endpoint chat - proxies to Python LangServe service
 * Now with cart state management and conversation history
 */

import sessionStore from '../sessionStore.js';

/**
 * POST /api/ollama-chat/chat
 * Handle chat request dari frontend - proxies to Python LangServe service
 * 
 * Body: { sessionId: string, message: string }
 * Response: { success: boolean, data: { response: string, toolUsed?: boolean, cart?: array } }
 */
export const handleChat = async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        // Validasi input
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId diperlukan'
            });
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'message diperlukan dan tidak boleh kosong'
            });
        }

        const userMessage = message.trim();
        console.log(`💬 Chat request: sessionId=${sessionId}, message="${userMessage.substring(0, 50)}..."`);

        // Save user message to history
        sessionStore.addMessage(sessionId, 'user', userMessage);

        // Get current cart and history for context
        const currentCart = sessionStore.getCart(sessionId);
        const history = sessionStore.getHistory(sessionId);

        // Proxy request to Python LangServe service
        const pythonServiceUrl = process.env.PYTHON_CHATBOT_URL || 'http://localhost:8001';

        // Send full conversation history + cart state to Python
        const response = await fetch(`${pythonServiceUrl}/chat/invoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: {
                    messages: history,
                    cart: currentCart,
                    session_id: sessionId
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Python service error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`🤖 Python service response:`, JSON.stringify(data).substring(0, 300));

        // Extract response from LangServe format
        const outputObj = data.output || {};
        let aiResponse = '';
        let toolUsed = false;
        let toolResults = null;
        let cartAction = null;

        if (typeof outputObj === 'object') {
            aiResponse = outputObj.output || '';
            toolUsed = outputObj.tool_used || false;
            toolResults = outputObj.tool_results || null;
            cartAction = outputObj.cart_action || null;

            // Also extract cart actions from individual tool results if not at top level
            if (!cartAction && toolResults && toolResults.length > 0) {
                for (const tr of toolResults) {
                    const data = tr.data || {};
                    if (data.cart_action) {
                        cartAction = data.cart_action;
                        break;
                    }
                }
            }

            // Handle cart actions returned from Python
            if (cartAction) {
                handleCartAction(sessionId, cartAction);
            }

            // If dialog model returned empty but we have tool results, build a response
            if (!aiResponse && toolResults && toolResults.length > 0) {
                aiResponse = buildFallbackResponse(toolResults, sessionId);
            }
        } else if (typeof outputObj === 'string') {
            aiResponse = outputObj;
        }

        if (!aiResponse) {
            aiResponse = 'Maaf, tidak ada respons.';
        }

        // Strip markdown formatting since frontend renders plain text
        aiResponse = stripMarkdown(aiResponse);

        // Save assistant response to history
        sessionStore.addMessage(sessionId, 'assistant', aiResponse);

        // Get updated cart
        const updatedCart = sessionStore.getCart(sessionId);

        // Return response
        return res.json({
            success: true,
            data: {
                response: aiResponse,
                toolUsed: toolUsed,
                toolResults: toolResults,
                cart: updatedCart
            }
        });

    } catch (error) {
        console.error(`❌ Chat controller error: ${error.message}`);

        // Handle specific errors
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
            return res.status(503).json({
                success: false,
                error: 'Maaf, toko sedang offline. Silakan coba lagi nanti atau hubungi admin.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan internal. Silakan coba lagi.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Handle cart actions from Python service
 */
function handleCartAction(sessionId, action) {
    const { type, items } = action;

    if (type === 'add' && Array.isArray(items)) {
        for (const item of items) {
            sessionStore.addToCart(sessionId, item.product_name, item.quantity || 1, item.price || null);
            console.log(`🛒 Added to cart: ${item.quantity || 1}x ${item.product_name}`);
        }
    } else if (type === 'remove' && Array.isArray(items)) {
        for (const item of items) {
            sessionStore.removeFromCart(sessionId, item.product_name);
            console.log(`🗑️ Removed from cart: ${item.product_name}`);
        }
    } else if (type === 'clear') {
        sessionStore.clearCart(sessionId);
        console.log(`🗑️ Cart cleared`);
    }
}

/**
 * Build fallback response from tool results when dialog model returns empty
 */
function buildFallbackResponse(toolResults, sessionId) {
    const parts = [];
    for (const tr of toolResults) {
        const result = tr.data || tr.result || {};

        if (result.success && result.menu) {
            // get_menu response
            const menuText = result.menu.map(m => {
                let line = `• ${m.name} - Rp ${Number(m.price).toLocaleString('id-ID')}`;
                if (m.description) line += `\n  ${m.description}`;
                return line;
            }).join('\n');
            parts.push(`🧁 Menu Bakery PoS:\n\n${menuText}\n\nSilakan tanyakan jika ingin tahu lebih lanjut!`);
        } else if (result.success && result.order) {
            // Order was confirmed and created
            parts.push(`✅ Pesanan berhasil dibuat!\nNomor: ${result.order.order_number}\nTotal: ${result.order.formatted_total || 'Rp ' + result.order.total_amount}\n\nTerima kasih sudah berbelanja di Bakery PoS! 🧁`);
        } else if (result.success && result.cart_action) {
            // add_to_cart or remove_from_cart response
            if (result.message) parts.push(result.message);
            // Show updated cart
            const cart = sessionStore.getCart(sessionId);
            if (cart.length > 0) {
                parts.push('\n' + formatCartMessage(cart));
            }
        } else if (result.success && result.cart_updated) {
            // view_cart response
            const cart = sessionStore.getCart(sessionId);
            parts.push(formatCartMessage(cart));
        } else if (result.success && result.confirm_order) {
            // confirm_order signal (order creation handled separately)
            if (result.message) parts.push(result.message);
        } else if (result.message) {
            parts.push(result.message);
        } else if (result.success && result.available !== undefined) {
            const status = result.available ? '✅ Tersedia' : '❌ Tidak tersedia';
            parts.push(`${status}: ${result.product_name || 'Produk'}${result.price ? ' - Rp ' + Number(result.price).toLocaleString('id-ID') : ''}${result.message ? '\n' + result.message : ''}`);
        }
    }
    const response = parts.join('\n') || 'Permintaan berhasil diproses.';
    console.log(`⚠️ Dialog model empty, built response from tool results: ${response.substring(0, 100)}`);
    return response;
}

/**
 * Format cart contents into a readable message
 */
function formatCartMessage(cart) {
    if (!cart || cart.length === 0) {
        return '🛒 Keranjang Anda kosong.';
    }

    const items = cart.map(item => {
        let line = `• ${item.quantity}x ${item.product_name}`;
        if (item.price) {
            const subtotal = Number(item.price) * item.quantity;
            line += ` - Rp ${subtotal.toLocaleString('id-ID')}`;
        }
        return line;
    }).join('\n');

    let total = 0;
    let hasAllPrices = true;
    for (const item of cart) {
        if (item.price) {
            total += Number(item.price) * item.quantity;
        } else {
            hasAllPrices = false;
        }
    }

    let msg = `🛒 Keranjang Anda:\n\n${items}`;
    if (hasAllPrices && total > 0) {
        msg += `\n\nTotal: Rp ${total.toLocaleString('id-ID')}`;
    }
    msg += '\n\nKetik "konfirmasi pesanan" untuk membuat pesanan, atau tambah item lain.';
    return msg;
}

/**
 * Strip markdown formatting since frontend renders plain text
 */
function stripMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`(.+?)`/g, '$1');
}

/**
 * POST /api/ollama-chat/clear-session
 * Clear conversation history dan cart untuk session tertentu
 * 
 * Body: { sessionId: string }
 */
export const clearSession = async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'sessionId diperlukan'
            });
        }

        sessionStore.clearSession(sessionId);
        console.log(`🗑️ Session cleared: ${sessionId}`);

        return res.json({
            success: true,
            message: 'Session berhasil dihapus'
        });

    } catch (error) {
        console.error(`❌ Clear session error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: 'Gagal menghapus session'
        });
    }
};

/**
 * GET /api/ollama-chat/cart/:sessionId
 * Get current cart for a session
 */
export const getCartEndpoint = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const cart = sessionStore.getCart(sessionId);

        return res.json({
            success: true,
            data: { cart }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Gagal mengambil keranjang'
        });
    }
};

export default {
    handleChat,
    clearSession,
    getCartEndpoint
};
