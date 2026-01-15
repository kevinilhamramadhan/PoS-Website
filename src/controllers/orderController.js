/**
 * Order Controller
 * Handles order CRUD, status updates, and revisions
 */

import Order from '../models/Order.js';
import OrderService from '../services/orderService.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/orders
 * List orders (admin: all, customer: own orders only)
 */
export const getOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const user = req.user;

    let result;
    if (user.role === 'admin') {
        // Admin can see all orders
        result = await OrderService.getAllOrders({
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });
    } else {
        // Customer can only see their own orders
        result = await OrderService.getCustomerOrders(user.id, {
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });
    }

    res.json({
        success: true,
        data: result
    });
});

/**
 * GET /api/orders/:id
 * Get single order detail
 */
export const getOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    const order = await OrderService.getOrderDetails(id);

    // Check if customer is accessing their own order
    if (user.role !== 'admin' && order.customer_id !== user.id) {
        throw ApiError.forbidden('Anda tidak memiliki akses ke order ini');
    }

    res.json({
        success: true,
        data: { order }
    });
});

/**
 * POST /api/orders
 * Create new order with automatic stock deduction
 */
export const createOrder = asyncHandler(async (req, res) => {
    const { items, notes } = req.body;
    const user = req.user;

    console.log(`📝 Creating order for user: ${user.email}`);

    const order = await OrderService.createOrder({
        customer_id: user.id,
        items,
        notes
    });

    res.status(201).json({
        success: true,
        message: 'Order berhasil dibuat',
        data: { order }
    });
});

/**
 * PUT /api/orders/:id
 * Update order (items and notes)
 * Records changes in order_revisions
 */
export const updateOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { items, notes } = req.body;
    const user = req.user;

    // Get order to check ownership
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
        throw ApiError.notFound(`Order dengan ID ${id} tidak ditemukan`);
    }

    // Check access: admin or order owner
    if (user.role !== 'admin' && existingOrder.customer_id !== user.id) {
        throw ApiError.forbidden('Anda tidak memiliki akses untuk mengupdate order ini');
    }

    const order = await OrderService.updateOrder(id, { items, notes }, user.id);

    res.json({
        success: true,
        message: 'Order berhasil diupdate',
        data: { order }
    });
});

/**
 * PATCH /api/orders/:id/status
 * Update order status
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    // Only admin can update status to processing/completed
    // Customer can only cancel their own pending orders
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
        throw ApiError.notFound(`Order dengan ID ${id} tidak ditemukan`);
    }

    if (user.role !== 'admin') {
        if (existingOrder.customer_id !== user.id) {
            throw ApiError.forbidden('Anda tidak memiliki akses ke order ini');
        }
        if (status !== 'cancelled') {
            throw ApiError.forbidden('Customer hanya bisa membatalkan order');
        }
        if (existingOrder.status !== 'pending') {
            throw ApiError.badRequest('Hanya order pending yang bisa dibatalkan');
        }
    }

    const order = await OrderService.updateOrderStatus(id, status, user.id);

    res.json({
        success: true,
        message: `Status order berhasil diubah menjadi ${status}`,
        data: { order }
    });
});

/**
 * DELETE /api/orders/:id
 * Cancel/delete order with stock return
 */
export const deleteOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    // Get order to check ownership
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
        throw ApiError.notFound(`Order dengan ID ${id} tidak ditemukan`);
    }

    // Check access
    if (user.role !== 'admin' && existingOrder.customer_id !== user.id) {
        throw ApiError.forbidden('Anda tidak memiliki akses untuk membatalkan order ini');
    }

    // Customer can only cancel pending orders
    if (user.role !== 'admin' && existingOrder.status !== 'pending') {
        throw ApiError.badRequest('Hanya order pending yang bisa dibatalkan');
    }

    const order = await OrderService.cancelOrder(id, user.id, reason);

    res.json({
        success: true,
        message: 'Order berhasil dibatalkan',
        data: { order }
    });
});

/**
 * GET /api/orders/:id/revisions
 * Get order revision history
 */
export const getOrderRevisions = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    // Get order to check ownership
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
        throw ApiError.notFound(`Order dengan ID ${id} tidak ditemukan`);
    }

    // Check access
    if (user.role !== 'admin' && existingOrder.customer_id !== user.id) {
        throw ApiError.forbidden('Anda tidak memiliki akses ke order ini');
    }

    const revisions = await Order.getRevisions(id);

    res.json({
        success: true,
        data: {
            order_id: id,
            order_number: existingOrder.order_number,
            revisions
        }
    });
});

/**
 * POST /api/orders/:id/items
 * Add item to existing order
 */
export const addOrderItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { product_id, quantity } = req.body;
    const user = req.user;

    // Get order to check ownership
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
        throw ApiError.notFound(`Order dengan ID ${id} tidak ditemukan`);
    }

    // Check access
    if (user.role !== 'admin' && existingOrder.customer_id !== user.id) {
        throw ApiError.forbidden('Anda tidak memiliki akses untuk mengupdate order ini');
    }

    const order = await OrderService.addOrderItem(
        id,
        { product_id, quantity },
        user.id
    );

    res.json({
        success: true,
        message: 'Item berhasil ditambahkan ke order',
        data: { order }
    });
});

/**
 * DELETE /api/orders/:id/items/:productId
 * Remove item from order
 */
export const removeOrderItem = asyncHandler(async (req, res) => {
    const { id, productId } = req.params;
    const user = req.user;

    // Get order to check ownership
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
        throw ApiError.notFound(`Order dengan ID ${id} tidak ditemukan`);
    }

    // Check access
    if (user.role !== 'admin' && existingOrder.customer_id !== user.id) {
        throw ApiError.forbidden('Anda tidak memiliki akses untuk mengupdate order ini');
    }

    const order = await OrderService.removeOrderItem(id, productId, user.id);

    res.json({
        success: true,
        message: 'Item berhasil dihapus dari order',
        data: { order }
    });
});

export default {
    getOrders,
    getOrder,
    createOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    getOrderRevisions,
    addOrderItem,
    removeOrderItem
};
