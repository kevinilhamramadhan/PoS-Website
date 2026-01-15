/**
 * Input Validators
 * Validation schemas using express-validator for all API endpoints
 */

import { body, param, query } from 'express-validator';

// ============================================
// AUTH VALIDATORS
// ============================================

export const registerValidator = [
    body('email')
        .isEmail()
        .withMessage('Email tidak valid')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password minimal 6 karakter'),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('Nama lengkap wajib diisi')
        .isLength({ max: 255 })
        .withMessage('Nama maksimal 255 karakter'),
    body('phone')
        .optional()
        .isMobilePhone('id-ID')
        .withMessage('Nomor telepon tidak valid'),
    body('role')
        .optional()
        .isIn(['admin', 'customer'])
        .withMessage('Role harus admin atau customer')
];

export const loginValidator = [
    body('email')
        .isEmail()
        .withMessage('Email tidak valid')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password wajib diisi')
];

// ============================================
// PRODUCT VALIDATORS
// ============================================

export const productValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Nama produk wajib diisi')
        .isLength({ max: 255 })
        .withMessage('Nama produk maksimal 255 karakter'),
    body('description')
        .optional()
        .trim(),
    body('selling_price')
        .isFloat({ min: 0 })
        .withMessage('Harga jual harus angka positif'),
    body('image_url')
        .optional()
        .isURL()
        .withMessage('URL gambar tidak valid'),
    body('is_available')
        .optional()
        .isBoolean()
        .withMessage('is_available harus boolean')
];

export const productUpdateValidator = [
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Nama produk tidak boleh kosong')
        .isLength({ max: 255 }),
    body('description')
        .optional()
        .trim(),
    body('selling_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Harga jual harus angka positif'),
    body('image_url')
        .optional()
        .isURL()
        .withMessage('URL gambar tidak valid'),
    body('is_available')
        .optional()
        .isBoolean()
        .withMessage('is_available harus boolean')
];

// ============================================
// INGREDIENT VALIDATORS
// ============================================

export const ingredientValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Nama bahan baku wajib diisi')
        .isLength({ max: 255 }),
    body('unit')
        .trim()
        .notEmpty()
        .withMessage('Satuan wajib diisi')
        .isLength({ max: 50 }),
    body('stock_quantity')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Stok harus angka positif'),
    body('min_stock_threshold')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Threshold stok harus angka positif'),
    body('unit_price')
        .isFloat({ min: 0 })
        .withMessage('Harga satuan harus angka positif')
];

export const ingredientUpdateValidator = [
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 255 }),
    body('unit')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 50 }),
    body('stock_quantity')
        .optional()
        .isFloat({ min: 0 }),
    body('min_stock_threshold')
        .optional()
        .isFloat({ min: 0 }),
    body('unit_price')
        .optional()
        .isFloat({ min: 0 })
];

export const stockAdjustmentValidator = [
    body('quantity')
        .isFloat()
        .withMessage('Quantity wajib diisi sebagai angka'),
    body('movement_type')
        .isIn(['in', 'out', 'adjustment'])
        .withMessage('Tipe harus in, out, atau adjustment'),
    body('notes')
        .optional()
        .trim()
];

// ============================================
// RECIPE VALIDATORS
// ============================================

export const recipeValidator = [
    body('product_id')
        .isUUID()
        .withMessage('Product ID tidak valid'),
    body('ingredient_id')
        .isUUID()
        .withMessage('Ingredient ID tidak valid'),
    body('quantity_needed')
        .isFloat({ min: 0.01 })
        .withMessage('Quantity harus lebih dari 0')
];

export const recipeBulkValidator = [
    body('product_id')
        .isUUID()
        .withMessage('Product ID tidak valid'),
    body('ingredients')
        .isArray({ min: 1 })
        .withMessage('Ingredients harus array dengan minimal 1 item'),
    body('ingredients.*.ingredient_id')
        .isUUID()
        .withMessage('Ingredient ID tidak valid'),
    body('ingredients.*.quantity_needed')
        .isFloat({ min: 0.01 })
        .withMessage('Quantity harus lebih dari 0')
];

// ============================================
// ORDER VALIDATORS
// ============================================

export const orderValidator = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Order harus memiliki minimal 1 item'),
    body('items.*.product_id')
        .isUUID()
        .withMessage('Product ID tidak valid'),
    body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity harus minimal 1'),
    body('notes')
        .optional()
        .trim()
];

export const orderUpdateValidator = [
    body('items')
        .optional()
        .isArray({ min: 1 })
        .withMessage('Items harus array dengan minimal 1 item'),
    body('items.*.product_id')
        .optional()
        .isUUID(),
    body('items.*.quantity')
        .optional()
        .isInt({ min: 1 }),
    body('notes')
        .optional()
        .trim()
];

export const orderStatusValidator = [
    body('status')
        .isIn(['pending', 'processing', 'completed', 'cancelled'])
        .withMessage('Status tidak valid')
];

// ============================================
// COMMON VALIDATORS
// ============================================

export const uuidParamValidator = [
    param('id')
        .isUUID()
        .withMessage('ID tidak valid')
];

export const productIdParamValidator = [
    param('productId')
        .isUUID()
        .withMessage('Product ID tidak valid')
];

// ============================================
// DATE RANGE VALIDATORS (for reports)
// ============================================

export const dateRangeValidator = [
    query('start_date')
        .optional()
        .isISO8601()
        .withMessage('Format tanggal tidak valid (gunakan ISO 8601)'),
    query('end_date')
        .optional()
        .isISO8601()
        .withMessage('Format tanggal tidak valid (gunakan ISO 8601)')
];

// ============================================
// CHATBOT VALIDATORS
// ============================================

export const chatbotOrderValidator = [
    body('customer_email')
        .optional()
        .isEmail()
        .withMessage('Email tidak valid'),
    body('customer_name')
        .optional()
        .trim(),
    body('items')
        .isArray({ min: 1 })
        .withMessage('Order harus memiliki minimal 1 item'),
    body('items.*.product_name')
        .optional()
        .trim(),
    body('items.*.product_id')
        .optional()
        .isUUID(),
    body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity harus minimal 1'),
    body('notes')
        .optional()
        .trim()
];

export const availabilityCheckValidator = [
    body('products')
        .isArray({ min: 1 })
        .withMessage('Products harus array'),
    body('products.*.product_id')
        .optional()
        .isUUID(),
    body('products.*.product_name')
        .optional()
        .trim(),
    body('products.*.quantity')
        .isInt({ min: 1 })
];
