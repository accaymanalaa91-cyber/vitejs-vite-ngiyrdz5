import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, doc, runTransaction, where, deleteDoc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

// ------------------------------------------------------------------
// إعدادات Firebase
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDMF65H0Sa5B_CC1h-pRGxhVHEjPaHmRRc",
  authDomain: "financial-manager-2d1c3.firebaseapp.com",
  projectId: "financial-manager-2d1c3",
  storageBucket: "financial-manager-2d1c3.firebasestorage.app",
  messagingSenderId: "730372364290",
  appId: "1:730372364290:web:014e9fd1566f178d926f1b"
};

let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const mapSnapshotToData = (snapshot) => {
    const data = [];
    snapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() }); });
    if (data.length > 0 && data[0].date) { data.sort((a, b) => new Date(b.date) - new Date(a.date)); }
    return data;
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: '2-digit' });
};

// ------------------------------------------------------------------
// Components
// ------------------------------------------------------------------

const MobileButton = ({ children, onClick, color = 'bg-blue-600', outline = false, full = true, disabled = false, small = false }) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`${full ? 'w-full' : ''} ${small ? 'py-1 px-3 text-xs' : 'py-3 px-4 text-sm'} rounded-xl font-bold shadow-sm transition-all active:scale-95 
        ${outline 
            ? `border-2 border-${color.replace('bg-', '')} text-${color.replace('bg-', '')} bg-transparent` 
            : `${color} text-white`
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {children}
    </button>
);

const InfoCard = ({ title, value, subValue, icon, type = 'neutral', onClick, darkMode }) => {
    // Dark mode color adjustments
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    
    const colors = {
        neutral: darkMode ? 'text-gray-200' : 'text-gray-800',
        success: darkMode ? 'text-green-400' : 'text-green-700',
        danger: darkMode ? 'text-red-400' : 'text-red-700',
        info: darkMode ? 'text-blue-400' : 'text-blue-700',
        warning: darkMode ? 'text-orange-400' : 'text-orange-700'
    };

    return (
        <div onClick={onClick} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${bg} ${onClick ? 'active:opacity-80 cursor-pointer' : ''}`}>
            <div>
                <p className={`text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
                <p className={`text-xl font-bold ${colors[type]}`}>{value}</p>
                {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
            </div>
            {icon && <div className={`p-3 rounded-full shadow-sm text-2xl ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}>{icon}</div>}
        </div>
    );
};

// ------------------------------------------------------------------
// Screens
// ------------------------------------------------------------------

const LoginScreen = () => {
    const handleLogin = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert("فشل الدخول: " + e.message); }
    };
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center relative" dir="rtl">
            <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl mb-6 rotate-3">
                <span className="text-5xl">💰</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">مديرك المالي</h1>
            <div className="bg-blue-50 text-blue-700 px-4 py-1 rounded-full text-xs font-bold border border-blue-100 mb-4 shadow-sm">
                مخصص للأستاذ/ خالد إسماعيل
            </div>
            <p className="text-gray-500 mb-8 text-lg">نظام محاسبي ذكي، بسيط، وفي جيبك.</p>
            <div className="w-full max-w-xs">
                <MobileButton onClick={handleLogin}>تسجيل الدخول بواسطة جوجل</MobileButton>
            </div>
            <div className="absolute bottom-6 text-center opacity-60">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Designed & Developed By</p>
                <div className="flex flex-col items-center text-xs font-bold text-gray-600" dir="ltr">
                    <span>acc-aymanalaa</span>
                    <span className="font-mono">01272725354</span>
                </div>
            </div>
        </div>
    );
};

