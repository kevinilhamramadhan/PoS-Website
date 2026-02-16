/**
 * Order Model
 * Handles orders, order items, and order revisions
 */

import { query, getClient } from '../utils/db.js';

const Order = {
    /**
     * Find order by ID with items
     * @param {string} id - Order UUID
     * @returns {Object|null} Order with items or null
     */
    async findById(id) {
        const { rows: orderRows } = await query(
            `SELECT o.*,
                    json_build_object('id', u.id, 'email', u.email, 'full_name', u.full_name, 'phone', u.phone) AS customer
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             WHERE o.id = $1`,
            [id]
        );

        if (orderRows.length === 0) return null;
        const order = orderRows[0];

        const { rows: items } = await query(
            `SELECT oi.id, oi.quantity, oi.unit_price, oi.subtotal,
                    p.id AS product_id, p.name AS product_name, p.image_url AS product_image
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [id]
        );

        return {
            ...order,
            items: items.map(item => ({
                id: item.id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_image: item.product_image,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            }))
        };
    },

    /**
     * Find order by order number
     * @param {string} orderNumber - Order number (ORD-YYYYMMDD-XXX)
     * @returns {Object|null} Order or null
     */
    async findByOrderNumber(orderNumber) {
        const { rows } = await query(
            'SELECT id FROM orders WHERE order_number = $1',
            [orderNumber]
        );

        if (rows.length === 0) return null;
        return this.findById(rows[0].id);
    },

    /**
     * Get all orders with pagination
     * @param {Object} options - { page, limit, status, customer_id }
     * @returns {Object} { orders, total, page, limit, totalPages }
     */
    async findAll({ page = 1, limit = 20, status = null, customer_id = null } = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (status) {
            conditions.push(`o.status = $${paramIdx++}`);
            params.push(status);
        }
        if (customer_id) {
            conditions.push(`o.customer_id = $${paramIdx++}`);
            params.push(customer_id);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await query(
            `SELECT COUNT(*) FROM orders o ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const offset = (page - 1) * limit;
        const { rows } = await query(
            `SELECT o.*,
                    json_build_object('id', u.id, 'email', u.email, 'full_name', u.full_name) AS customer
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             ${whereClause}
             ORDER BY o.created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        return {
            orders: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Generate order number
     * Format: ORD-YYYYMMDD-XXX
     * @returns {string} Order number
     */
    async generateOrderNumber() {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `ORD-${dateStr}-`;

        const { rows } = await query(
            "SELECT COUNT(*) FROM orders WHERE order_number LIKE $1",
            [`${prefix}%`]
        );

        const sequence = String(parseInt(rows[0].count) + 1).padStart(3, '0');
        return `${prefix}${sequence}`;
    },

    /**
     * Create a new order
     * @param {Object} orderData - { customer_id, items, notes }
     * @param {Array} orderData.items - Array of { product_id, quantity, unit_price }
     * @returns {Object} Created order with items
     */
    async create(orderData) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const orderNumber = await this.generateOrderNumber();
            const totalAmount = orderData.items.reduce((sum, item) =>
                sum + (item.unit_price * item.quantity), 0);

            // Create order
            const { rows: orderRows } = await client.query(
                `INSERT INTO orders (customer_id, order_number, total_amount, status, notes)
                 VALUES ($1, $2, $3, 'pending', $4)
                 RETURNING *`,
                [orderData.customer_id, orderNumber, totalAmount, orderData.notes || null]
            );
            const order = orderRows[0];

            // Create order items
            const items = [];
            for (const item of orderData.items) {
                const subtotal = item.unit_price * item.quantity;
                const { rows: itemRows } = await client.query(
                    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
                    [order.id, item.product_id, item.quantity, item.unit_price, subtotal]
                );
                items.push(itemRows[0]);
            }

            await client.query('COMMIT');

            // Fetch product names for items
            const { rows: detailItems } = await query(
                `SELECT oi.id, oi.quantity, oi.unit_price, oi.subtotal,
                        p.id AS product_id, p.name AS product_name
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = $1`,
                [order.id]
            );

            console.log(`✅ Order created: ${orderNumber}`);
            return {
                ...order,
                items: detailItems.map(item => ({
                    id: item.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    subtotal: item.subtotal
                }))
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error creating order:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update order status
     * @param {string} id - Order UUID
     * @param {string} status - New status
     * @returns {Object} Updated order
     */
    async updateStatus(id, status) {
        const { rows } = await query(
            'UPDATE orders SET status = $2 WHERE id = $1 RETURNING *',
            [id, status]
        );

        if (rows.length === 0) throw new Error('Order not found');
        console.log(`✅ Order ${rows[0].order_number} status: ${status}`);
        return rows[0];
    },

    /**
     * Update order (full update with items)
     * @param {string} id - Order UUID
     * @param {Object} updateData - { items, notes }
     * @returns {Object} Updated order
     */
    async update(id, updateData) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            if (updateData.notes !== undefined) {
                await client.query(
                    'UPDATE orders SET notes = $2 WHERE id = $1',
                    [id, updateData.notes]
                );
            }

            if (updateData.items) {
                await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);

                const totalAmount = updateData.items.reduce((sum, item) =>
                    sum + (item.unit_price * item.quantity), 0);

                await client.query(
                    'UPDATE orders SET total_amount = $2 WHERE id = $1',
                    [id, totalAmount]
                );

                for (const item of updateData.items) {
                    const subtotal = item.unit_price * item.quantity;
                    await client.query(
                        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, item.product_id, item.quantity, item.unit_price, subtotal]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        return this.findById(id);
    },

    /**
     * Cancel order
     * @param {string} id - Order UUID
     * @returns {Object} Cancelled order
     */
    async cancel(id) {
        return this.updateStatus(id, 'cancelled');
    },

    /**
     * Delete order
     * @param {string} id - Order UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        await query('DELETE FROM orders WHERE id = $1', [id]);
        console.log(`✅ Order deleted: ${id}`);
        return true;
    },

    /**
     * Get order items
     * @param {string} orderId - Order UUID
     * @returns {Array} Order items
     */
    async getItems(orderId) {
        const { rows } = await query(
            `SELECT oi.*,
                    json_build_object('id', p.id, 'name', p.name, 'image_url', p.image_url) AS products
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = $1`,
            [orderId]
        );
        return rows;
    },

    // ============================================
    // ORDER REVISIONS
    // ============================================

    /**
     * Create order revision
     * @param {Object} revisionData - { order_id, revised_by, revision_type, old_value, new_value, notes }
     * @returns {Object} Created revision
     */
    async createRevision(revisionData) {
        const { rows } = await query(
            `INSERT INTO order_revisions (order_id, revised_by, revision_type, old_value, new_value, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                revisionData.order_id,
                revisionData.revised_by,
                revisionData.revision_type,
                revisionData.old_value ? JSON.stringify(revisionData.old_value) : null,
                revisionData.new_value ? JSON.stringify(revisionData.new_value) : null,
                revisionData.notes || null
            ]
        );

        console.log(`✅ Revision recorded: ${revisionData.revision_type}`);
        return rows[0];
    },

    /**
     * Get order revisions
     * @param {string} orderId - Order UUID
     * @returns {Array} Order revisions
     */
    async getRevisions(orderId) {
        const { rows } = await query(
            `SELECT orv.*,
                    json_build_object('id', u.id, 'email', u.email, 'full_name', u.full_name) AS revised_by_user
             FROM order_revisions orv
             JOIN users u ON orv.revised_by = u.id
             WHERE orv.order_id = $1
             ORDER BY orv.created_at DESC`,
            [orderId]
        );
        return rows;
    },

    // ============================================
    // REPORTS
    // ============================================

    /**
     * Get sales summary
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Object} Sales summary
     */
    async getSalesSummary(startDate, endDate) {
        const { rows } = await query(
            `SELECT total_amount, status, created_at FROM orders
             WHERE created_at >= $1 AND created_at <= $2
             AND status IN ('completed', 'processing')`,
            [startDate.toISOString(), endDate.toISOString()]
        );

        const totalSales = rows.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
        const orderCount = rows.length;

        return {
            total_sales: totalSales,
            order_count: orderCount,
            average_order_value: orderCount > 0 ? totalSales / orderCount : 0,
            start_date: startDate,
            end_date: endDate
        };
    },

    /**
     * Get popular products
     * @param {number} limit - Number of products to return
     * @param {Date} startDate - Optional start date
     * @param {Date} endDate - Optional end date
     * @returns {Array} Popular products
     */
    async getPopularProducts(limit = 10, startDate = null, endDate = null) {
        const conditions = ["o.status IN ('completed', 'processing')"];
        const params = [];
        let paramIdx = 1;

        if (startDate) {
            conditions.push(`o.created_at >= $${paramIdx++}`);
            params.push(startDate.toISOString());
        }
        if (endDate) {
            conditions.push(`o.created_at <= $${paramIdx++}`);
            params.push(endDate.toISOString());
        }

        const { rows } = await query(
            `SELECT oi.product_id, p.name AS product_name, p.selling_price,
                    SUM(oi.quantity) AS total_quantity,
                    SUM(oi.subtotal) AS total_revenue,
                    COUNT(*) AS order_count
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN products p ON oi.product_id = p.id
             WHERE ${conditions.join(' AND ')}
             GROUP BY oi.product_id, p.name, p.selling_price
             ORDER BY total_quantity DESC
             LIMIT $${paramIdx}`,
            [...params, limit]
        );

        return rows.map(r => ({
            product_id: r.product_id,
            product_name: r.product_name,
            selling_price: parseFloat(r.selling_price),
            total_quantity: parseInt(r.total_quantity),
            total_revenue: parseFloat(r.total_revenue),
            order_count: parseInt(r.order_count)
        }));
    }
};

export default Order;
