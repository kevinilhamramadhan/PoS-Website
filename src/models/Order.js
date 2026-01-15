/**
 * Order Model
 * Handles orders, order items, and order revisions
 */

import supabase from '../utils/supabaseClient.js';

const Order = {
    /**
     * Find order by ID with items
     * @param {string} id - Order UUID
     * @returns {Object|null} Order with items or null
     */
    async findById(id) {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
        *,
        users!orders_customer_id_fkey (id, email, full_name, phone)
      `)
            .eq('id', id)
            .single();

        if (orderError) {
            if (orderError.code === 'PGRST116') return null;
            console.error('❌ Error finding order:', orderError);
            throw orderError;
        }

        // Get order items
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        products (id, name, image_url)
      `)
            .eq('order_id', id);

        if (itemsError) {
            console.error('❌ Error finding order items:', itemsError);
            throw itemsError;
        }

        return {
            ...order,
            customer: order.users,
            items: items.map(item => ({
                id: item.id,
                product_id: item.products.id,
                product_name: item.products.name,
                product_image: item.products.image_url,
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
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('order_number', orderNumber)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error finding order by number:', error);
            throw error;
        }

        if (data) {
            return this.findById(data.id);
        }
        return null;
    },

    /**
     * Get all orders with pagination
     * @param {Object} options - { page, limit, status, customer_id }
     * @returns {Object} { orders, total, page, limit, totalPages }
     */
    async findAll({ page = 1, limit = 20, status = null, customer_id = null } = {}) {
        let query = supabase
            .from('orders')
            .select(`
        *,
        users!orders_customer_id_fkey (id, email, full_name)
      `, { count: 'exact' });

        if (status) {
            query = query.eq('status', status);
        }

        if (customer_id) {
            query = query.eq('customer_id', customer_id);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('❌ Error finding orders:', error);
            throw error;
        }

        return {
            orders: data.map(o => ({
                ...o,
                customer: o.users
            })),
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
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

        // Count today's orders
        const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .like('order_number', `${prefix}%`);

        if (error) {
            console.error('❌ Error counting orders:', error);
            throw error;
        }

        const sequence = String(count + 1).padStart(3, '0');
        return `${prefix}${sequence}`;
    },

    /**
     * Create a new order
     * @param {Object} orderData - { customer_id, items, notes }
     * @param {Array} orderData.items - Array of { product_id, quantity, unit_price }
     * @returns {Object} Created order with items
     */
    async create(orderData) {
        const orderNumber = await this.generateOrderNumber();

        // Calculate total
        const totalAmount = orderData.items.reduce((sum, item) => {
            return sum + (item.unit_price * item.quantity);
        }, 0);

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                customer_id: orderData.customer_id,
                order_number: orderNumber,
                total_amount: totalAmount,
                status: 'pending',
                notes: orderData.notes || null
            })
            .select('*')
            .single();

        if (orderError) {
            console.error('❌ Error creating order:', orderError);
            throw orderError;
        }

        // Create order items
        const itemsToInsert = orderData.items.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price * item.quantity
        }));

        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert)
            .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        products (id, name)
      `);

        if (itemsError) {
            console.error('❌ Error creating order items:', itemsError);
            throw itemsError;
        }

        console.log(`✅ Order created: ${orderNumber}`);
        return {
            ...order,
            items: items.map(item => ({
                id: item.id,
                product_id: item.products.id,
                product_name: item.products.name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            }))
        };
    },

    /**
     * Update order status
     * @param {string} id - Order UUID
     * @param {string} status - New status
     * @returns {Object} Updated order
     */
    async updateStatus(id, status) {
        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error updating order status:', error);
            throw error;
        }

        console.log(`✅ Order ${data.order_number} status: ${status}`);
        return data;
    },

    /**
     * Update order (full update with items)
     * @param {string} id - Order UUID
     * @param {Object} updateData - { items, notes }
     * @returns {Object} Updated order
     */
    async update(id, updateData) {
        // Update order notes if provided
        if (updateData.notes !== undefined) {
            await supabase
                .from('orders')
                .update({ notes: updateData.notes })
                .eq('id', id);
        }

        // Update items if provided
        if (updateData.items) {
            // Delete existing items
            await supabase
                .from('order_items')
                .delete()
                .eq('order_id', id);

            // Calculate new total
            const totalAmount = updateData.items.reduce((sum, item) => {
                return sum + (item.unit_price * item.quantity);
            }, 0);

            // Update order total
            await supabase
                .from('orders')
                .update({ total_amount: totalAmount })
                .eq('id', id);

            // Insert new items
            const itemsToInsert = updateData.items.map(item => ({
                order_id: id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.unit_price * item.quantity
            }));

            await supabase
                .from('order_items')
                .insert(itemsToInsert);
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
        // Order items will be deleted by CASCADE
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error deleting order:', error);
            throw error;
        }

        console.log(`✅ Order deleted: ${id}`);
        return true;
    },

    /**
     * Get order items
     * @param {string} orderId - Order UUID
     * @returns {Array} Order items
     */
    async getItems(orderId) {
        const { data, error } = await supabase
            .from('order_items')
            .select(`
        *,
        products (id, name, image_url)
      `)
            .eq('order_id', orderId);

        if (error) {
            console.error('❌ Error getting order items:', error);
            throw error;
        }

        return data;
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
        const { data, error } = await supabase
            .from('order_revisions')
            .insert({
                order_id: revisionData.order_id,
                revised_by: revisionData.revised_by,
                revision_type: revisionData.revision_type,
                old_value: revisionData.old_value || null,
                new_value: revisionData.new_value || null,
                notes: revisionData.notes || null
            })
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error creating order revision:', error);
            throw error;
        }

        console.log(`✅ Revision recorded: ${revisionData.revision_type}`);
        return data;
    },

    /**
     * Get order revisions
     * @param {string} orderId - Order UUID
     * @returns {Array} Order revisions
     */
    async getRevisions(orderId) {
        const { data, error } = await supabase
            .from('order_revisions')
            .select(`
        *,
        users!order_revisions_revised_by_fkey (id, email, full_name)
      `)
            .eq('order_id', orderId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error getting order revisions:', error);
            throw error;
        }

        return data.map(r => ({
            ...r,
            revised_by_user: r.users
        }));
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
        const { data, error } = await supabase
            .from('orders')
            .select('total_amount, status, created_at')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .in('status', ['completed', 'processing']);

        if (error) {
            console.error('❌ Error getting sales summary:', error);
            throw error;
        }

        const totalSales = data.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
        const orderCount = data.length;

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
        let query = supabase
            .from('order_items')
            .select(`
        product_id,
        quantity,
        subtotal,
        orders!inner (status, created_at),
        products (name, selling_price)
      `)
            .in('orders.status', ['completed', 'processing']);

        if (startDate) {
            query = query.gte('orders.created_at', startDate.toISOString());
        }
        if (endDate) {
            query = query.lte('orders.created_at', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Error getting popular products:', error);
            throw error;
        }

        // Aggregate by product
        const productStats = {};
        data.forEach(item => {
            if (!productStats[item.product_id]) {
                productStats[item.product_id] = {
                    product_id: item.product_id,
                    product_name: item.products.name,
                    selling_price: item.products.selling_price,
                    total_quantity: 0,
                    total_revenue: 0,
                    order_count: 0
                };
            }
            productStats[item.product_id].total_quantity += item.quantity;
            productStats[item.product_id].total_revenue += parseFloat(item.subtotal);
            productStats[item.product_id].order_count += 1;
        });

        // Sort by quantity and limit
        return Object.values(productStats)
            .sort((a, b) => b.total_quantity - a.total_quantity)
            .slice(0, limit);
    }
};

export default Order;
