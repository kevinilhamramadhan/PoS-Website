import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import api, { auth } from './services/api';

// ============================================
// AUTH CONTEXT
// ============================================

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.setToken(token);
            auth.me()
                .then(res => setUser(res.data.user))
                .catch(() => api.setToken(null))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (credentials) => {
        const res = await auth.login(credentials);
        setUser(res.data.user);
        return res;
    };

    const logout = () => {
        auth.logout();
        setUser(null);
    };

    if (loading) {
        return <div className="loader"><div className="spinner"></div></div>;
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>
            {children}
        </AuthContext.Provider>
    );
};

// ============================================
// LOGIN PAGE
// ============================================

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email, password });
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">🧁 Bakery PoS</h1>
                {error && <div className="alert alert-danger">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@bakery.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <p className="text-center text-muted mt-2">
                    Belum punya akun? <Link to="/register">Daftar</Link>
                </p>
            </div>
        </div>
    );
};

// ============================================
// REGISTER PAGE
// ============================================

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        phone: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await auth.register(formData);
            await login({ email: formData.email, password: formData.password });
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">🧁 Daftar Akun</h1>
                {error && <div className="alert alert-danger">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Nama Lengkap</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            minLength={6}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telepon</label>
                        <input
                            type="tel"
                            className="form-input"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Mendaftar...' : 'Daftar'}
                    </button>
                </form>
                <p className="text-center text-muted mt-2">
                    Sudah punya akun? <Link to="/login">Login</Link>
                </p>
            </div>
        </div>
    );
};

// ============================================
// LAYOUT
// ============================================

const Layout = ({ children }) => {
    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-logo">🧁 Bakery PoS</div>
                <nav className="sidebar-nav">
                    <Link to="/" className="sidebar-link">Dashboard</Link>
                    <Link to="/menu" className="sidebar-link">Menu</Link>
                    <Link to="/orders" className="sidebar-link">Orders</Link>
                    {isAdmin && (
                        <>
                            <Link to="/products" className="sidebar-link">Products</Link>
                            <Link to="/ingredients" className="sidebar-link">Ingredients</Link>
                        </>
                    )}
                </nav>
                <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                    <div className="text-muted mb-1">{user?.full_name}</div>
                    <div className="badge badge-primary">{user?.role}</div>
                    <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ marginTop: '1rem', width: '100%' }}>
                        Logout
                    </button>
                </div>
            </aside>
            <main className="main-content">{children}</main>
        </div>
    );
};

