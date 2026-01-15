/**
 * Recipe Controller
 * Handles recipe management (product-ingredient relationships)
 */

import Recipe from '../models/Recipe.js';
import Product from '../models/Product.js';
import Ingredient from '../models/Ingredient.js';
import CostCalculator from '../services/costCalculator.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/recipes/product/:productId
 * Get recipe for a specific product
 */
export const getRecipeByProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw ApiError.notFound(`Produk dengan ID ${productId} tidak ditemukan`);
    }

    const recipes = await Recipe.findByProductId(productId);
    const totalCost = await Recipe.calculateCost(productId);

    res.json({
        success: true,
        data: {
            product: {
                id: product.id,
                name: product.name,
                selling_price: product.selling_price,
                cost_price: product.cost_price
            },
            recipe: {
                ingredients: recipes,
                total_cost: totalCost,
                profit_margin: product.selling_price - totalCost
            }
        }
    });
});

/**
 * POST /api/recipes
 * Add or update recipe item (single ingredient)
 */
export const createRecipe = asyncHandler(async (req, res) => {
    const { product_id, ingredient_id, quantity_needed } = req.body;

    console.log(`📝 Adding recipe: product ${product_id} <- ingredient ${ingredient_id}`);

    // Validate product exists
    const product = await Product.findById(product_id);
    if (!product) {
        throw ApiError.notFound(`Produk dengan ID ${product_id} tidak ditemukan`);
    }

    // Validate ingredient exists
    const ingredient = await Ingredient.findById(ingredient_id);
    if (!ingredient) {
        throw ApiError.notFound(`Bahan baku dengan ID ${ingredient_id} tidak ditemukan`);
    }

    // Create or update recipe
    const recipe = await Recipe.upsert({
        product_id,
        ingredient_id,
        quantity_needed
    });

    // Recalculate product cost
    const { cost_price } = await CostCalculator.updateProductCost(product_id);

    res.status(201).json({
        success: true,
        message: 'Resep berhasil ditambahkan',
        data: {
            recipe,
            updated_cost_price: cost_price
        }
    });
});

/**
 * POST /api/recipes/bulk
 * Bulk update recipe (replace all ingredients for a product)
 */
export const bulkUpdateRecipe = asyncHandler(async (req, res) => {
    const { product_id, ingredients } = req.body;

    console.log(`📝 Bulk updating recipe for product: ${product_id}`);

    // Validate product exists
    const product = await Product.findById(product_id);
    if (!product) {
        throw ApiError.notFound(`Produk dengan ID ${product_id} tidak ditemukan`);
    }

    // Validate all ingredients exist
    for (const ing of ingredients) {
        const ingredient = await Ingredient.findById(ing.ingredient_id);
        if (!ingredient) {
            throw ApiError.notFound(`Bahan baku dengan ID ${ing.ingredient_id} tidak ditemukan`);
        }
    }

    // Bulk update recipes
    const recipes = await Recipe.bulkUpdate(product_id, ingredients);

    // Recalculate product cost
    const { cost_price, breakdown } = await CostCalculator.updateProductCost(product_id);

    res.json({
        success: true,
        message: 'Resep berhasil diupdate',
        data: {
            product: {
                id: product.id,
                name: product.name,
                updated_cost_price: cost_price
            },
            recipe: {
                ingredients: recipes,
                cost_breakdown: breakdown
            }
        }
    });
});

/**
 * PUT /api/recipes/:id
 * Update recipe item quantity
 */
export const updateRecipe = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity_needed } = req.body;

    // Get existing recipe
    const existing = await Recipe.findById(id);
    if (!existing) {
        throw ApiError.notFound(`Resep dengan ID ${id} tidak ditemukan`);
    }

    // Update recipe
    const recipe = await Recipe.update(id, { quantity_needed });

    // Recalculate product cost
    const { cost_price } = await CostCalculator.updateProductCost(existing.product_id);

    res.json({
        success: true,
        message: 'Resep berhasil diupdate',
        data: {
            recipe,
            updated_cost_price: cost_price
        }
    });
});

/**
 * DELETE /api/recipes/:id
 * Delete recipe item
 */
export const deleteRecipe = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get existing recipe to know the product
    const existing = await Recipe.findById(id);
    if (!existing) {
        throw ApiError.notFound(`Resep dengan ID ${id} tidak ditemukan`);
    }

    const productId = existing.product_id;

    // Delete recipe
    await Recipe.delete(id);

    // Recalculate product cost
    const { cost_price } = await CostCalculator.updateProductCost(productId);

    res.json({
        success: true,
        message: 'Item resep berhasil dihapus',
        data: {
            updated_cost_price: cost_price
        }
    });
});

export default {
    getRecipeByProduct,
    createRecipe,
    bulkUpdateRecipe,
    updateRecipe,
    deleteRecipe
};
