/**
 * Cost Calculator Service
 * Handles automatic calculation of product cost prices based on recipes
 */

import Recipe from '../models/Recipe.js';
import Product from '../models/Product.js';
import Ingredient from '../models/Ingredient.js';

const CostCalculator = {
    /**
     * Calculate cost price for a product based on its recipe
     * Formula: cost_price = SUM(ingredient.unit_price × recipe.quantity_needed)
     * 
     * @param {string} productId - Product UUID
     * @returns {Object} { cost_price, breakdown }
     */
    async calculateProductCost(productId) {
        console.log(`📊 Calculating cost for product: ${productId}`);

        // Get recipe for product
        const recipes = await Recipe.findByProductId(productId);

        if (recipes.length === 0) {
            console.log(`⚠️ No recipe found for product ${productId}`);
            return {
                cost_price: 0,
                breakdown: [],
                message: 'No recipe defined for this product'
            };
        }

        // Calculate cost for each ingredient
        const breakdown = recipes.map(r => ({
            ingredient_id: r.ingredient_id,
            ingredient_name: r.ingredient_name,
            unit: r.unit,
            quantity_needed: r.quantity_needed,
            unit_price: r.unit_price,
            cost: r.quantity_needed * r.unit_price
        }));

        // Sum total cost
        const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
        const roundedCost = Math.round(totalCost * 100) / 100;

        console.log(`✅ Calculated cost: ${roundedCost} (${breakdown.length} ingredients)`);

        return {
            cost_price: roundedCost,
            breakdown,
            ingredient_count: breakdown.length
        };
    },

    /**
     * Update product cost price in database
     * Call this after recipe changes
     * 
     * @param {string} productId - Product UUID
     * @returns {Object} Updated product with cost breakdown
     */
    async updateProductCost(productId) {
        const { cost_price, breakdown } = await this.calculateProductCost(productId);

        // Update product cost_price
        const updatedProduct = await Product.updateCostPrice(productId, cost_price);

        return {
            product: updatedProduct,
            cost_breakdown: breakdown
        };
    },

    /**
     * Recalculate costs for all products using a specific ingredient
     * Call this when ingredient price changes
     * 
     * @param {string} ingredientId - Ingredient UUID
     * @returns {Array} Updated products
     */
    async recalculateByIngredient(ingredientId) {
        console.log(`📊 Recalculating costs for ingredient: ${ingredientId}`);

        // Find all products using this ingredient
        const recipes = await Recipe.findByIngredientId(ingredientId);
        const productIds = [...new Set(recipes.map(r => r.products.id))];

        console.log(`📊 Found ${productIds.length} products using this ingredient`);

        // Update each product's cost
        const results = [];
        for (const productId of productIds) {
            const result = await this.updateProductCost(productId);
            results.push(result);
        }

        return results;
    },

    /**
     * Get profit margin for a product
     * 
     * @param {string} productId - Product UUID
     * @returns {Object} Profit margin data
     */
    async getProductProfitMargin(productId) {
        const product = await Product.findById(productId);
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }

        const { cost_price, breakdown } = await this.calculateProductCost(productId);

        const sellingPrice = parseFloat(product.selling_price);
        const costPrice = cost_price;
        const profitAmount = sellingPrice - costPrice;
        const profitPercentage = costPrice > 0
            ? ((profitAmount / costPrice) * 100).toFixed(2)
            : 100;
        const marginPercentage = sellingPrice > 0
            ? ((profitAmount / sellingPrice) * 100).toFixed(2)
            : 0;

        return {
            product_id: productId,
            product_name: product.name,
            selling_price: sellingPrice,
            cost_price: costPrice,
            profit_amount: profitAmount,
            profit_percentage: parseFloat(profitPercentage), // markup
            margin_percentage: parseFloat(marginPercentage), // profit margin
            cost_breakdown: breakdown
        };
    },

    /**
     * Get profit margins for all products
     * 
     * @returns {Array} Profit margins for all products
     */
    async getAllProductProfitMargins() {
        const { products } = await Product.findAll({ limit: 1000 });

        const margins = [];
        for (const product of products) {
            try {
                const margin = await this.getProductProfitMargin(product.id);
                margins.push(margin);
            } catch (error) {
                console.error(`Error calculating margin for ${product.id}:`, error);
                margins.push({
                    product_id: product.id,
                    product_name: product.name,
                    error: error.message
                });
            }
        }

        // Sort by profit margin descending
        return margins.sort((a, b) => (b.margin_percentage || 0) - (a.margin_percentage || 0));
    },

    /**
     * Simulate cost changes
     * Calculate what would happen if ingredient price changes
     * 
     * @param {string} ingredientId - Ingredient UUID
     * @param {number} newPrice - New unit price
     * @returns {Array} Simulated cost impacts
     */
    async simulatePriceChange(ingredientId, newPrice) {
        const ingredient = await Ingredient.findById(ingredientId);
        if (!ingredient) {
            throw new Error(`Ingredient ${ingredientId} not found`);
        }

        const oldPrice = parseFloat(ingredient.unit_price);
        const priceDiff = newPrice - oldPrice;

        // Find affected products
        const recipes = await Recipe.findByIngredientId(ingredientId);

        const impacts = [];
        for (const r of recipes) {
            const product = r.products;
            const currentCost = await this.calculateProductCost(product.id);

            // Calculate new ingredient cost
            const oldIngredientCost = r.quantity_needed * oldPrice;
            const newIngredientCost = r.quantity_needed * newPrice;
            const costImpact = newIngredientCost - oldIngredientCost;

            const newTotalCost = currentCost.cost_price + costImpact;

            impacts.push({
                product_id: product.id,
                product_name: product.name,
                current_cost: currentCost.cost_price,
                new_cost: newTotalCost,
                cost_impact: costImpact,
                quantity_used: r.quantity_needed
            });
        }

        return {
            ingredient_id: ingredientId,
            ingredient_name: ingredient.name,
            old_price: oldPrice,
            new_price: newPrice,
            price_difference: priceDiff,
            affected_products: impacts
        };
    }
};

export default CostCalculator;
