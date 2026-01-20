import { useState, useEffect, useRef } from 'react';
import api from './services/api';

// ============================================
// CHATBOT LANDING PAGE
// ============================================

function App() {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Selamat datang di Bakery PoS! 🧁 Saya siap membantu Anda memesan kue favorit. Apa yang ingin Anda pesan hari ini?'
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        
        // Add user message
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // Simulate API call - replace with actual chatbot API
            // const response = await api.chat.send({ message: userMessage });
            
            // Temporary mock response
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Maaf, sistem chatbot sedang dalam pengembangan. Namun saya bisa membantu Anda dengan informasi berikut:\n\n🧁 Menu Tersedia:\n- Chocolate Cake\n- Vanilla Cupcake\n- Red Velvet\n- Croissant\n\nSilakan tanyakan ketersediaan atau buat pesanan!'
                }]);
                setLoading(false);
            }, 1000);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Maaf, terjadi kesalahan. Silakan coba lagi.'
            }]);
            setLoading(false);
        }
    };

    const quickActions = [
        '🍰 Lihat menu',
        '📦 Cek ketersediaan',
        '🛒 Buat pesanan',
        '📞 Hubungi kami'
    ];

    return (
        <div className="chatbot-app">
            {/* Header */}
            <header className="chatbot-header">
                <div className="header-content">
                    <div className="header-brand">
                        <div className="brand-icon">🧁</div>
                        <div>
                            <h1 className="brand-title">Bakery PoS Assistant</h1>
                            <p className="brand-subtitle">Powered by AI • Always Ready to Help</p>
                        </div>
                    </div>
                    <div className="status-indicator">
                        <span className="status-dot"></span>
                        <span className="status-text">Online</span>
                    </div>
                </div>
            </header>

            {/* Chat Container */}
            <div className="chat-container">
                <div className="messages-wrapper">
                    {messages.map((message, index) => (
                        <div key={index} className={`message ${message.role}`}>
                            <div className="message-avatar">
                                {message.role === 'assistant' ? '🤖' : '👤'}
                            </div>
                            <div className="message-content">
                                <div className="message-text">
                                    {message.content}
                                </div>
                                <div className="message-time">
                                    {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="message assistant">
                            <div className="message-avatar">🤖</div>
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                <div className="quick-actions">
                    <div className="quick-actions-label">Quick Actions:</div>
                    <div className="quick-actions-grid">
                        {quickActions.map((action, index) => (
                            <button
                                key={index}
                                className="quick-action-btn"
                                onClick={() => setInput(action)}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="chat-input-wrapper">
                <form className="chat-input-form" onSubmit={sendMessage}>
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Ketik pesan Anda di sini..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={loading}
                    />
                    <button 
                        type="submit" 
                        className="send-button"
                        disabled={!input.trim() || loading}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </form>
                <div className="input-hint">
                    Press Enter to send • Shift + Enter for new line
                </div>
            </div>

            {/* Background Animation */}
            <div className="bg-animation">
                <div className="animated-circle circle-1"></div>
                <div className="animated-circle circle-2"></div>
                <div className="animated-circle circle-3"></div>
            </div>
        </div>
    );
}

export default App;