// ============================================
// DASHBOARD
// ============================================

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAuth();

    useEffect(() => {
        if (isAdmin) {
            api.reports.dashboard()
                .then(res => setData(res.data))
                .catch(console.error)
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [isAdmin]);

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    if (!isAdmin) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">Selamat Datang!</h1>
                    <p className="page-description">Silakan lihat menu dan buat pesanan</p>
                </div>
                <Link to="/menu" className="btn btn-primary">Lihat Menu</Link>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-description">Overview penjualan dan stok</p>
            </div>

            {data && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-label">Penjualan Hari Ini</div>
                            <div className="stat-value success">
                                Rp {data.sales?.today?.total_sales?.toLocaleString('id-ID') || 0}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Penjualan Minggu Ini</div>
                            <div className="stat-value">
                                Rp {data.sales?.this_week?.total_sales?.toLocaleString('id-ID') || 0}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Penjualan Bulan Ini</div>
                            <div className="stat-value">
                                Rp {data.sales?.this_month?.total_sales?.toLocaleString('id-ID') || 0}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Stok Menipis</div>
                            <div className="stat-value warning">{data.stock_alerts?.count || 0}</div>
                        </div>
                    </div>

                    <div className="grid grid-2">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Produk Terlaris</h3>
                            </div>
                            {data.popular_products?.length > 0 ? (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Produk</th>
                                            <th>Terjual</th>
                                            <th>Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.popular_products.map(p => (
                                            <tr key={p.product_id}>
                                                <td>{p.product_name}</td>
                                                <td>{p.total_quantity}</td>
                                                <td>Rp {p.total_revenue?.toLocaleString('id-ID')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">Belum ada data penjualan</div>
                            )}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Alert Stok Menipis</h3>
                            </div>
                            {data.stock_alerts?.items?.length > 0 ? (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Bahan</th>
                                            <th>Stok</th>
                                            <th>Min</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.stock_alerts.items.map(s => (
                                            <tr key={s.ingredient_id}>
                                                <td>{s.ingredient_name}</td>
                                                <td className={s.current_stock === 0 ? 'text-danger' : ''}>
                                                    {s.current_stock} {s.unit}
                                                </td>
                                                <td>{s.minimum_threshold} {s.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">Semua stok aman</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================
// MENU PAGE
// ============================================

const MenuPage = () => {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orderLoading, setOrderLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        api.products.list({ available_only: true })
            .then(res => setProducts(res.data.products))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const addToCart = (product) => {
        const existing = cart.find(c => c.product_id === product.id);
        if (existing) {
            setCart(cart.map(c =>
                c.product_id === product.id
                    ? { ...c, quantity: c.quantity + 1 }
                    : c
            ));
        } else {
            setCart([...cart, {
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                price: product.selling_price
            }]);
        }
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(c => c.product_id !== productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            setCart(cart.map(c =>
                c.product_id === productId ? { ...c, quantity } : c
            ));
        }
    };

    const total = cart.reduce((sum, c) => sum + (c.price * c.quantity), 0);

    const submitOrder = async () => {
        if (cart.length === 0) return;
        setOrderLoading(true);
        setMessage('');
        try {
            const res = await api.orders.create({
                items: cart.map(c => ({
                    product_id: c.product_id,
                    quantity: c.quantity
                }))
            });
            setMessage(`Order berhasil! Nomor: ${res.data.order.order_number}`);
            setCart([]);
        } catch (err) {
            setMessage(`Error: ${err.message}`);
        } finally {
            setOrderLoading(false);
        }
    };

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Menu</h1>
                <p className="page-description">Pilih produk untuk dipesan</p>
            </div>

            {message && (
                <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'}`}>
                    {message}
                </div>
            )}

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div>
                    <div className="product-grid">
                        {products.map(product => (
                            <div key={product.id} className="product-card">
                                {product.image_url && (
                                    <img src={product.image_url} alt={product.name} className="product-image" />
                                )}
                                <div className="product-body">
                                    <h3 className="product-name">{product.name}</h3>
                                    <p className="text-muted mb-1" style={{ fontSize: '0.875rem' }}>{product.description}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="product-price">Rp {product.selling_price?.toLocaleString('id-ID')}</span>
                                        <button className="btn btn-primary btn-sm" onClick={() => addToCart(product)}>
                                            + Tambah
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
                    <h3 className="card-title mb-2">🛒 Keranjang</h3>
                    {cart.length === 0 ? (
                        <div className="empty-state">Keranjang kosong</div>
                    ) : (
                        <>
                            {cart.map(item => (
                                <div key={item.product_id} style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0' }}>
                                    <div className="flex justify-between">
                                        <span>{item.product_name}</span>
                                        <button onClick={() => removeFromCart(item.product_id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="flex items-center gap-2">
                                            <button className="btn btn-outline btn-sm" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>-</button>
                                            <span>{item.quantity}</span>
                                            <button className="btn btn-outline btn-sm" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
                                        </div>
                                        <span>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            ))}
                            <div style={{ borderTop: '2px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                                <div className="flex justify-between mb-2">
                                    <strong>Total</strong>
                                    <strong className="product-price">Rp {total.toLocaleString('id-ID')}</strong>
                                </div>
                                <button
                                    className="btn btn-success"
                                    style={{ width: '100%' }}
                                    onClick={submitOrder}
                                    disabled={orderLoading}
                                >
                                    {orderLoading ? 'Processing...' : 'Buat Order'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// ORDERS PAGE
// ============================================

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAuth();

    useEffect(() => {
        api.orders.list()
            .then(res => setOrders(res.data.orders))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const updateStatus = async (id, status) => {
        try {
            await api.orders.updateStatus(id, status);
            setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
        } catch (err) {
            alert(err.message);
        }
    };

    const statusBadge = (status) => {
        const classes = {
            pending: 'badge-warning',
            processing: 'badge-primary',
            completed: 'badge-success',
            cancelled: 'badge-danger'
        };
        return <span className={`badge ${classes[status]}`}>{status}</span>;
    };

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Orders</h1>
                <p className="page-description">Daftar pesanan</p>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Tanggal</th>
                            {isAdmin && <th>Aksi</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(order => (
                            <tr key={order.id}>
                                <td><strong>{order.order_number}</strong></td>
                                <td>{order.customer?.full_name || order.users?.full_name}</td>
                                <td>Rp {parseFloat(order.total_amount).toLocaleString('id-ID')}</td>
                                <td>{statusBadge(order.status)}</td>
                                <td>{new Date(order.created_at).toLocaleDateString('id-ID')}</td>
                                {isAdmin && (
                                    <td>
                                        {order.status === 'pending' && (
                                            <button className="btn btn-primary btn-sm" onClick={() => updateStatus(order.id, 'processing')}>
                                                Process
                                            </button>
                                        )}
                                        {order.status === 'processing' && (
                                            <button className="btn btn-success btn-sm" onClick={() => updateStatus(order.id, 'completed')}>
                                                Complete
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {orders.length === 0 && (
                    <div className="empty-state">Belum ada order</div>
                )}
            </div>
        </div>
    );
};

// ============================================
// PRODUCTS PAGE (Admin)
// ============================================

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.products.list()
            .then(res => setProducts(res.data.products))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header flex justify-between items-center">
                <div>
                    <h1 className="page-title">Products</h1>
                    <p className="page-description">Kelola produk kue</p>
                </div>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Nama</th>
                            <th>Harga Jual</th>
                            <th>Harga Pokok</th>
                            <th>Margin</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id}>
                                <td><strong>{product.name}</strong></td>
                                <td>Rp {parseFloat(product.selling_price).toLocaleString('id-ID')}</td>
                                <td>Rp {parseFloat(product.cost_price).toLocaleString('id-ID')}</td>
                                <td className="text-success">
                                    Rp {(product.selling_price - product.cost_price).toLocaleString('id-ID')}
                                </td>
                                <td>
                                    <span className={`badge ${product.is_available ? 'badge-success' : 'badge-danger'}`}>
                                        {product.is_available ? 'Tersedia' : 'Habis'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ============================================
// INGREDIENTS PAGE (Admin)
// ============================================

const IngredientsPage = () => {
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.ingredients.list()
            .then(res => setIngredients(res.data.ingredients))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Ingredients</h1>
                <p className="page-description">Kelola bahan baku</p>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Nama</th>
                            <th>Stok</th>
                            <th>Min. Stok</th>
                            <th>Harga/Unit</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingredients.map(ing => (
                            <tr key={ing.id}>
                                <td><strong>{ing.name}</strong></td>
                                <td>{ing.stock_quantity} {ing.unit}</td>
                                <td>{ing.min_stock_threshold} {ing.unit}</td>
                                <td>Rp {parseFloat(ing.unit_price).toLocaleString('id-ID')}</td>
                                <td>
                                    <span className={`badge ${ing.stock_quantity <= ing.min_stock_threshold ? 'badge-warning' : 'badge-success'}`}>
                                        {ing.stock_quantity <= ing.min_stock_threshold ? 'Stok Menipis' : 'Aman'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ============================================
// PROTECTED ROUTE
// ============================================

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { user, isAdmin } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <Layout>{children}</Layout>;
};

// ============================================
// APP
// ============================================

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                    <Route path="/products" element={<ProtectedRoute adminOnly><ProductsPage /></ProtectedRoute>} />
                    <Route path="/ingredients" element={<ProtectedRoute adminOnly><IngredientsPage /></ProtectedRoute>} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
