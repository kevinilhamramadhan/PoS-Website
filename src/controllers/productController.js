/**
 * Product Controller
 * Handles product CRUD operations and cost breakdown
 */

import Product from '../models/Product.js';
import CostCalculator from '../services/costCalculator.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/products
 * List all products
 */
export const getProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, available_only, search } = req.query;

    const result = await Product.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        available_only: available_only === 'true',
        search
    });

    res.json({
        success: true,
        data: result
    });
});

/**
 * GET /api/products/:id
 * Get single product detail
 */
export const getProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
        throw ApiError.notFound(`Produk dengan ID ${id} tidak ditemukan`);
    }

    res.json({
        success: true,
        data: { product }
    });
});

/**
 * POST /api/products
 * Create new product (Admin only)
 */
export const createProduct = asyncHandler(async (req, res) => {
    const { name, description, selling_price, image_url, is_available } = req.body;

    console.log(`📝 Creating product: ${name}`);

    // Check if product name already exists
    const existing = await Product.findByName(name);
    if (existing) {
        throw ApiError.conflict(`Produk dengan nama "${name}" sudah ada`);
    }

    const product = await Product.create({
        name,
        description,
        selling_price,
        image_url,
        is_available
    });

    res.status(201).json({
        success: true,
        message: 'Produk berhasil ditambahkan',
        data: { product }
    });
});

/**
 * PUT /api/products/:id
 * Update product (Admin only)
 */
export const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, selling_price, image_url, is_available } = req.body;

    // Check if product exists
    const existing = await Product.findById(id);
    if (!existing) {
        throw ApiError.notFound(`Produk dengan ID ${id} tidak ditemukan`);
    }

    // If changing name, check for duplicate
    if (name && name !== existing.name) {
        const duplicate = await Product.findByName(name);
        if (duplicate) {
            throw ApiError.conflict(`Produk dengan nama "${name}" sudah ada`);
        }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (selling_price !== undefined) updateData.selling_price = selling_price;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (is_available !== undefined) updateData.is_available = is_available;

    const product = await Product.update(id, updateData);

    res.json({
        success: true,
        message: 'Produk berhasil diupdate',
        data: { product }
    });
});

/**
 * DELETE /api/products/:id
 * Delete product (Admin only)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await Product.findById(id);
    if (!existing) {
        throw ApiError.notFound(`Produk dengan ID ${id} tidak ditemukan`);
    }

    await Product.delete(id);

    res.json({
        success: true,
        message: 'Produk berhasil dihapus'
    });
});

/**
 * GET /api/products/:id/cost-breakdown
 * Get product cost breakdown from recipe (Admin only)
 */
export const getCostBreakdown = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
        throw ApiError.notFound(`Produk dengan ID ${id} tidak ditemukan`);
    }

    const breakdown = await CostCalculator.getProductProfitMargin(id);

    res.json({
        success: true,
        data: breakdown
    });
});

/**
 * GET /api/products/:id/with-recipe
 * Get product with full recipe details
 */
export const getProductWithRecipe = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findWithRecipe(id);
    if (!product) {
        throw ApiError.notFound(`Produk dengan ID ${id} tidak ditemukan`);
    }

    res.json({
        success: true,
        data: { product }
    });
});

export default {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getCostBreakdown,
    getProductWithRecipe
};
