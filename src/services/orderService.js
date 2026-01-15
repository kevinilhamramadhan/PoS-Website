/**
 * Order Service
 * Handles order business logic: creation, updates, revisions
 */

import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockManager from './stockManager.js';
import { ApiError } from '../middlewares/errorHandler.js';

const OrderService = {
    /**
     * Create a new order with stock validation and deduction
     * 
     * @param {Object} orderData - { customer_id, items, notes }
     * @param {Array} orderData.items - Array of { product_id, quantity }
     * @returns {Object} Created order
     */
    async createOrder(orderData) {
        console.log(`📝 Creating order for customer: ${orderData.customer_id}`);

        // Validate products exist and get prices
        const itemsWithPrices = [];
        for (const item of orderData.items) {
            const product = await Product.findById(item.product_id);

            if (!product) {
                throw ApiError.notFound(`Produk dengan ID ${item.product_id} tidak ditemukan`);
            }

            if (!product.is_available) {
                throw ApiError.badRequest(`Produk "${product.name}" tidak tersedia`);
            }

            itemsWithPrices.push({
                product_id: product.id,
                product_name: product.name,
                quantity: item.quantity,
                unit_price: product.selling_price
            });
        }

        // Check stock availability
        const { canFulfill, shortages } = await StockManager.checkOrderStock(itemsWithPrices);

        if (!canFulfill) {
            const shortageMessages = shortages.map(s =>
                `${s.ingredient_name}: butuh ${s.required} ${s.unit}, tersedia ${s.available} ${s.unit}`
            );

            throw ApiError.badRequest(
                `Tidak bisa membuat order: stok bahan baku tidak cukup`,
                'INSUFFICIENT_STOCK',
                {
                    shortages,
                    messages: shortageMessages,
                    suggestion: 'Kurangi jumlah pesanan atau tunggu stok tersedia'
                }
            );
        }

        // Create order
        const order = await Order.create({
            customer_id: orderData.customer_id,
            items: itemsWithPrices,
            notes: orderData.notes
        });

        // Deduct stock
        await StockManager.deductOrderStock(order.id, itemsWithPrices);

        console.log(`✅ Order created: ${order.order_number}`);

        return order;
    },

    /**
     * Update an existing order
     * Tracks changes in order_revisions
     * 
     * @param {string} orderId - Order UUID
     * @param {Object} updateData - { items, notes }
     * @param {string} userId - User making the update
     * @returns {Object} Updated order
     */
    async updateOrder(orderId, updateData, userId) {
        console.log(`📝 Updating order: ${orderId}`);

        // Get current order
        const currentOrder = await Order.findById(orderId);
        if (!currentOrder) {
            throw ApiError.notFound(`Order dengan ID ${orderId} tidak ditemukan`);
        }

        // Cannot update completed or cancelled orders
        if (['completed', 'cancelled'].includes(currentOrder.status)) {
            throw ApiError.badRequest(
                `Tidak bisa mengupdate order dengan status ${currentOrder.status}`
            );
        }

        // If items are being updated
        if (updateData.items) {
            // First, return stock from current items
            await StockManager.returnOrderStock(orderId, currentOrder.items);

            // Validate new items and get prices
            const itemsWithPrices = [];
            for (const item of updateData.items) {
                const product = await Product.findById(item.product_id);

                if (!product) {
                    throw ApiError.notFound(`Produk dengan ID ${item.product_id} tidak ditemukan`);
                }

                itemsWithPrices.push({
                    product_id: product.id,
                    product_name: product.name,
                    quantity: item.quantity,
                    unit_price: product.selling_price
                });
            }

            // Check stock for new items
            const { canFulfill, shortages } = await StockManager.checkOrderStock(itemsWithPrices);

            if (!canFulfill) {
                // Return original stock and throw error
                await StockManager.deductOrderStock(orderId, currentOrder.items);

                const shortageMessages = shortages.map(s =>
                    `${s.ingredient_name}: butuh ${s.required} ${s.unit}, tersedia ${s.available} ${s.unit}`
                );

                throw ApiError.badRequest(
                    'Tidak bisa mengupdate order: stok tidak cukup',
                    'INSUFFICIENT_STOCK',
                    { shortages, messages: shortageMessages }
                );
            }

            updateData.items = itemsWithPrices;

            // Record revision for item changes
            await Order.createRevision({
                order_id: orderId,
                revised_by: userId,
                revision_type: 'update_quantity',
                old_value: { items: currentOrder.items },
                new_value: { items: itemsWithPrices },
                notes: 'Items updated'
            });

            // Deduct stock for new items
            await StockManager.deductOrderStock(orderId, itemsWithPrices);
        }

        // Update order
        const updatedOrder = await Order.update(orderId, updateData);

        console.log(`✅ Order updated: ${updatedOrder.order_number}`);

        return updatedOrder;
    },

    /**
     * Update order status
     * 
     * @param {string} orderId - Order UUID
     * @param {string} newStatus - New status
     * @param {string} userId - User making the change
     * @returns {Object} Updated order
     */
    async updateOrderStatus(orderId, newStatus, userId) {
        console.log(`📝 Updating order status: ${orderId} -> ${newStatus}`);

        const order = await Order.findById(orderId);
        if (!order) {
            throw ApiError.notFound(`Order dengan ID ${orderId} tidak ditemukan`);
        }

        const oldStatus = order.status;

        // Validate status transitions
        const validTransitions = {
            pending: ['processing', 'cancelled'],
            processing: ['completed', 'cancelled'],
            completed: [], // Cannot change from completed
            cancelled: []  // Cannot change from cancelled
        };

        if (!validTransitions[oldStatus].includes(newStatus)) {
            throw ApiError.badRequest(
                `Tidak bisa mengubah status dari ${oldStatus} ke ${newStatus}`
            );
        }

        // If cancelling, return stock
        if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            await StockManager.returnOrderStock(orderId, order.items);
        }

        // Record revision
        await Order.createRevision({
            order_id: orderId,
            revised_by: userId,
            revision_type: 'update_status',
            old_value: { status: oldStatus },
            new_value: { status: newStatus },
            notes: `Status changed from ${oldStatus} to ${newStatus}`
        });

        // Update status
        const updatedOrder = await Order.updateStatus(orderId, newStatus);

        console.log(`✅ Order status updated: ${updatedOrder.order_number} -> ${newStatus}`);

        return updatedOrder;
    },

    /**
     * Cancel an order
     * Returns stock to inventory
     * 
     * @param {string} orderId - Order UUID
     * @param {string} userId - User making the cancellation
     * @param {string} reason - Cancellation reason
     * @returns {Object} Cancelled order
     */
    async cancelOrder(orderId, userId, reason = '') {
        console.log(`📝 Cancelling order: ${orderId}`);

        const order = await Order.findById(orderId);
        if (!order) {
            throw ApiError.notFound(`Order dengan ID ${orderId} tidak ditemukan`);
        }

        if (order.status === 'cancelled') {
            throw ApiError.badRequest('Order sudah dibatalkan sebelumnya');
        }

        if (order.status === 'completed') {
            throw ApiError.badRequest('Tidak bisa membatalkan order yang sudah selesai');
        }

        // Return stock
        await StockManager.returnOrderStock(orderId, order.items);

        // Record revision
        await Order.createRevision({
            order_id: orderId,
            revised_by: userId,
            revision_type: 'cancel_order',
            old_value: { status: order.status },
            new_value: { status: 'cancelled' },
            notes: reason || 'Order cancelled'
        });

        // Update status
        const cancelledOrder = await Order.cancel(orderId);

        console.log(`✅ Order cancelled: ${cancelledOrder.order_number}`);

        return cancelledOrder;
    },

    /**
     * Get order with full details
     * 
     * @param {string} orderId - Order UUID
     * @returns {Object} Order with items and revisions
     */
    async getOrderDetails(orderId) {
        const order = await Order.findById(orderId);
        if (!order) {
            throw ApiError.notFound(`Order dengan ID ${orderId} tidak ditemukan`);
        }

        const revisions = await Order.getRevisions(orderId);

        return {
            ...order,
            revisions
        };
    },

    /**
     * Get orders for a customer
     * 
     * @param {string} customerId - Customer UUID
     * @param {Object} options - Pagination options
     * @returns {Object} Orders with pagination
     */
    async getCustomerOrders(customerId, options = {}) {
        return Order.findAll({
            ...options,
            customer_id: customerId
        });
    },

    /**
     * Get all orders (admin)
     * 
     * @param {Object} options - Filter and pagination options
     * @returns {Object} Orders with pagination
     */
    async getAllOrders(options = {}) {
        return Order.findAll(options);
    },

    /**
     * Add item to existing order
     * 
     * @param {string} orderId - Order UUID
     * @param {Object} item - { product_id, quantity }
     * @param {string} userId - User making the change
     * @returns {Object} Updated order
     */
    async addOrderItem(orderId, item, userId) {
        const order = await Order.findById(orderId);
        if (!order) {
            throw ApiError.notFound(`Order tidak ditemukan`);
        }

        if (['completed', 'cancelled'].includes(order.status)) {
            throw ApiError.badRequest(`Tidak bisa menambah item ke order ${order.status}`);
        }

        // Check if product already in order
        const existingItem = order.items.find(i => i.product_id === item.product_id);

        let newItems;
        if (existingItem) {
            newItems = order.items.map(i =>
                i.product_id === item.product_id
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i
            );
        } else {
            const product = await Product.findById(item.product_id);
            if (!product) {
                throw ApiError.notFound(`Produk tidak ditemukan`);
            }

            newItems = [...order.items, {
                product_id: item.product_id,
                quantity: item.quantity
            }];
        }

        // Record revision
        await Order.createRevision({
            order_id: orderId,
            revised_by: userId,
            revision_type: 'add_item',
            old_value: null,
            new_value: { added_item: item },
            notes: `Added ${item.quantity}x product`
        });

        return this.updateOrder(orderId, { items: newItems }, userId);
    },

    /**
     * Remove item from order
     * 
     * @param {string} orderId - Order UUID
     * @param {string} productId - Product to remove
     * @param {string} userId - User making the change
     * @returns {Object} Updated order
     */
    async removeOrderItem(orderId, productId, userId) {
        const order = await Order.findById(orderId);
        if (!order) {
            throw ApiError.notFound(`Order tidak ditemukan`);
        }

        if (['completed', 'cancelled'].includes(order.status)) {
            throw ApiError.badRequest(`Tidak bisa menghapus item dari order ${order.status}`);
        }

        const removedItem = order.items.find(i => i.product_id === productId);
        if (!removedItem) {
            throw ApiError.notFound(`Item tidak ditemukan dalam order`);
        }

        const newItems = order.items.filter(i => i.product_id !== productId);

        if (newItems.length === 0) {
            throw ApiError.badRequest('Tidak bisa menghapus semua item. Gunakan cancel order.');
        }

        // Record revision
        await Order.createRevision({
            order_id: orderId,
            revised_by: userId,
            revision_type: 'remove_item',
            old_value: { removed_item: removedItem },
            new_value: null,
            notes: `Removed product from order`
        });

        return this.updateOrder(orderId, { items: newItems }, userId);
    }
};

export default OrderService;
