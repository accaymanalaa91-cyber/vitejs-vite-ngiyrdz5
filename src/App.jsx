import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, doc, runTransaction, where, deleteDoc, getDoc, updateDoc, setDoc, enableIndexedDbPersistence } from 'firebase/firestore';

// ------------------------------------------------------------------
// 1. إعدادات Firebase
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDMF65H0Sa5B_CC1h-pRGxhVHEjPaHmRRc",
  authDomain: "financial-manager-2d1c3.firebaseapp.com",
  projectId: "financial-manager-2d1c3",
  storageBucket: "financial-manager-2d1c3.firebasestorage.app",
  messagingSenderId: "730372364290",
  appId: "1:730372364290:web:014e9fd1566f178d926f1b"
};

// تهيئة التطبيق
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    enableIndexedDbPersistence(db).catch((err) => console.log("Persistence:", err.code));
} catch (error) {
    console.error("Firebase Init Error:", error);
}

// ------------------------------------------------------------------
// 2. دوال مساعدة
// ------------------------------------------------------------------

const safeMath = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

const mapSnapshotToData = (snapshot) => {
    const data = [];
    snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
    });
    if (data.length > 0 && data[0].date) {
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return data;
};

const formatCurrency = (amount) => {
    const val = safeMath(amount);
    return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString('ar-EG', {
            day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    } catch (e) { return ''; }
};

// ------------------------------------------------------------------
// 3. المكونات (Components)
// ------------------------------------------------------------------

const NotificationToast = ({ notification, onClose }) => {
    if (!notification) return null;
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [notification, onClose]);
    return (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-md p-4 rounded-xl shadow-2xl flex items-center justify-between transition-all ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white`} dir="rtl">
            <span className="font-bold text-sm">{String(notification.message)}</span>
            <button onClick={onClose} className="text-white font-bold px-2">&times;</button>
        </div>
    );
};

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

const InfoCard = ({ title, value, icon, type = 'neutral', onClick, darkMode }) => {
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
            </div>
            {icon && <div className={`p-3 rounded-full shadow-sm text-2xl ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}>{icon}</div>}
        </div>
    );
};

const SearchBar = ({ value, onChange, placeholder, darkMode }) => (
    <div className="relative w-full mb-2">
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full p-2 pr-8 rounded-xl border outline-none text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">🔍</div>
    </div>
);

// ------------------------------------------------------------------
// 4. الشاشات (Screens)
// ------------------------------------------------------------------

const LoginScreen = () => {
    const handleLogin = async () => {
        if (!auth) return;
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert("فشل الدخول: " + e.message); }
    };
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center relative" dir="rtl">
            <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl mb-6">
                <span className="text-5xl">💰</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">مديرك المالي</h1>
            <div className="bg-blue-50 text-blue-700 px-4 py-1 rounded-full text-xs font-bold border border-blue-100 mb-4">
                مخصص للأستاذ/ خالد إسماعيل
            </div>
            <div className="w-full max-w-xs">
                <MobileButton onClick={handleLogin}>تسجيل الدخول بواسطة جوجل</MobileButton>
            </div>
        </div>
    );
};

const Dashboard = ({ summary, onNavigate, darkMode }) => (
    <div className="space-y-5 animate-in fade-in">
        <div className="flex justify-between px-2 items-center">
            <h2 className={`font-bold text-xl ${darkMode ? 'text-white' : 'text-gray-800'}`}>لوحة التحكم</h2>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold border border-blue-100">أ/ خالد إسماعيل</span>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10 text-center">
                <p className="text-blue-100 mb-2 text-sm">النقدية المتاحة</p>
                <h2 className="text-5xl font-bold">{formatCurrency(summary.cash)}</h2>
            </div>
        </div>
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-100'} p-5 rounded-2xl border flex justify-between items-center shadow-sm`}>
            <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>رأس المال المستثمر</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.investedCapital)}</p>
            </div>
            <div className="text-4xl p-3 bg-blue-50 rounded-full">💰</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InfoCard title="مبيعات" value={formatCurrency(summary.tSales)} type="info" icon="🛒" darkMode={darkMode} />
            <InfoCard title="مشتريات" value={formatCurrency(summary.tPurchases)} type="warning" icon="🚚" darkMode={darkMode} />
            <InfoCard title="مصروفات" value={formatCurrency(summary.tExpenses)} type="danger" icon="💸" darkMode={darkMode} />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InfoCard title="لي (عند العملاء)" value={formatCurrency(summary.owedToMe)} type="success" icon="📉" onClick={() => onNavigate('Contacts')} darkMode={darkMode} />
            <InfoCard title="علي (للموردين)" value={formatCurrency(summary.iOwe)} type="danger" icon="📈" onClick={() => onNavigate('Contacts')} darkMode={darkMode} />
        </div>
    </div>
);

