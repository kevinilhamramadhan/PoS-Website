/**
 * Ingredient Controller
 * Handles ingredient CRUD, stock management, and alerts
 */

import Ingredient from '../models/Ingredient.js';
import StockManager from '../services/stockManager.js';
import CostCalculator from '../services/costCalculator.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/ingredients
 * List all ingredients
 */
export const getIngredients = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;

    const result = await Ingredient.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        search
    });

    res.json({
        success: true,
        data: result
    });
});

/**
 * GET /api/ingredients/:id
 * Get single ingredient detail
 */
export const getIngredient = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const ingredient = await Ingredient.findById(id);
    if (!ingredient) {
        throw ApiError.notFound(`Bahan baku dengan ID ${id} tidak ditemukan`);
    }

    res.json({
        success: true,
        data: { ingredient }
    });
});

/**
 * POST /api/ingredients
 * Create new ingredient (Admin only)
 */
export const createIngredient = asyncHandler(async (req, res) => {
    const { name, unit, stock_quantity, min_stock_threshold, unit_price } = req.body;

    console.log(`📝 Creating ingredient: ${name}`);

    // Check if ingredient name already exists
    const existing = await Ingredient.findByName(name);
    if (existing) {
        throw ApiError.conflict(`Bahan baku dengan nama "${name}" sudah ada`);
    }

    const ingredient = await Ingredient.create({
        name,
        unit,
        stock_quantity: stock_quantity || 0,
        min_stock_threshold: min_stock_threshold || 0,
        unit_price
    });

    res.status(201).json({
        success: true,
        message: 'Bahan baku berhasil ditambahkan',
        data: { ingredient }
    });
});

/**
 * PUT /api/ingredients/:id
 * Update ingredient (Admin only)
 */
export const updateIngredient = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, unit, stock_quantity, min_stock_threshold, unit_price } = req.body;

    // Check if ingredient exists
    const existing = await Ingredient.findById(id);
    if (!existing) {
        throw ApiError.notFound(`Bahan baku dengan ID ${id} tidak ditemukan`);
    }

    // If changing name, check for duplicate
    if (name && name !== existing.name) {
        const duplicate = await Ingredient.findByName(name);
        if (duplicate) {
            throw ApiError.conflict(`Bahan baku dengan nama "${name}" sudah ada`);
        }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (unit !== undefined) updateData.unit = unit;
    if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity;
    if (min_stock_threshold !== undefined) updateData.min_stock_threshold = min_stock_threshold;

    // If unit price changed, recalculate affected product costs
    const priceChanged = unit_price !== undefined && unit_price !== existing.unit_price;
    if (unit_price !== undefined) updateData.unit_price = unit_price;

    const ingredient = await Ingredient.update(id, updateData);

    // Recalculate product costs if price changed
    let affectedProducts = [];
    if (priceChanged) {
        console.log(`💰 Price changed for ${name}, recalculating product costs...`);
        affectedProducts = await CostCalculator.recalculateByIngredient(id);
    }

    res.json({
        success: true,
        message: 'Bahan baku berhasil diupdate',
        data: {
            ingredient,
            affected_products: affectedProducts.length > 0 ? affectedProducts : undefined
        }
    });
});

/**
 * DELETE /api/ingredients/:id
 * Delete ingredient (Admin only)
 */
export const deleteIngredient = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await Ingredient.findById(id);
    if (!existing) {
        throw ApiError.notFound(`Bahan baku dengan ID ${id} tidak ditemukan`);
    }

    try {
        await Ingredient.delete(id);
    } catch (error) {
        // Handle foreign key constraint (ingredient used in recipes)
        if (error.code === '23503') {
            throw ApiError.badRequest(
                'Tidak bisa menghapus bahan baku yang masih digunakan dalam resep'
            );
        }
        throw error;
    }

    res.json({
        success: true,
        message: 'Bahan baku berhasil dihapus'
    });
});

/**
 * GET /api/ingredients/low-stock
 * Get ingredients with low stock (Admin only)
 */
export const getLowStock = asyncHandler(async (req, res) => {
    const lowStock = await StockManager.getLowStockAlerts();

    res.json({
        success: true,
        data: {
            count: lowStock.length,
            ingredients: lowStock
        }
    });
});

/**
 * POST /api/ingredients/:id/adjust-stock
 * Manual stock adjustment (Admin only)
 */
export const adjustStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity, movement_type, notes } = req.body;

    const result = await StockManager.adjustStock(id, quantity, movement_type, notes);

    res.json({
        success: true,
        message: 'Stok berhasil disesuaikan',
        data: result
    });
});

/**
 * GET /api/ingredients/:id/history
 * Get stock movement history for ingredient
 */
export const getStockHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if ingredient exists
    const ingredient = await Ingredient.findById(id);
    if (!ingredient) {
        throw ApiError.notFound(`Bahan baku dengan ID ${id} tidak ditemukan`);
    }

    const history = await StockManager.getStockHistory(id, {
        page: parseInt(page),
        limit: parseInt(limit)
    });

    res.json({
        success: true,
        data: {
            ingredient: {
                id: ingredient.id,
                name: ingredient.name,
                current_stock: ingredient.stock_quantity,
                unit: ingredient.unit
            },
            ...history
        }
    });
});

export default {
    getIngredients,
    getIngredient,
    createIngredient,
    updateIngredient,
    deleteIngredient,
    getLowStock,
    adjustStock,
    getStockHistory
};
