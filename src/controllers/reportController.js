/**
 * Report Controller
 * Handles dashboard and report endpoints
 */

import Order from '../models/Order.js';
import StockManager from '../services/stockManager.js';
import CostCalculator from '../services/costCalculator.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Helper function to get date ranges
 */
const getDateRanges = () => {
    const now = new Date();

    // Today: start of day to now
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // This week: start of week (Monday) to now
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    // This month: start of month to now
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    return { now, todayStart, weekStart, monthStart };
};

/**
 * GET /api/reports/sales-summary
 * Get sales summary (today, this week, this month)
 */
export const getSalesSummary = asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    const { now, todayStart, weekStart, monthStart } = getDateRanges();

    // If custom date range provided
    if (start_date && end_date) {
        const summary = await Order.getSalesSummary(
            new Date(start_date),
            new Date(end_date)
        );
        return res.json({
            success: true,
            data: { custom: summary }
        });
    }

    // Get summaries for different periods
    const [todaySummary, weekSummary, monthSummary] = await Promise.all([
        Order.getSalesSummary(todayStart, now),
        Order.getSalesSummary(weekStart, now),
        Order.getSalesSummary(monthStart, now)
    ]);

    res.json({
        success: true,
        data: {
            today: {
                ...todaySummary,
                label: 'Hari Ini'
            },
            this_week: {
                ...weekSummary,
                label: 'Minggu Ini'
            },
            this_month: {
                ...monthSummary,
                label: 'Bulan Ini'
            }
        }
    });
});

/**
 * GET /api/reports/popular-products
 * Get best selling products
 */
export const getPopularProducts = asyncHandler(async (req, res) => {
    const { limit = 10, start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    const products = await Order.getPopularProducts(
        parseInt(limit),
        startDate,
        endDate
    );

    res.json({
        success: true,
        data: {
            period: {
                start_date: startDate,
                end_date: endDate
            },
            products
        }
    });
});

/**
 * GET /api/reports/stock-alerts
 * Get low stock alerts
 */
export const getStockAlerts = asyncHandler(async (req, res) => {
    const alerts = await StockManager.getLowStockAlerts();

    const critical = alerts.filter(a => a.reorder_urgency === 'critical');
    const low = alerts.filter(a => a.reorder_urgency === 'low');

    res.json({
        success: true,
        data: {
            total_alerts: alerts.length,
            critical_count: critical.length,
            low_count: low.length,
            alerts: {
                critical,
                low
            }
        }
    });
});

/**
 * GET /api/reports/profit-margin
 * Get profit margin per product
 */
export const getProfitMargin = asyncHandler(async (req, res) => {
    const margins = await CostCalculator.getAllProductProfitMargins();

    // Calculate summary stats
    const validMargins = margins.filter(m => !m.error && m.margin_percentage !== undefined);
    const avgMargin = validMargins.length > 0
        ? validMargins.reduce((sum, m) => sum + m.margin_percentage, 0) / validMargins.length
        : 0;

    const totalRevenuePotential = validMargins.reduce((sum, m) => sum + m.selling_price, 0);
    const totalCost = validMargins.reduce((sum, m) => sum + m.cost_price, 0);
    const totalProfit = validMargins.reduce((sum, m) => sum + m.profit_amount, 0);

    res.json({
        success: true,
        data: {
            summary: {
                product_count: margins.length,
                average_margin_percentage: Math.round(avgMargin * 100) / 100,
                total_revenue_potential: totalRevenuePotential,
                total_cost: Math.round(totalCost * 100) / 100,
                total_profit: Math.round(totalProfit * 100) / 100
            },
            products: margins
        }
    });
});

/**
 * GET /api/reports/dashboard
 * Get combined dashboard data
 */
export const getDashboard = asyncHandler(async (req, res) => {
    const { now, todayStart, weekStart, monthStart } = getDateRanges();

    // Fetch all data in parallel
    const [
        todaySales,
        weekSales,
        monthSales,
        popularProducts,
        stockAlerts
    ] = await Promise.all([
        Order.getSalesSummary(todayStart, now),
        Order.getSalesSummary(weekStart, now),
        Order.getSalesSummary(monthStart, now),
        Order.getPopularProducts(5),
        StockManager.getLowStockAlerts()
    ]);

    res.json({
        success: true,
        data: {
            sales: {
                today: todaySales,
                this_week: weekSales,
                this_month: monthSales
            },
            popular_products: popularProducts,
            stock_alerts: {
                count: stockAlerts.length,
                items: stockAlerts.slice(0, 5) // Top 5 alerts
            },
            generated_at: now
        }
    });
});

export default {
    getSalesSummary,
    getPopularProducts,
    getStockAlerts,
    getProfitMargin,
    getDashboard
};