const HistoryScreen = ({ transactions, darkMode, onEditTransaction, onDeleteTransaction }) => {
    const [search, setSearch] = useState('');
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-white' : 'text-gray-900';
    const textSub = darkMode ? 'text-gray-400' : 'text-gray-600';

    const filtered = transactions.filter(t => {
        const s = search.toLowerCase();
        const name = (t.contactName || '').toLowerCase();
        const amt = (t.amount || 0).toString();
        return name.includes(s) || amt.includes(s);
    });

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center px-1">
                <h2 className={`font-bold text-lg ${text}`}>سجل المعاملات</h2>
                <span className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">{filtered.length} عملية</span>
            </div>
            <SearchBar value={search} onChange={setSearch} placeholder="ابحث..." darkMode={darkMode} />
            <div className="space-y-3">
                {filtered.map(t => (
                    <div key={t.id} className={`${bg} p-3 rounded-xl border shadow-sm relative group`}>
                        <div onClick={() => onEditTransaction(t)} className="cursor-pointer">
                            <div className="flex items-center gap-2 justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${t.type === 'Sale' ? 'bg-green-100 text-green-700' : t.type === 'Purchase' ? 'bg-orange-100 text-orange-700' : t.type === 'Expense' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {t.type === 'Sale' ? 'بيع' : t.type === 'Purchase' ? 'شراء' : t.type === 'Expense' ? 'مصروف' : t.type === 'Settlement' ? 'سداد' : 'رأس مال'}
                                    </span>
                                    <span className={`text-xs ${textSub}`}>{formatDate(t.date)}</span>
                                </div>
                                <span className="text-[10px] text-blue-500 px-1">✎</span>
                            </div>
                            <p className={`text-sm font-medium ${text}`}>{String(t.contactName || t.description)}</p>
                            <div className="flex justify-between items-end mt-1">
                                <p className={`font-bold ${text}`}>{formatCurrency(t.amount)}</p>
                                {t.creditAmount > 0 && <p className="text-[10px] text-red-500 font-bold">متبقي: {formatCurrency(t.creditAmount)}</p>}
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteTransaction(t); }} className="absolute top-2 left-2 p-2 text-red-500 opacity-50 hover:opacity-100 z-10">🗑️</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingsScreen = ({ user, onLogout, darkMode, toggleDarkMode }) => {
    const cardClass = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textMain = darkMode ? 'text-white' : 'text-gray-800';
    return (
        <div className="space-y-5 animate-in fade-in">
            <div className={`${cardClass} p-6 rounded-3xl shadow-sm border flex flex-col items-center`}>
                <h2 className={`font-bold text-lg ${textMain}`}>{user.displayName}</h2>
                <p className="text-xs text-gray-500 mb-4">{user.email}</p>
                <MobileButton onClick={onLogout} color="bg-red-50 text-red-600" outline full={false} small>تسجيل الخروج</MobileButton>
            </div>
            <div className={`${cardClass} rounded-2xl border shadow-sm p-4 flex justify-between cursor-pointer`} onClick={toggleDarkMode}>
                <span className={`text-sm font-bold ${textMain}`}>الوضع الليلي</span>
                <div className={`w-10 h-5 rounded-full relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-1 ${darkMode ? 'right-6' : 'right-1'}`}></div></div>
            </div>
        </div>
    );
};

const ContactDetailsScreen = ({ contact, transactions, onBack, onAddTransaction, darkMode }) => {
    const contactTransactions = useMemo(() => transactions.filter(t => t.contactId === contact.id), [transactions, contact]);
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-gray-200' : 'text-gray-800';
    const textSub = darkMode ? 'text-gray-400' : 'text-gray-600';

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className={`flex items-center gap-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <button onClick={onBack} className="p-2 rounded-full text-xl">➜</button>
                <h2 className={`text-xl font-bold ${text}`}>{contact.name}</h2>
            </div>
            
            {/* بيانات الاتصال */}
            <div className={`${bg} p-3 rounded-xl border text-sm`}>
                <div className="flex justify-between items-center mb-1">
                    <span className={textSub}>الهاتف:</span>
                    <span className={`font-bold ${text}`} dir="ltr">{contact.phone || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className={textSub}>العنوان:</span>
                    <span className={`font-bold ${text}`}>{contact.address || '-'}</span>
                </div>
            </div>

            <div className={`p-6 rounded-3xl text-white shadow-lg ${contact.balance > 0 ? 'bg-green-600' : contact.balance < 0 ? 'bg-red-600' : 'bg-gray-500'}`}>
                <p className="text-white/80 text-sm mb-1">الرصيد المستحق</p>
                <div className="flex justify-between items-end">
                    <h3 className="text-4xl font-bold">{formatCurrency(Math.abs(contact.balance))}</h3>
                    <span className="bg-white/20 px-3 py-1 rounded-lg text-sm">{contact.balance > 0 ? 'له' : contact.balance < 0 ? 'عليه' : 'خالص'}</span>
                </div>
            </div>
            
            <div className="space-y-3">
                {contactTransactions.map(t => (
                    <div key={t.id} className={`${bg} p-3 rounded-xl border shadow-sm flex justify-between items-center`}>
                        <div>
                            <p className={`text-xs text-gray-400`}>{formatDate(t.date)}</p>
                            <p className={`text-sm font-bold ${text}`}>{t.type === 'Sale' ? 'بيع' : t.type === 'Purchase' ? 'شراء' : 'دفعة'}</p>
                        </div>
                        <p className={`font-bold ${text}`}>{formatCurrency(t.amount)}</p>
                    </div>
                ))}
            </div>
            <div className="pt-4 pb-8"><MobileButton onClick={() => onAddTransaction(contact.id)}>+ عملية جديدة</MobileButton></div>
        </div>
    );
};

const ContactsManagerScreen = ({ contacts, userId, onSelectContact, darkMode }) => {
    const [activeTab, setActiveTab] = useState('Customer');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-white' : 'text-gray-900';
    const inputBg = darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-200';

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName) return;
        try { 
            await addDoc(collection(db, 'contacts'), { 
                userId, 
                name: newName, 
                phone: newPhone,
                address: newAddress,
                type: activeTab, 
                balance: 0, 
                createdAt: new Date().toISOString() 
            }); 
            setNewName(''); setNewPhone(''); setNewAddress(''); setShowAddForm(false); 
        } catch (e) { alert(e.message); }
    };

    const filtered = contacts.filter(c => c.type === activeTab);
    return (
        <div className="space-y-4">
            <div className={`flex p-1 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button onClick={() => setActiveTab('Customer')} className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'Customer' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>العملاء</button>
                <button onClick={() => setActiveTab('Supplier')} className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'Supplier' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>الموردين</button>
            </div>
            {!showAddForm ? (
                <button onClick={() => setShowAddForm(true)} className={`w-full py-3 border-2 border-dashed rounded-xl font-bold ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}>+ إضافة {activeTab === 'Customer' ? 'عميل' : 'مورد'}</button>
            ) : (
                <form onSubmit={handleAdd} className={`${bg} p-4 rounded-xl border space-y-3 animate-in fade-in`}>
                    <h3 className={`font-bold text-sm mb-2 ${text}`}>بيانات {activeTab === 'Customer' ? 'العميل' : 'المورد'} الجديد</h3>
                    <input value={newName} onChange={e => setNewName(e.target.value)} className={`w-full p-2 rounded border ${inputBg}`} placeholder="الاسم" autoFocus />
                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)} className={`w-full p-2 rounded border ${inputBg}`} placeholder="رقم الهاتف" type="tel" />
                    <input value={newAddress} onChange={e => setNewAddress(e.target.value)} className={`w-full p-2 rounded border ${inputBg}`} placeholder="العنوان" />
                    <div className="flex gap-2 pt-2">
                        <MobileButton onClick={() => setShowAddForm(false)} color="bg-gray-500" full={false}>إلغاء</MobileButton>
                        <div className="flex-1"><MobileButton type="submit">حفظ</MobileButton></div>
                    </div>
                </form>
            )}
            <div className="space-y-2 pb-20">
                {filtered.map(c => (
                    <div key={c.id} onClick={() => onSelectContact(c)} className={`${bg} p-4 rounded-2xl border shadow-sm flex justify-between cursor-pointer`}>
                        <p className={`font-bold ${text}`}>{c.name}</p>
                        <div className="text-left"><p className={`font-bold ${c.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.abs(c.balance))}</p><p className="text-[10px] text-gray-400">{c.balance < 0 ? 'عليه' : 'له'}</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const InventoryManagement = ({ inventoryItems, darkMode }) => {
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-white' : 'text-gray-900';
    return (
        <div className="space-y-4 animate-in fade-in">
            <h2 className={`font-bold text-lg px-1 ${text}`}>المخزون</h2>
            {inventoryItems.length === 0 ? (
                 <div className={`text-center py-12 rounded-2xl border border-dashed ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                    <p className="text-gray-500">لا يوجد أصناف</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {inventoryItems.map(item => (
                         <div key={item.id} className={`${bg} p-3 rounded-xl border shadow-sm flex justify-between`}>
                            <div>
                                <span className={`${text} font-bold`}>{item.name}</span>
                                {item.unit && <span className="text-xs text-gray-400 block">({String(item.unit)})</span>}
                            </div>
                            <span className={`font-bold ${item.quantity < 5 ? 'text-red-500' : 'text-green-500'}`}>{item.quantity}</span>
                         </div>
                    ))}
                </div>
            )}
        </div>
    )
};

const AddTransactionScreen = ({ contacts, inventoryItems, userId, preSelectedContactId, onClose, darkMode, transactionToEdit, notify }) => {
    const defaultDate = transactionToEdit ? new Date(transactionToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const [type, setType] = useState(transactionToEdit?.type || 'Sale');
    const [contactId, setContactId] = useState(transactionToEdit?.contactId || preSelectedContactId || '');
    const [items, setItems] = useState(transactionToEdit?.items?.map(i => ({ id: i.itemId, name: i.name, unit: i.unit || 'قطعة', qty: i.quantity, price: i.price, subtotal: i.quantity * i.price })) || []);
    const [paid, setPaid] = useState(transactionToEdit ? transactionToEdit.paidAmount : '');
    const [amount, setAmount] = useState(transactionToEdit ? transactionToEdit.amount : '');
    const [description, setDescription] = useState(transactionToEdit?.description || '');
    const [txnDate, setTxnDate] = useState(defaultDate);
    const [loading, setLoading] = useState(false);
    
    const [itemName, setItemName] = useState('');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [unit, setUnit] = useState('قطعة');
    const [isQuickAddContact, setIsQuickAddContact] = useState(false);
    const [newContactName, setNewContactName] = useState('');

    const activeContacts = contacts.filter(c => {
        if (type === 'Sale') return c.type === 'Customer';
        if (type === 'Purchase') return c.type === 'Supplier';
        return true;
    });
    const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0);
    const inputBg = darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-200';
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

    const addItem = () => {
        if (!itemName || !qty || !price) return;
        const existingItem = inventoryItems.find(i => i.name === itemName);
        let id = existingItem ? existingItem.id : `NEW_${Date.now()}`;
        let isNew = !existingItem;
        const finalUnit = existingItem ? (existingItem.unit || unit) : unit;

        setItems([...items, { id, name: itemName, unit: finalUnit, qty: Number(qty), price: Number(price), subtotal: safeMath(Number(qty)*Number(price)), isNew }]);
        setItemName(''); setQty(''); setPrice(''); setUnit('قطعة');
    };

    const handleQuickContact = async () => {
        if (!newContactName) return;
        setLoading(true);
        try {
            const ref = await addDoc(collection(db, 'contacts'), { userId, name: newContactName, type: type==='Sale'?'Customer':'Supplier', balance: 0, createdAt: new Date().toISOString() });
            setContactId(ref.id); setIsQuickAddContact(false); setNewContactName('');
        } catch(e){alert('Error');}
        setLoading(false);
    };

    const save = async () => {
        if ((type === 'Sale' || type === 'Purchase') && items.length === 0) return alert('أضف أصناف');
        if ((type === 'Expense' || type === 'Capital' || type === 'Settlement') && !amount) return alert('أدخل المبلغ');
        setLoading(true);
        try {
            await runTransaction(db, async (t) => {
                // 1. READS
                const readOps = [];
                if (t.items) t.items.forEach(i => readOps.push(doc(db, 'inventory_items', i.itemId)));
                if (t.contactId) readOps.push(doc(db, 'contacts', t.contactId));
                const snaps = await Promise.all(readOps.map(r => tr.get(r)));
                const invMap = new Map(snaps.filter(s => s.ref.path.includes('inventory')).map(s => [s.id, s]));
                const contactSnap = snaps.find(s => s.ref.path.includes('contacts'));

                // 2. WRITES
                if (t.items) {
                    t.items.forEach(i => {
                        const d = invMap.get(i.itemId);
                        if(d && d.exists()) tr.update(d.ref, { quantity: t.type==='Sale' ? d.data().quantity + i.quantity : d.data().quantity - i.quantity });
                    });
                }
                if (t.contactId && contactSnap && contactSnap.exists()) {
                    let rev = 0;
                    if(t.type==='Sale') rev = -t.creditAmount;
                    if(t.type==='Purchase') rev = t.creditAmount;
                    if(t.type==='Settlement') { const isCust = data.contacts.find(c=>c.id===t.contactId)?.type==='Customer'; rev = isCust ? t.amount : -t.amount; }
                    tr.update(contactSnap.ref, { balance: (contactSnap.data().balance||0) + rev });
                }
                tr.delete(doc(db, 'transactions', t.id));
            });
            notify('تم الحذف', 'success');
        } catch(e) { alert('Error'); }
    };

    if (!user) return <LoginScreen />;

    return (
        <div className={`min-h-screen flex justify-center font-sans transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`} dir="rtl">
            <div className={`w-full max-w-md min-h-screen shadow-2xl relative flex flex-col border-x transition-colors duration-300 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <NotificationToast notification={notification} onClose={() => setNotification(null)} />
                {isOffline && <div className="bg-red-500 text-white text-center text-xs p-1">وضع عدم الاتصال</div>}
                
                {screen !== 'Dashboard' && (
                    <div className={`p-4 sticky top-0 z-20 border-b flex items-center justify-between shadow-sm ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
                        <button onClick={() => { if (selectedContact) { setSelectedContact(null); } else { setScreen('Dashboard'); setTransactionToEdit(null); } }} className={`p-2 rounded-full text-xl ${darkMode ? 'text-white hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}>➜</button>
                        <h1 className="font-bold text-lg">{selectedContact ? 'تفاصيل الحساب' : screen === 'Contacts' ? 'العملاء والموردين' : screen === 'Inventory' ? 'المخزون' : screen === 'Settings' ? 'الإعدادات' : screen === 'History' ? 'سجل المعاملات' : transactionToEdit ? 'تعديل عملية' : 'حركة جديدة'}</h1>
                        <div className="w-8"></div>
                    </div>
                )}
                <div className={`flex-1 overflow-y-auto p-5 pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50/50'}`}>
                    {screen === 'Dashboard' && <Dashboard summary={summary} onNavigate={setScreen} darkMode={darkMode} />}
                    {screen === 'Contacts' && !selectedContact && <ContactsManagerScreen contacts={data.contacts} userId={user.uid} onSelectContact={(c) => setSelectedContact(c)} darkMode={darkMode} />}
                    {screen === 'Contacts' && selectedContact && <ContactDetailsScreen contact={selectedContact} transactions={data.transactions} onBack={() => setSelectedContact(null)} onAddTransaction={() => setScreen('TransactionForm')} darkMode={darkMode} />}
                    {screen === 'TransactionForm' && <AddTransactionScreen contacts={data.contacts} inventoryItems={data.inventory} userId={user.uid} preSelectedContactId={selectedContact?.id} onClose={() => { setScreen(selectedContact ? 'Contacts' : 'Dashboard'); setTransactionToEdit(null); }} darkMode={darkMode} transactionToEdit={transactionToEdit} notify={notify} />}
                    {screen === 'Settings' && <SettingsScreen user={user} onLogout={() => signOut(auth)} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} />}
                    {screen === 'History' && <HistoryScreen transactions={data.transactions} darkMode={darkMode} onEditTransaction={(t) => { setTransactionToEdit(t); setScreen('TransactionForm'); }} onDeleteTransaction={handleDelete} />}
                    {screen === 'Inventory' && <InventoryManagement inventoryItems={data.inventory} darkMode={darkMode} />}
                </div>
                <div className="absolute bottom-0 w-full z-20">
                    <div className={`text-center py-1 border-t text-[9px] font-mono ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>Dev: acc-aymanalaa | 01272725354</div>
                    <div className={`border-t flex justify-around items-end pb-4 pt-2 px-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
                        <button onClick={() => setScreen('Dashboard')} className={`flex flex-col items-center w-16 ${screen === 'Dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">🏠</span><span className="text-[10px] font-bold">الرئيسية</span></button>
                        <button onClick={() => setScreen('Contacts')} className={`flex flex-col items-center w-16 ${screen === 'Contacts' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">👥</span><span className="text-[10px] font-bold">العملاء</span></button>
                        <div className="relative -top-5"><button onClick={() => { setTransactionToEdit(null); setScreen('TransactionForm'); }} className={`w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-200 hover:scale-105 transition-transform border-4 ${darkMode ? 'border-gray-900' : 'border-gray-50'}`}>+</button></div>
                        <button onClick={() => setScreen('History')} className={`flex flex-col items-center w-16 ${screen === 'History' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">🕒</span><span className="text-[10px] font-bold">السجل</span></button>
                        <button onClick={() => setScreen('Settings')} className={`flex flex-col items-center w-16 ${screen === 'Settings' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}><span className="text-2xl mb-1">⚙️</span><span className="text-[10px] font-bold">الإعدادات</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;