const SettingsScreen = ({ user, onLogout, darkMode, toggleDarkMode }) => {
    const cardClass = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textMain = darkMode ? 'text-white' : 'text-gray-800';
    const textSub = darkMode ? 'text-gray-400' : 'text-gray-500';

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`${cardClass} p-6 rounded-3xl shadow-sm border flex flex-col items-center text-center relative overflow-hidden`}>
                <div className="absolute top-0 w-full h-20 bg-gradient-to-r from-blue-500 to-blue-600"></div>
                <div className={`w-20 h-20 p-1 rounded-full shadow-lg z-10 mt-4 mb-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <img src={user.photoURL || "https://via.placeholder.com/150"} alt="Profile" className="w-full h-full rounded-full object-cover" />
                </div>
                <h2 className={`font-bold text-lg ${textMain}`}>{user.displayName || 'مستخدم'}</h2>
                <p className={`text-xs ${textSub} mb-4`}>{user.email}</p>
                <MobileButton onClick={onLogout} color="bg-red-50 text-red-600" outline full={false} small>تسجيل الخروج 🚪</MobileButton>
            </div>

            <div className={`${cardClass} rounded-2xl border shadow-sm overflow-hidden`}>
                <div onClick={toggleDarkMode} className={`p-4 border-b flex justify-between items-center cursor-pointer ${darkMode ? 'border-gray-700' : 'border-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <span className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>
                            {darkMode ? '☀️' : '🌙'}
                        </span>
                        <span className={`text-sm font-bold ${textMain}`}>الوضع {darkMode ? 'النهاري' : 'الليلي'}</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 ${darkMode ? 'right-7' : 'right-1'}`}></div>
                    </div>
                </div>
            </div>

            <div className={`${cardClass} p-5 rounded-2xl border shadow-sm space-y-4`}>
                <h3 className={`font-bold text-sm border-b pb-2 ${textMain} ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>حول التطبيق</h3>
                <div className="flex justify-between items-center text-sm">
                    <span className={textSub}>الإصدار</span>
                    <span className={`font-mono px-2 py-0.5 rounded text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>v2.5.0</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className={textSub}>ترخيص لـ</span>
                    <span className="font-bold text-blue-600 text-xs">أ/ خالد إسماعيل</span>
                </div>
                <div className={`p-3 rounded-xl mt-2 ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                    <p className="text-xs text-blue-600 font-bold mb-1">الدعم الفني والتطوير</p>
                    <div className="flex justify-between items-center text-xs text-blue-500" dir="ltr">
                        <span>acc-aymanalaa</span>
                        <span className="font-mono">01272725354</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContactDetailsScreen = ({ contact, transactions, onBack, onAddTransaction, darkMode }) => {
    const contactTransactions = useMemo(() => transactions.filter(t => t.contactId === contact.id), [transactions, contact]);
    const totalPurchased = contactTransactions.filter(t => t.type === 'Sale' || t.type === 'Purchase').reduce((acc, t) => acc + t.amount, 0);
    
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-gray-200' : 'text-gray-800';

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className={`flex items-center gap-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <button onClick={onBack} className={`p-2 rounded-full text-xl ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>➜</button>
                <div>
                    <h2 className={`text-xl font-bold ${text}`}>{contact.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${contact.type === 'Customer' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {contact.type === 'Customer' ? 'عميل' : 'مورد'}
                    </span>
                </div>
            </div>

            <div className={`p-6 rounded-3xl text-white shadow-lg ${contact.balance > 0 ? 'bg-gradient-to-br from-green-500 to-green-700' : contact.balance < 0 ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gray-500'}`}>
                <p className="text-white/80 text-sm mb-1">الرصيد المستحق</p>
                <div className="flex justify-between items-end">
                    <h3 className="text-4xl font-bold">{formatCurrency(Math.abs(contact.balance))}</h3>
                    <span className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                        {contact.balance > 0 ? 'له' : contact.balance < 0 ? 'عليه' : 'خالص'}
                    </span>
                </div>
                <p className="text-xs mt-4 text-white/70 border-t border-white/10 pt-2">
                    {contact.balance > 0 ? 'أنت مدين له (دائن)' : contact.balance < 0 ? 'هو مدين لك (مدين)' : 'لا توجد مديونية'}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className={`${bg} p-3 rounded-2xl border shadow-sm text-center`}>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>حجم التعاملات</p>
                    <p className={`font-bold text-lg ${text}`}>{formatCurrency(totalPurchased)}</p>
                </div>
                <div className={`${bg} p-3 rounded-2xl border shadow-sm text-center`}>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>عدد العمليات</p>
                    <p className={`font-bold text-lg ${text}`}>{contactTransactions.length}</p>
                </div>
            </div>

            <div>
                <h3 className={`font-bold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>كشف الحساب</h3>
                {contactTransactions.length === 0 ? (
                    <div className={`text-center py-8 rounded-2xl border border-dashed ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}>لا توجد حركات.</div>
                ) : (
                    <div className="space-y-3">
                        {contactTransactions.map(t => (
                            <div key={t.id} className={`${bg} p-3 rounded-xl border shadow-sm flex justify-between items-center`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${t.type === 'Sale' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {t.type === 'Sale' ? 'بيع' : 'شراء'}
                                        </span>
                                        <span className="text-xs text-gray-400">{formatDate(t.date)}</span>
                                    </div>
                                    <p className={`text-sm mt-1 font-medium ${text}`}>{t.description || 'بدون وصف'}</p>
                                </div>
                                <div className="text-left">
                                    <p className={`font-bold ${text}`}>{formatCurrency(t.amount)}</p>
                                    {t.creditAmount > 0 && <p className="text-[10px] text-red-500 font-bold">متبقي: {formatCurrency(t.creditAmount)}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="pt-4 pb-8"><MobileButton onClick={() => onAddTransaction(contact.id)}>+ تسجيل عملية جديدة</MobileButton></div>
        </div>
    );
};

const ContactsManagerScreen = ({ contacts, userId, onSelectContact, darkMode }) => {
    const [activeTab, setActiveTab] = useState('Customer');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');

    const filteredContacts = contacts.filter(c => c.type === activeTab);
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-white' : 'text-gray-900';

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            await addDoc(collection(db, 'contacts'), { userId, name: newName, phone: newPhone, type: activeTab, balance: 0, createdAt: new Date().toISOString() });
            setNewName(''); setNewPhone(''); setShowAddForm(false);
        } catch (error) { alert('خطأ: ' + error.message); }
    };

    return (
        <div className="space-y-4">
            <div className={`flex p-1 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button onClick={() => setActiveTab('Customer')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'Customer' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>العملاء</button>
                <button onClick={() => setActiveTab('Supplier')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'Supplier' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>الموردين</button>
            </div>

            {!showAddForm ? (
                <button 
                    onClick={() => setShowAddForm(true)} 
                    className={`w-full py-4 border-2 border-dashed rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${darkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-800' : 'border-gray-300 text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}
                >
                    <span className="text-2xl">+</span> 
                    <span>إضافة {activeTab === 'Customer' ? 'عميل' : 'مورد'} جديد</span>
                </button>
            ) : (
                <form onSubmit={handleAdd} className={`${bg} p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in`}>
                    <h3 className={`font-bold border-b pb-2 ${darkMode ? 'text-white border-gray-700' : 'text-gray-700 border-gray-200'}`}>إضافة {activeTab === 'Customer' ? 'عميل' : 'مورد'} جديد</h3>
                    <div><label className="text-xs text-gray-500">الاسم</label><input value={newName} onChange={e => setNewName(e.target.value)} className={`w-full p-3 border rounded-xl outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`} autoFocus /></div>
                    <div><label className="text-xs text-gray-500">رقم الهاتف (اختياري)</label><input value={newPhone} onChange={e => setNewPhone(e.target.value)} className={`w-full p-3 border rounded-xl outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`} type="tel" /></div>
                    <div className="flex gap-3 pt-2"><MobileButton onClick={() => setShowAddForm(false)} color="bg-gray-500" full={false}>إلغاء</MobileButton><div className="flex-1"><MobileButton type="submit">حفظ</MobileButton></div></div>
                </form>
            )}

            <div className="space-y-2 pb-20">
                {filteredContacts.map(contact => (
                    <div key={contact.id} onClick={() => onSelectContact(contact)} className={`${bg} p-4 rounded-2xl border shadow-sm flex justify-between items-center cursor-pointer active:scale-[0.98]`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-inner ${contact.type === 'Customer' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{contact.name.charAt(0)}</div>
                            <div><p className={`font-bold text-lg ${text}`}>{contact.name}</p><p className="text-xs text-gray-400">{contact.phone || 'رقم غير مسجل'}</p></div>
                        </div>
                        <div className="text-left">
                            {contact.balance === 0 ? <span className="text-xs bg-gray-100 text-gray-400 px-3 py-1 rounded-full font-bold">خالص</span> : (
                                <div className="flex flex-col items-end">
                                    <p className={`font-bold text-lg ${contact.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.abs(contact.balance))}</p>
                                    <p className={`text-[10px] px-1.5 rounded ${contact.balance < 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{contact.balance < 0 ? 'عليه' : 'له'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {filteredContacts.length === 0 && !showAddForm && <div className="text-center py-12"><p className="text-4xl mb-2">📭</p><p className="text-gray-400">القائمة فارغة</p></div>}
            </div>
        </div>
    );
};

const AddTransactionScreen = ({ contacts, inventoryItems, userId, preSelectedContactId, onClose, darkMode }) => {
    const [type, setType] = useState('Sale');
    const [contactId, setContactId] = useState(preSelectedContactId || '');
    const [items, setItems] = useState([]);
    const [paid, setPaid] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [selItemId, setSelItemId] = useState('');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [isQuickAddContact, setIsQuickAddContact] = useState(false);
    const [newContactName, setNewContactName] = useState('');

    const activeContacts = contacts.filter(c => (type === 'Sale' ? c.type === 'Customer' : c.type === 'Purchase' ? c.type === 'Supplier' : false));
    const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0);
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
    const inputBg = darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-200';

    const addItem = () => {
        if (!selItemId || !qty || !price) return;
        const itemDef = inventoryItems.find(i => i.id === selItemId);
        setItems([...items, { id: selItemId, name: itemDef.name, qty: Number(qty), price: Number(price), subtotal: Number(qty) * Number(price) }]);
        setSelItemId(''); setQty(''); setPrice('');
    };

    const handleQuickSaveContact = async () => {
        if (!newContactName.trim()) return;
        setLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'contacts'), { userId, name: newContactName, type: type === 'Sale' ? 'Customer' : 'Supplier', balance: 0, createdAt: new Date().toISOString() });
            setContactId(docRef.id); setIsQuickAddContact(false); setNewContactName('');
        } catch (e) { alert('خطأ: ' + e.message); }
        setLoading(false);
    };

    const saveTransaction = async () => {
        if ((type === 'Sale' || type === 'Purchase') && items.length === 0) return alert('أضف أصناف');
        if ((type === 'Expense' || type === 'Capital') && !amount) return alert('أدخل المبلغ');
        setLoading(true);
        
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(collection(db, 'transactions'));
                let finalAmount = 0, credit = 0, paidAmount = 0;

                if (type === 'Sale' || type === 'Purchase') {
                    finalAmount = totalAmount; paidAmount = Number(paid) || 0; credit = finalAmount - paidAmount;
                } else {
                    finalAmount = Number(amount); paidAmount = finalAmount;
                }
                
                t.set(ref, {
                    userId, type, contactId: contactId || null, 
                    contactName: contacts.find(c => c.id === contactId)?.name || null,
                    amount: finalAmount, paidAmount, creditAmount: credit,
                    date: new Date().toISOString(),
                    description: description || type,
                    items: (type === 'Sale' || type === 'Purchase') ? items.map(i => ({ itemId: i.id, name: i.name, quantity: i.qty, price: i.price })) : null
                });

                if (type === 'Sale' || type === 'Purchase') {
                    for (const item of items) {
                        const iRef = doc(db, 'inventory_items', item.id);
                        const iDoc = await t.get(iRef);
                        const current = iDoc.data();
                        t.update(iRef, { quantity: type === 'Sale' ? current.quantity - item.qty : current.quantity + item.qty });
                    }
                }

                if ((type === 'Sale' || type === 'Purchase') && contactId) {
                    const cRef = doc(db, 'contacts', contactId);
                    const cDoc = await t.get(cRef);
                    const change = type === 'Purchase' ? credit : -credit;
                    t.update(cRef, { balance: (cDoc.data().balance || 0) + change });
                }
            });
            onClose();
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="space-y-5">
            <div className={`flex p-1 rounded-2xl overflow-x-auto ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button onClick={() => setType('Sale')} className={`flex-1 py-2 min-w-[70px] rounded-xl font-bold text-xs transition-all ${type === 'Sale' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بيع</button>
                <button onClick={() => setType('Purchase')} className={`flex-1 py-2 min-w-[70px] rounded-xl font-bold text-xs transition-all ${type === 'Purchase' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>شراء</button>
                <button onClick={() => setType('Expense')} className={`flex-1 py-2 min-w-[70px] rounded-xl font-bold text-xs transition-all ${type === 'Expense' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>مصروف</button>
                <button onClick={() => setType('Capital')} className={`flex-1 py-2 min-w-[70px] rounded-xl font-bold text-xs transition-all ${type === 'Capital' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>رأس مال</button>
            </div>

            {(type === 'Sale' || type === 'Purchase') && (
                <>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500 pr-2">العميل / المورد</label>
                        {!isQuickAddContact ? (
                            <div className="flex gap-2">
                                <select value={contactId} onChange={e => setContactId(e.target.value)} className={`flex-1 p-4 border rounded-xl shadow-sm outline-none ${inputBg}`} disabled={!!preSelectedContactId}>
                                    <option value="">اختر من القائمة...</option>
                                    {activeContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button onClick={() => setIsQuickAddContact(true)} className="bg-blue-100 text-blue-600 px-4 rounded-xl text-2xl font-bold hover:bg-blue-200 transition-colors" disabled={!!preSelectedContactId}>+</button>
                            </div>
                        ) : (
                            <div className="flex gap-2 animate-in fade-in">
                                <input autoFocus value={newContactName} onChange={(e) => setNewContactName(e.target.value)} className={`flex-1 p-4 border rounded-xl shadow-sm outline-none ${inputBg}`} placeholder="الاسم الجديد" />
                                <button onClick={handleQuickSaveContact} className="bg-blue-600 text-white px-4 rounded-xl font-bold shadow">حفظ</button>
                                <button onClick={() => setIsQuickAddContact(false)} className="bg-gray-200 text-gray-600 px-3 rounded-xl">X</button>
                            </div>
                        )}
                    </div>

                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} p-4 rounded-2xl border space-y-3`}>
                        <p className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>إضافة أصناف</p>
                        <div className="flex gap-2">
                            <select value={selItemId} onChange={e => {
                                setSelItemId(e.target.value);
                                const i = inventoryItems.find(x => x.id === e.target.value);
                                if(i) setPrice(type === 'Sale' ? (i.lastPurchasePrice * 1.2) : i.lastPurchasePrice); 
                            }} className={`flex-[2] p-3 border rounded-xl text-sm ${inputBg}`}>
                                <option value="">اختر الصنف...</option>
                                {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>)}
                            </select>
                            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="العدد" className={`flex-1 p-3 border rounded-xl text-sm text-center ${inputBg}`}/>
                        </div>
                        <div className="flex gap-2">
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="السعر" className={`flex-[2] p-3 border rounded-xl text-sm text-center ${inputBg}`}/>
                            <button onClick={addItem} className="flex-1 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md">أضف +</button>
                        </div>
                    </div>

                    {items.length > 0 && (
                        <div className={`border rounded-2xl overflow-hidden shadow-sm ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <table className={`w-full text-sm text-right ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
                                <thead className={darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}><tr><th className="p-3">الصنف</th><th className="p-3">العدد</th><th className="p-3">الإجمالي</th></tr></thead>
                                <tbody>
                                    {items.map((i, idx) => (
                                        <tr key={idx} className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}><td className="p-3">{i.name}</td><td className="p-3">{i.qty}</td><td className="p-3 font-bold">{formatCurrency(i.subtotal)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className={`p-4 text-left font-bold border-t flex justify-between items-center ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'}`}>
                                <span>إجمالي الفاتورة</span>
                                <span className="text-lg text-blue-600">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    )}

                    <div className={`${bg} p-4 rounded-2xl border shadow-sm space-y-3`}>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-500">المدفوع كاش:</span>
                            <input type="number" value={paid} onChange={e => setPaid(e.target.value)} className="flex-1 p-2 text-xl font-bold text-green-600 outline-none text-left border-b border-gray-200 focus:border-green-500 bg-transparent" placeholder="0" />
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                            <span className="text-gray-500">المتبقي (يسجل عليه):</span>
                            <span className="font-bold text-red-600 text-lg">{formatCurrency(totalAmount - (Number(paid)||0))}</span>
                        </div>
                    </div>
                </>
            )}

            {(type === 'Expense' || type === 'Capital') && (
                <div className={`${bg} p-5 rounded-2xl border shadow-sm space-y-4`}>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">{type === 'Expense' ? 'قيمة المصروف' : 'المبلغ'}</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={`w-full p-4 border rounded-xl text-xl font-bold text-center outline-none ${inputBg}`} placeholder="0.00" autoFocus />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">بيان / ملاحظات</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={`w-full p-3 border rounded-xl outline-none ${inputBg}`} placeholder={type === 'Expense' ? 'مثال: إيجار، كهرباء...' : 'مثال: زيادة رأس مال...'} />
                    </div>
                </div>
            )}

            <div className="flex gap-3 pt-2 pb-8">
                <div className="flex-[2]"><MobileButton onClick={saveTransaction} disabled={loading}>{loading ? 'جارٍ الحفظ...' : '✅ حفظ العملية'}</MobileButton></div>
                <MobileButton onClick={onClose} color="bg-gray-500" outline full={false}>إلغاء</MobileButton>
            </div>
        </div>
    );
};

const Dashboard = ({ summary, onNavigate, darkMode }) => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center px-2">
            <h2 className={`font-bold text-xl ${darkMode ? 'text-white' : 'text-gray-800'}`}>لوحة التحكم</h2>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100 font-bold">أ/ خالد إسماعيل</span>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl text-white shadow-xl shadow-blue-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10">
                <p className="text-blue-100 mb-1 text-sm font-medium">السيولة النقدية (الكاش)</p>
                <h2 className="text-5xl font-bold tracking-tight">{formatCurrency(summary.cash)}</h2>
                <p className="text-xs text-blue-200 mt-2 opacity-80">صافي الحركة النقدية في الخزينة</p>
            </div>
        </div>

        <div>
            <h3 className={`font-bold mb-4 text-lg ${darkMode ? 'text-gray-300' : 'text-gray-800'}`}>الأداء المالي</h3>
            <div className="grid grid-cols-2 gap-3">
                <InfoCard title="إجمالي المبيعات" value={formatCurrency(summary.tSales)} type="info" icon="🛒" darkMode={darkMode} />
                <InfoCard title="إجمالي المشتريات" value={formatCurrency(summary.tPurchases)} type="warning" icon="🚚" darkMode={darkMode} />
                <InfoCard title="المصروفات" value={formatCurrency(summary.tExpenses)} type="danger" icon="💸" darkMode={darkMode} />
            </div>
        </div>

        <div>
            <h3 className={`font-bold mb-4 text-lg ${darkMode ? 'text-gray-300' : 'text-gray-800'}`}>ملخص الأرصدة</h3>
            <div className="grid grid-cols-2 gap-4">
                <InfoCard title="لي (عند العملاء)" value={formatCurrency(summary.owedToMe)} type="success" icon="📉" onClick={() => onNavigate('Contacts')} darkMode={darkMode} />
                <InfoCard title="علي (للموردين)" value={formatCurrency(summary.iOwe)} type="danger" icon="📈" onClick={() => onNavigate('Contacts')} darkMode={darkMode} />
            </div>
        </div>
    </div>
);

const App = () => {
    const [user, setUser] = useState(null);
    const [screen, setScreen] = useState('Dashboard');
    const [selectedContact, setSelectedContact] = useState(null);
    const [data, setData] = useState({ contacts: [], transactions: [], inventory: [] });
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

    useEffect(() => {
        if (!user) return;
        const unsub1 = onSnapshot(query(collection(db, 'contacts'), where('userId', '==', user.uid)), s => setData(d => ({ ...d, contacts: mapSnapshotToData(s) })));
        const unsub2 = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid)), s => setData(d => ({ ...d, transactions: mapSnapshotToData(s) })));
        const unsub3 = onSnapshot(query(collection(db, 'inventory_items'), where('userId', '==', user.uid)), s => setData(d => ({ ...d, inventory: mapSnapshotToData(s) })));
        return () => { unsub1(); unsub2(); unsub3(); };
    }, [user]);

    const summary = useMemo(() => {
        let owedToMe = 0, iOwe = 0, cash = 0;
        let tSales = 0, tPurchases = 0, tExpenses = 0;

        data.contacts.forEach(c => {
            if (c.balance < 0) owedToMe += Math.abs(c.balance);
            if (c.balance > 0) iOwe += c.balance;
        });
        data.transactions.forEach(t => {
            if (t.type === 'Sale') { cash += t.paidAmount || 0; tSales += t.amount || 0; }
            if (t.type === 'Purchase') { cash -= t.paidAmount || 0; tPurchases += t.amount || 0; }
            if (t.type === 'Expense') { cash -= t.amount || 0; tExpenses += t.amount || 0; }
            if (t.type === 'Capital') { cash += t.amount || 0; }
        });
        return { owedToMe, iOwe, cash, tSales, tPurchases, tExpenses };
    }, [data]);

    if (!user) return <LoginScreen />;

    return (
        <div className={`min-h-screen flex justify-center font-sans transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`} dir="rtl">
            <div className={`w-full max-w-md min-h-screen shadow-2xl relative flex flex-col border-x transition-colors duration-300 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                {screen !== 'Dashboard' && (
                    <div className={`p-4 sticky top-0 z-20 border-b flex items-center justify-between shadow-sm ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
                        <button onClick={() => { if (selectedContact) { setSelectedContact(null); } else { setScreen('Dashboard'); } }} className={`p-2 rounded-full text-xl ${darkMode ? 'text-white hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}>➜</button>
                        <h1 className="font-bold text-lg">{selectedContact ? 'تفاصيل الحساب' : screen === 'Contacts' ? 'العملاء والموردين' : screen === 'Inventory' ? 'المخزون' : screen === 'Settings' ? 'الإعدادات' : 'حركة جديدة'}</h1>
                        <div className="w-8"></div>
                    </div>
                )}

                <div className={`flex-1 overflow-y-auto p-5 pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50/50'}`}>
                    {screen === 'Dashboard' && <Dashboard summary={summary} onNavigate={setScreen} darkMode={darkMode} />}
                    {screen === 'Contacts' && !selectedContact && <ContactsManagerScreen contacts={data.contacts} userId={user.uid} onSelectContact={(c) => setSelectedContact(c)} darkMode={darkMode} />}
                    {screen === 'Contacts' && selectedContact && <ContactDetailsScreen contact={selectedContact} transactions={data.transactions} onBack={() => setSelectedContact(null)} onAddTransaction={() => setScreen('TransactionForm')} darkMode={darkMode} />}
                    {screen === 'TransactionForm' && <AddTransactionScreen contacts={data.contacts} inventoryItems={data.inventory} userId={user.uid} preSelectedContactId={selectedContact?.id} onClose={() => { setScreen(selectedContact ? 'Contacts' : 'Dashboard'); }} darkMode={darkMode} />}
                    {screen === 'Settings' && <SettingsScreen user={user} onLogout={() => signOut(auth)} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} />}
                    {screen === 'Inventory' && <div className="text-center py-20"><p className="text-6xl mb-4">🚧</p><p className="font-bold">قريباً</p><div className="mt-6"><MobileButton onClick={() => setScreen('Dashboard')} color="bg-gray-500" outline full={false}>عودة</MobileButton></div></div>}
                </div>

                <div className="absolute bottom-0 w-full z-20">
                    <div className={`text-center py-1 border-t text-[9px] font-mono ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>Dev: acc-aymanalaa | 01272725354</div>
                    <div className={`border-t flex justify-around items-end pb-4 pt-2 px-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
                        <button onClick={() => setScreen('Dashboard')} className={`flex flex-col items-center w-16 ${screen === 'Dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">🏠</span><span className="text-[10px] font-bold">الرئيسية</span></button>
                        <button onClick={() => setScreen('Contacts')} className={`flex flex-col items-center w-16 ${screen === 'Contacts' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">👥</span><span className="text-[10px] font-bold">العملاء</span></button>
                        <div className="relative -top-5"><button onClick={() => setScreen('TransactionForm')} className={`w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-200 hover:scale-105 transition-transform border-4 ${darkMode ? 'border-gray-900' : 'border-gray-50'}`}>+</button></div>
                        <button onClick={() => setScreen('Inventory')} className={`flex flex-col items-center w-16 ${screen === 'Inventory' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">📦</span><span className="text-[10px] font-bold">المخزون</span></button>
                        <button onClick={() => setScreen('Settings')} className={`flex flex-col items-center w-16 ${screen === 'Settings' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">⚙️</span><span className="text-[10px] font-bold">الإعدادات</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;