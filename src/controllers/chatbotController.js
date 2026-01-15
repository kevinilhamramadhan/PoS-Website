/**
 * Chatbot Controller
 * Specialized endpoints for chatbot/AI integration
 * These endpoints are designed for function calling from AI assistants
 */

import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import OrderService from '../services/orderService.js';
import StockManager from '../services/stockManager.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/chatbot/menu
 * Get simplified menu for chatbot display
 * Returns products with availability status
 */
export const getMenu = asyncHandler(async (req, res) => {
    const products = await Product.findAvailableWithStock();

    // Format for chatbot consumption
    const menu = products
        .filter(p => p.is_available)
        .map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.selling_price,
            formatted_price: `Rp ${p.selling_price.toLocaleString('id-ID')}`,
            available: p.can_order,
            max_quantity: p.max_quantity,
            image_url: p.image_url
        }));

    res.json({
        success: true,
        message: 'Menu berhasil diambil',
        data: {
            menu,
            total_products: menu.length
        }
    });
});

/**
 * POST /api/chatbot/check-availability
 * Check if products are available for order
 * Input: array of products with quantities
 */
export const checkAvailability = asyncHandler(async (req, res) => {
    const { products } = req.body;

    const results = [];
    let allAvailable = true;

    for (const item of products) {
        let product;

        // Support both product_id and product_name
        if (item.product_id) {
            product = await Product.findById(item.product_id);
        } else if (item.product_name) {
            product = await Product.findByName(item.product_name);
        }

        if (!product) {
            results.push({
                product_name: item.product_name || item.product_id,
                found: false,
                available: false,
                message: 'Produk tidak ditemukan'
            });
            allAvailable = false;
            continue;
        }

        if (!product.is_available) {
            results.push({
                product_id: product.id,
                product_name: product.name,
                found: true,
                available: false,
                message: 'Produk sedang tidak tersedia'
            });
            allAvailable = false;
            continue;
        }

        // Check stock
        const maxQuantity = await StockManager.getMaxOrderableQuantity(product.id);
        const canFulfill = maxQuantity.max_quantity >= item.quantity;

        results.push({
            product_id: product.id,
            product_name: product.name,
            requested_quantity: item.quantity,
            found: true,
            available: canFulfill,
            max_quantity: maxQuantity.max_quantity,
            price: product.selling_price,
            subtotal: product.selling_price * item.quantity,
            message: canFulfill
                ? 'Tersedia'
                : `Stok tidak cukup. Maksimal ${maxQuantity.max_quantity} pcs`
        });

        if (!canFulfill) allAvailable = false;
    }

    res.json({
        success: true,
        data: {
            all_available: allAvailable,
            products: results,
            total: results.reduce((sum, r) => sum + (r.subtotal || 0), 0)
        }
    });
});

/**
 * POST /api/chatbot/create-order
 * Create order via chatbot
 * Supports customer lookup by email or creates guest order
 */
export const createOrder = asyncHandler(async (req, res) => {
    const { customer_email, customer_name, items, notes } = req.body;

    console.log(`🤖 Chatbot order request from: ${customer_email || 'guest'}`);

    // Find or create customer
    let customer;
    if (customer_email) {
        customer = await User.findByEmail(customer_email);

        if (!customer) {
            // For chatbot, we might want to create a guest account
            // Or require existing customer - depending on business rules
            throw ApiError.notFound(
                `Customer dengan email ${customer_email} tidak ditemukan. ` +
                `Silakan daftar terlebih dahulu.`
            );
        }
    } else {
        throw ApiError.badRequest('Email customer diperlukan untuk membuat order');
    }

    // Process items - support both product_id and product_name
    const processedItems = [];
    for (const item of items) {
        let product;

        if (item.product_id) {
            product = await Product.findById(item.product_id);
        } else if (item.product_name) {
            product = await Product.findByName(item.product_name);
        }

        if (!product) {
            throw ApiError.notFound(
                `Produk "${item.product_name || item.product_id}" tidak ditemukan`
            );
        }

        processedItems.push({
            product_id: product.id,
            product_name: product.name,
            quantity: item.quantity,
            unit_price: product.selling_price
        });
    }

    // Create order
    const order = await OrderService.createOrder({
        customer_id: customer.id,
        items: processedItems,
        notes: notes || 'Order via chatbot'
    });

    // Format response for chatbot
    res.status(201).json({
        success: true,
        message: `Order berhasil dibuat dengan nomor ${order.order_number}`,
        data: {
            order_id: order.id,
            order_number: order.order_number,
            customer: {
                name: customer.full_name,
                email: customer.email,
                phone: customer.phone
            },
            items: order.items.map(i => ({
                product: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                subtotal: i.subtotal,
                formatted_price: `Rp ${i.unit_price.toLocaleString('id-ID')}`,
                formatted_subtotal: `Rp ${i.subtotal.toLocaleString('id-ID')}`
            })),
            total: order.total_amount,
            formatted_total: `Rp ${order.total_amount.toLocaleString('id-ID')}`,
            status: order.status,
            created_at: order.created_at
        }
    });
});

