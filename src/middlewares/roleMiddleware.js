/**
 * Role-Based Access Control Middleware
 * Restricts access based on user roles (admin/customer)
 */

/**
 * Middleware factory to require specific roles
 * @param  {...string} allowedRoles - Roles that are allowed to access
 * @returns Middleware function
 * 
 * Usage:
 *   router.get('/admin-only', authenticate, requireRole('admin'), handler)
 *   router.get('/both', authenticate, requireRole('admin', 'customer'), handler)
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Autentikasi diperlukan.',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // Check if user has required role
        if (!allowedRoles.includes(req.user.role)) {
            console.log(`⛔ Access denied for ${req.user.email} (${req.user.role}). Required: ${allowedRoles.join(' or ')}`);

            return res.status(403).json({
                success: false,
                error: `Akses ditolak. Diperlukan role: ${allowedRoles.join(' atau ')}.`,
                code: 'INSUFFICIENT_ROLE',
                required_roles: allowedRoles,
                current_role: req.user.role
            });
        }

        console.log(`✅ Role check passed: ${req.user.email} is ${req.user.role}`);
        next();
    };
};

/**
 * Shortcut middleware for admin-only access
 */
export const adminOnly = requireRole('admin');

/**
 * Shortcut middleware for customer-only access
 */
export const customerOnly = requireRole('customer');

/**
 * Middleware to check if user is accessing their own resource
 * Useful for routes like /users/:id where customer can only access their own data
 * Admin can access anyone's data
 * 
 * @param {string} paramName - The request parameter containing the user ID (default: 'id')
 */
export const ownerOrAdmin = (paramName = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Autentikasi diperlukan.',
                code: 'NOT_AUTHENTICATED'
            });
        }

        const resourceOwnerId = req.params[paramName];
        const isOwner = req.user.id === resourceOwnerId;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Anda tidak memiliki akses ke resource ini.',
                code: 'NOT_OWNER'
            });
        }

        next();
    };
};

export default { requireRole, adminOnly, customerOnly, ownerOrAdmin };
