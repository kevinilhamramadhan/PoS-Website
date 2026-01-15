/**
 * Product Model
 * Handles all database operations for products table
 */

import supabase from '../utils/supabaseClient.js';

const Product = {
    /**
     * Find product by ID
     * @param {string} id - Product UUID
     * @returns {Object|null} Product object or null
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error finding product:', error);
            throw error;
        }
        return data;
    },

    /**
     * Find product by name (case-insensitive)
     * @param {string} name - Product name
     * @returns {Object|null} Product object or null
     */
    async findByName(name) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .ilike('name', name)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error finding product by name:', error);
        }
        return data;
    },

    /**
     * Get all products
     * @param {Object} options - { page, limit, available_only, search }
     * @returns {Object} { products, total, page, limit, totalPages }
     */
    async findAll({ page = 1, limit = 20, available_only = false, search = null } = {}) {
        let query = supabase
            .from('products')
            .select('*', { count: 'exact' });

        if (available_only) {
            query = query.eq('is_available', true);
        }

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('❌ Error finding products:', error);
            throw error;
        }

        return {
            products: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    },

    /**
     * Create a new product
     * @param {Object} productData - Product data
     * @returns {Object} Created product
     */
    async create(productData) {
        const { data, error } = await supabase
            .from('products')
            .insert({
                name: productData.name,
                description: productData.description || null,
                selling_price: productData.selling_price,
                cost_price: productData.cost_price || 0,
                image_url: productData.image_url || null,
                is_available: productData.is_available !== undefined ? productData.is_available : true
            })
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error creating product:', error);
            throw error;
        }

        console.log(`✅ Product created: ${data.name}`);
        return data;
    },

    /**
     * Update product by ID
     * @param {string} id - Product UUID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated product
     */
    async update(id, updateData) {
        const { data, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error updating product:', error);
            throw error;
        }

        console.log(`✅ Product updated: ${data.name}`);
        return data;
    },

    /**
     * Delete product by ID
     * @param {string} id - Product UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error deleting product:', error);
            throw error;
        }

        console.log(`✅ Product deleted: ${id}`);
        return true;
    },

    /**
     * Get product with recipe details
     * @param {string} id - Product UUID
     * @returns {Object} Product with recipe ingredients
     */
    async findWithRecipe(id) {
        // First get the product
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (productError) {
            console.error('❌ Error finding product with recipe:', productError);
            throw productError;
        }

        // Then get the recipe with ingredient details
        const { data: recipes, error: recipeError } = await supabase
            .from('recipes')
            .select(`
        id,
        quantity_needed,
        ingredients (
          id,
          name,
          unit,
          unit_price,
          stock_quantity
        )
      `)
            .eq('product_id', id);

        if (recipeError) {
            console.error('❌ Error finding recipe:', recipeError);
            throw recipeError;
        }

        return {
            ...product,
            recipe: recipes.map(r => ({
                recipe_id: r.id,
                ingredient_id: r.ingredients.id,
                ingredient_name: r.ingredients.name,
                unit: r.ingredients.unit,
                quantity_needed: r.quantity_needed,
                unit_price: r.ingredients.unit_price,
                stock_quantity: r.ingredients.stock_quantity,
                cost: r.quantity_needed * r.ingredients.unit_price
            }))
        };
    },

    /**
     * Update product cost_price (calculated from recipe)
     * @param {string} id - Product UUID
     * @param {number} costPrice - New cost price
     * @returns {Object} Updated product
     */
    async updateCostPrice(id, costPrice) {
        const { data, error } = await supabase
            .from('products')
            .update({ cost_price: costPrice })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error updating cost price:', error);
            throw error;
        }

        console.log(`✅ Product cost updated: ${data.name} = ${costPrice}`);
        return data;
    },

    /**
     * Get available products with sufficient stock
     * Checks if all recipe ingredients have enough stock
     * @param {number} quantity - Quantity to make
     * @returns {Array} Products that can be made
     */
    async findAvailableWithStock(quantity = 1) {
        // Get all available products with their recipes
        const { data: products, error } = await supabase
            .from('products')
            .select(`
        *,
        recipes (
          quantity_needed,
          ingredients (
            id,
            name,
            stock_quantity
          )
        )
      `)
            .eq('is_available', true);

        if (error) {
            console.error('❌ Error finding available products:', error);
            throw error;
        }

        // Filter products that have sufficient stock
        return products.map(product => {
            const canMake = product.recipes.every(recipe => {
                const requiredStock = recipe.quantity_needed * quantity;
                return recipe.ingredients.stock_quantity >= requiredStock;
            });

            return {
                ...product,
                can_order: canMake,
                max_quantity: product.recipes.length > 0
                    ? Math.floor(Math.min(...product.recipes.map(r =>
                        r.ingredients.stock_quantity / r.quantity_needed
                    )))
                    : 999 // No recipe means unlimited
            };
        });
    }
};

export default Product;