/**
 * PUT /api/chatbot/update-order/:id
 * Update order via chatbot
 */
export const updateOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { customer_email, items, notes, action } = req.body;

    console.log(`🤖 Chatbot order update: ${id}`);

    // Get order
    const order = await Order.findById(id);
    if (!order) {
        // Try by order number
        const orderByNumber = await Order.findByOrderNumber(id);
        if (!orderByNumber) {
            throw ApiError.notFound(`Order dengan ID/nomor ${id} tidak ditemukan`);
        }
    }

    // Verify customer if email provided
    if (customer_email) {
        const customer = await User.findByEmail(customer_email);
        if (!customer || order.customer_id !== customer.id) {
            throw ApiError.forbidden('Email tidak cocok dengan pemilik order');
        }
    }

    // Handle different actions
    if (action === 'cancel') {
        const cancelledOrder = await OrderService.cancelOrder(
            order.id,
            order.customer_id,
            notes || 'Dibatalkan via chatbot'
        );

        return res.json({
            success: true,
            message: `Order ${order.order_number} berhasil dibatalkan`,
            data: {
                order_number: cancelledOrder.order_number,
                status: cancelledOrder.status
            }
        });
    }

    // Update items if provided
    if (items) {
        const processedItems = [];
        for (const item of items) {
            let product;

            if (item.product_id) {
                product = await Product.findById(item.product_id);
            } else if (item.product_name) {
                product = await Product.findByName(item.product_name);
            }

            if (!product) {
                throw ApiError.notFound(`Produk "${item.product_name || item.product_id}" tidak ditemukan`);
            }

            processedItems.push({
                product_id: product.id,
                quantity: item.quantity
            });
        }

        const updatedOrder = await OrderService.updateOrder(
            order.id,
            { items: processedItems, notes },
            order.customer_id
        );

        return res.json({
            success: true,
            message: `Order ${order.order_number} berhasil diupdate`,
            data: {
                order_id: updatedOrder.id,
                order_number: updatedOrder.order_number,
                items: updatedOrder.items,
                total: updatedOrder.total_amount,
                formatted_total: `Rp ${updatedOrder.total_amount.toLocaleString('id-ID')}`,
                status: updatedOrder.status
            }
        });
    }

    res.json({
        success: true,
        message: 'Tidak ada perubahan dilakukan',
        data: { order_number: order.order_number }
    });
});

/**
 * GET /api/chatbot/order-status/:id
 * Get order status for chatbot
 */
export const getOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Try by ID first, then by order number
    let order = await Order.findById(id);
    if (!order) {
        order = await Order.findByOrderNumber(id);
    }

    if (!order) {
        throw ApiError.notFound(`Order dengan ID/nomor ${id} tidak ditemukan`);
    }

    const statusMessages = {
        pending: 'Order sedang menunggu konfirmasi',
        processing: 'Order sedang diproses',
        completed: 'Order sudah selesai',
        cancelled: 'Order dibatalkan'
    };

    res.json({
        success: true,
        data: {
            order_number: order.order_number,
            status: order.status,
            status_message: statusMessages[order.status],
            total: order.total_amount,
            formatted_total: `Rp ${order.total_amount.toLocaleString('id-ID')}`,
            items_count: order.items.length,
            created_at: order.created_at,
            customer_name: order.customer?.full_name
        }
    });
});

/**
 * GET /api/chatbot/customer-orders/:email
 * Get orders for a customer by email
 */
export const getCustomerOrders = asyncHandler(async (req, res) => {
    const { email } = req.params;
    const { limit = 5 } = req.query;

    const customer = await User.findByEmail(email);
    if (!customer) {
        throw ApiError.notFound(`Customer dengan email ${email} tidak ditemukan`);
    }

    const { orders } = await Order.findAll({
        customer_id: customer.id,
        limit: parseInt(limit)
    });

    res.json({
        success: true,
        data: {
            customer: {
                name: customer.full_name,
                email: customer.email
            },
            orders: orders.map(o => ({
                order_number: o.order_number,
                status: o.status,
                total: o.total_amount,
                formatted_total: `Rp ${o.total_amount.toLocaleString('id-ID')}`,
                created_at: o.created_at
            })),
            total_orders: orders.length
        }
    });
});

export default {
    getMenu,
    checkAvailability,
    createOrder,
    updateOrder,
    getOrderStatus,
    getCustomerOrders
};
