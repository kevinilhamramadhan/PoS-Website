/**
 * Stock Manager Service
 * Handles stock operations: deduction, alerts, adjustments
 */

import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import StockMovement from '../models/StockMovement.js';
import { ApiError } from '../middlewares/errorHandler.js';

const StockManager = {
    /**
     * Check if products can be made with current stock
     * Returns detailed shortage information if insufficient
     * 
     * @param {Array} orderItems - Array of { product_id, quantity }
     * @returns {Object} { canFulfill, shortages, requirements }
     */
    async checkOrderStock(orderItems) {
        console.log(`📦 Checking stock for ${orderItems.length} items`);

        const allRequirements = [];
        const shortages = [];

        // Collect all ingredient requirements
        for (const item of orderItems) {
            const recipes = await Recipe.findByProductId(item.product_id);

            if (recipes.length === 0) {
                console.log(`⚠️ Product ${item.product_id} has no recipe, skipping stock check`);
                continue;
            }

            for (const recipe of recipes) {
                const required = recipe.quantity_needed * item.quantity;

                // Check if ingredient already in requirements
                const existing = allRequirements.find(r => r.ingredient_id === recipe.ingredient_id);

                if (existing) {
                    existing.quantity_needed += required;
                } else {
                    allRequirements.push({
                        ingredient_id: recipe.ingredient_id,
                        ingredient_name: recipe.ingredient_name,
                        unit: recipe.unit,
                        quantity_needed: required,
                        current_stock: recipe.stock_quantity
                    });
                }
            }
        }

        // Check for shortages
        for (const req of allRequirements) {
            if (req.current_stock < req.quantity_needed) {
                shortages.push({
                    ingredient_id: req.ingredient_id,
                    ingredient_name: req.ingredient_name,
                    unit: req.unit,
                    required: req.quantity_needed,
                    available: req.current_stock,
                    shortage: req.quantity_needed - req.current_stock
                });
            }
        }

        const canFulfill = shortages.length === 0;

        if (!canFulfill) {
            console.log(`❌ Stock check failed: ${shortages.length} shortages`);
        } else {
            console.log(`✅ Stock check passed`);
        }

        return {
            canFulfill,
            shortages,
            requirements: allRequirements
        };
    },

    /**
     * Deduct stock for an order
     * Records stock movements for audit trail
     * 
     * @param {string} orderId - Order UUID
     * @param {Array} orderItems - Array of { product_id, quantity }
     * @returns {Object} { success, deductions }
     */
    async deductOrderStock(orderId, orderItems) {
        console.log(`📦 Deducting stock for order: ${orderId}`);

        // First check if we have enough stock
        const { canFulfill, shortages, requirements } = await this.checkOrderStock(orderItems);

        if (!canFulfill) {
            const shortageMessages = shortages.map(s =>
                `${s.ingredient_name}: butuh ${s.required} ${s.unit}, tersedia ${s.available} ${s.unit}`
            );

            throw ApiError.badRequest(
                `Tidak bisa membuat order: stok tidak cukup`,
                'INSUFFICIENT_STOCK',
                { shortages, messages: shortageMessages }
            );
        }

        // Deduct stock for each ingredient
        const deductions = [];
        const stockMovements = [];

        for (const req of requirements) {
            // Update ingredient stock
            await Ingredient.adjustStock(req.ingredient_id, -req.quantity_needed);

            deductions.push({
                ingredient_id: req.ingredient_id,
                ingredient_name: req.ingredient_name,
                quantity_deducted: req.quantity_needed,
                unit: req.unit
            });

            // Prepare stock movement record
            stockMovements.push({
                ingredient_id: req.ingredient_id,
                movement_type: 'out',
                quantity: -req.quantity_needed,
                reference_type: 'order',
                reference_id: orderId,
                notes: `Stock deducted for order`
            });
        }

        // Record all stock movements
        await StockMovement.createBatch(stockMovements);

        console.log(`✅ Stock deducted: ${deductions.length} ingredients`);

        return {
            success: true,
            deductions
        };
    },

    /**
     * Return stock for cancelled order
     * 
     * @param {string} orderId - Order UUID
     * @param {Array} orderItems - Array of { product_id, quantity }
     * @returns {Object} { success, returns }
     */
    async returnOrderStock(orderId, orderItems) {
        console.log(`📦 Returning stock for cancelled order: ${orderId}`);

        const returns = [];
        const stockMovements = [];

        for (const item of orderItems) {
            const recipes = await Recipe.findByProductId(item.product_id);

            for (const recipe of recipes) {
                const returnQuantity = recipe.quantity_needed * item.quantity;

                // Update ingredient stock
                await Ingredient.adjustStock(recipe.ingredient_id, returnQuantity);

                // Check if already in returns
                const existing = returns.find(r => r.ingredient_id === recipe.ingredient_id);
                if (existing) {
                    existing.quantity_returned += returnQuantity;
                } else {
                    returns.push({
                        ingredient_id: recipe.ingredient_id,
                        ingredient_name: recipe.ingredient_name,
                        quantity_returned: returnQuantity,
                        unit: recipe.unit
                    });

                    stockMovements.push({
                        ingredient_id: recipe.ingredient_id,
                        movement_type: 'in',
                        quantity: returnQuantity,
                        reference_type: 'order_cancel',
                        reference_id: orderId,
                        notes: `Stock returned from cancelled order`
                    });
                }
            }
        }

        // Record stock movements
        if (stockMovements.length > 0) {
            await StockMovement.createBatch(stockMovements);
        }

        console.log(`✅ Stock returned: ${returns.length} ingredients`);

        return {
            success: true,
            returns
        };
    },

    /**
     * Get low stock ingredients
     * Returns ingredients where stock <= threshold
     * 
     * @returns {Array} Low stock ingredients
     */
    async getLowStockAlerts() {
        const lowStock = await Ingredient.findLowStock();

        console.log(`⚠️ Low stock alerts: ${lowStock.length} items`);

        return lowStock.map(ing => ({
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            unit: ing.unit,
            current_stock: ing.stock_quantity,
            minimum_threshold: ing.min_stock_threshold,
            shortage: ing.min_stock_threshold - ing.stock_quantity,
            reorder_urgency: ing.stock_quantity === 0 ? 'critical' : 'low'
        }));
    },

    /**
     * Manual stock adjustment
     * 
     * @param {string} ingredientId - Ingredient UUID
     * @param {number} quantity - Adjustment quantity (positive or negative)
     * @param {string} type - 'in', 'out', or 'adjustment'
     * @param {string} notes - Reason for adjustment
     * @returns {Object} Updated ingredient and movement record
     */
    async adjustStock(ingredientId, quantity, type, notes) {
        console.log(`📦 Manual adjustment: ${ingredientId} ${type} ${quantity}`);

        const ingredient = await Ingredient.findById(ingredientId);
        if (!ingredient) {
            throw ApiError.notFound(`Bahan baku dengan ID ${ingredientId} tidak ditemukan`);
        }

        // Calculate actual adjustment
        let adjustment;
        if (type === 'in') {
            adjustment = Math.abs(quantity);
        } else if (type === 'out') {
            adjustment = -Math.abs(quantity);
        } else {
            adjustment = quantity; // adjustment can be positive or negative
        }

        // Check if out adjustment would result in negative stock
        const newStock = parseFloat(ingredient.stock_quantity) + adjustment;
        if (newStock < 0) {
            throw ApiError.badRequest(
                `Tidak bisa mengurangi stok. Stok saat ini: ${ingredient.stock_quantity} ${ingredient.unit}`,
                'INSUFFICIENT_STOCK'
            );
        }

        // Update stock
        const updated = await Ingredient.adjustStock(ingredientId, adjustment);

        // Record movement
        const movement = await StockMovement.create({
            ingredient_id: ingredientId,
            movement_type: type,
            quantity: adjustment,
            reference_type: 'manual',
            reference_id: null,
            notes: notes
        });

        console.log(`✅ Stock adjusted: ${ingredient.name} ${adjustment > 0 ? '+' : ''}${adjustment} ${ingredient.unit}`);

        return {
            ingredient: updated,
            movement,
            previous_stock: ingredient.stock_quantity,
            new_stock: updated.stock_quantity,
            adjustment
        };
    },

    /**
     * Get stock movements history for an ingredient
     * 
     * @param {string} ingredientId - Ingredient UUID
     * @param {Object} options - { page, limit }
     * @returns {Object} Movements with pagination
     */
    async getStockHistory(ingredientId, options = {}) {
        return StockMovement.findByIngredient(ingredientId, options);
    },

    /**
     * Check maximum quantity that can be ordered for a product
     * 
     * @param {string} productId - Product UUID
     * @returns {Object} { product_id, max_quantity, limiting_ingredients }
     */
    async getMaxOrderableQuantity(productId) {
        const recipes = await Recipe.findByProductId(productId);

        if (recipes.length === 0) {
            return {
                product_id: productId,
                max_quantity: 999,
                has_recipe: false,
                message: 'No recipe defined, unlimited ordering'
            };
        }

        let maxQuantity = Infinity;
        const limitingFactors = [];

        for (const recipe of recipes) {
            const possibleQuantity = Math.floor(recipe.stock_quantity / recipe.quantity_needed);

            if (possibleQuantity < maxQuantity) {
                maxQuantity = possibleQuantity;
            }

            limitingFactors.push({
                ingredient_id: recipe.ingredient_id,
                ingredient_name: recipe.ingredient_name,
                stock_quantity: recipe.stock_quantity,
                quantity_per_product: recipe.quantity_needed,
                max_products: possibleQuantity
            });
        }

        // Sort by most limiting first
        limitingFactors.sort((a, b) => a.max_products - b.max_products);

        return {
            product_id: productId,
            max_quantity: maxQuantity === Infinity ? 999 : maxQuantity,
            has_recipe: true,
            limiting_ingredients: limitingFactors
        };
    }
};

export default StockManager;
