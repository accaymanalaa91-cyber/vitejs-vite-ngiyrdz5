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
    // محاولة تفعيل العمل بدون إنترنت
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

const InfoCard = ({ title, value, subValue, icon, type = 'neutral', onClick, darkMode }) => {
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
                <MobileButton onClick={onLogout} color="bg-red-50 text-red-600" outline full={false} small>خروج</MobileButton>
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
    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className={`flex items-center gap-3 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <button onClick={onBack} className="p-2 rounded-full text-xl">➜</button>
                <h2 className={`text-xl font-bold ${text}`}>{contact.name}</h2>
            </div>
            <div className={`p-6 rounded-3xl text-white shadow-lg ${contact.balance > 0 ? 'bg-green-600' : contact.balance < 0 ? 'bg-red-600' : 'bg-gray-500'}`}>
                <p className="text-white/80 text-sm mb-1">الرصيد</p>
                <h3 className="text-4xl font-bold">{formatCurrency(Math.abs(contact.balance))}</h3>
                <span className="text-xs">{contact.balance > 0 ? 'له (دائن)' : contact.balance < 0 ? 'عليه (مدين)' : 'خالص'}</span>
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
    const bg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const text = darkMode ? 'text-white' : 'text-gray-900';

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName) return;
        try { await addDoc(collection(db, 'contacts'), { userId, name: newName, type: activeTab, balance: 0 }); setNewName(''); setShowAddForm(false); } catch (e) { alert(e.message); }
    };

    const filtered = contacts.filter(c => c.type === activeTab);
    return (
        <div className="space-y-4">
            <div className={`flex p-1 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button onClick={() => setActiveTab('Customer')} className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'Customer' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>العملاء</button>
                <button onClick={() => setActiveTab('Supplier')} className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'Supplier' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>الموردين</button>
            </div>
            {!showAddForm ? <button onClick={() => setShowAddForm(true)} className="w-full py-3 border-2 border-dashed rounded-xl font-bold text-gray-400">+ إضافة</button> : 
            <form onSubmit={handleAdd} className={`${bg} p-4 rounded-xl border space-y-3`}><input value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-2 rounded border text-black" placeholder="الاسم" /><MobileButton type="submit">حفظ</MobileButton></form>}
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
                if (transactionToEdit) {
                    if (transactionToEdit.items) {
                        for (const i of transactionToEdit.items) {
                            const ref = doc(db, 'inventory_items', i.itemId);
                            const d = await t.get(ref);
                            if(d.exists()) t.update(ref, { quantity: transactionToEdit.type === 'Sale' ? d.data().quantity + i.quantity : d.data().quantity - i.quantity });
                        }
                    }
                    if (transactionToEdit.contactId) {
                        const cRef = doc(db, 'contacts', transactionToEdit.contactId);
                        const cDoc = await t.get(cRef);
                        if(cDoc.exists()) {
                            let rev = 0;
                            if (transactionToEdit.type === 'Sale') rev = -transactionToEdit.creditAmount;
                            if (transactionToEdit.type === 'Purchase') rev = transactionToEdit.creditAmount;
                            if (transactionToEdit.type === 'Settlement') {
                                const isCust = contacts.find(c => c.id === transactionToEdit.contactId)?.type === 'Customer';
                                rev = isCust ? -transactionToEdit.amount : transactionToEdit.amount;
                            }
                            t.update(cRef, { balance: (cDoc.data().balance || 0) + rev });
                        }
                    }
                    t.delete(doc(db, 'transactions', transactionToEdit.id));
                }

                const finalAmt = (type === 'Sale' || type === 'Purchase') ? safeMath(totalAmount) : safeMath(Number(amount));
                const paidAmt = (type === 'Sale' || type === 'Purchase') ? safeMath(Number(paid) || 0) : finalAmt;
                const cred = safeMath(finalAmt - paidAmt);
                const contactName = contacts.find(c => c.id === contactId)?.name || null;

                const ref = doc(collection(db, 'transactions'));
                t.set(ref, {
                    userId, type, contactId: contactId || null, contactName, amount: finalAmt, paidAmount: paidAmt, creditAmount: cred,
                    date: new Date(txnDate).toISOString(), description: description || type,
                    items: (type === 'Sale' || type === 'Purchase') ? items.map(i => ({ itemId: i.id, name: i.name, unit: i.unit, quantity: i.qty, price: i.price })) : null
                });

                if (type === 'Sale' || type === 'Purchase') {
                    for (const i of items) {
                        if (i.isNew) {
                            const newRef = doc(collection(db, 'inventory_items'));
                            t.set(newRef, { userId, name: i.name, unit: i.unit, quantity: type==='Sale' ? -i.qty : i.qty, lastPurchasePrice: i.price, createdAt: new Date().toISOString() });
                        } else {
                            const d = await t.get(doc(db, 'inventory_items', i.id));
                            if(d.exists()) t.update(d.ref, { quantity: type === 'Sale' ? d.data().quantity - i.qty : d.data().quantity + i.qty });
                        }
                    }
                }

                if (contactId) {
                    const cRef = doc(db, 'contacts', contactId);
                    const cDoc = await t.get(cRef);
                    let change = 0;
                    if (type === 'Sale') change = cred; 
                    if (type === 'Purchase') change = -cred;
                    if (type === 'Settlement') {
                        const isCust = contacts.find(c => c.id === contactId)?.type === 'Customer';
                        change = isCust ? finalAmt : -finalAmt;
                    }
                    t.update(cRef, { balance: (cDoc.data().balance || 0) + change });
                }
            });
            onClose();
            notify('تم الحفظ بنجاح', 'success');
        } catch (e) { console.error(e); alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <div className="space-y-5">
            {!transactionToEdit && (
                <div className={`flex p-1 rounded-2xl overflow-x-auto ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {['Sale', 'Purchase', 'Settlement', 'Expense', 'Capital'].map(t => (
                        <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 min-w-[60px] text-xs font-bold rounded-xl ${type === t ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                            {t === 'Sale' ? 'بيع' : t === 'Purchase' ? 'شراء' : t === 'Settlement' ? 'سداد' : t === 'Expense' ? 'مصروف' : 'رأس مال'}
                        </button>
                    ))}
                </div>
            )}
            <div className={`p-3 rounded-xl border flex justify-between items-center ${bg}`}>
                <label className="text-sm font-bold text-gray-500">التاريخ:</label>
                <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} className={`p-2 rounded-lg outline-none ${inputBg}`} />
            </div>

            {(type === 'Sale' || type === 'Purchase' || type === 'Settlement') && (
                <div className="space-y-1">
                    <label className="text-xs text-gray-500 pr-2">العميل / المورد</label>
                    <div className="flex gap-2">
                        {!isQuickAddContact ? (
                            <>
                                <select value={contactId} onChange={e => setContactId(e.target.value)} className={`flex-1 p-4 border rounded-xl shadow-sm outline-none ${inputBg}`} disabled={!!preSelectedContactId}>
                                    <option value="">اختر...</option>
                                    {activeContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button onClick={() => setIsQuickAddContact(true)} className="bg-blue-100 text-blue-600 px-4 rounded-xl text-2xl font-bold">+</button>
                            </>
                        ) : (
                            <>
                                <input autoFocus value={newContactName} onChange={e => setNewContactName(e.target.value)} className={`flex-1 p-4 border rounded-xl outline-none ${inputBg}`} placeholder="الاسم الجديد" />
                                <button onClick={handleQuickContact} className="bg-blue-600 text-white px-4 rounded-xl font-bold">حفظ</button>
                                <button onClick={() => setIsQuickAddContact(false)} className="bg-gray-200 text-gray-600 px-3 rounded-xl">X</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {(type === 'Sale' || type === 'Purchase') ? (
                <>
                    <div className={`${bg} p-4 rounded-2xl border space-y-3`}>
                        <p className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>الأصناف</p>
                        
                        <div className="flex gap-2">
                            <input 
                                list="items-list"
                                value={itemName} 
                                onChange={e => { 
                                    const val = e.target.value;
                                    setItemName(val);
                                    const exist = inventoryItems.find(i => i.name === val);
                                    if (exist) {
                                         setPrice(type==='Sale'? exist.lastPurchasePrice*1.2 : exist.lastPurchasePrice);
                                         setUnit(exist.unit || 'قطعة');
                                    }
                                }} 
                                placeholder="اسم الصنف" 
                                className={`flex-[2] p-3 border rounded-xl text-sm ${inputBg}`} 
                            />
                            <datalist id="items-list">{inventoryItems.map(i => <option key={i.id} value={i.name} />)}</datalist>
                            
                            <input 
                                type="text" 
                                value={unit} 
                                onChange={e => setUnit(e.target.value)} 
                                placeholder="وحدة" 
                                className={`flex-1 p-3 border rounded-xl text-sm text-center ${inputBg}`} 
                            />
                        </div>

                        <div className="flex gap-2">
                            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="العدد" className={`flex-1 p-3 border rounded-xl text-center ${inputBg}`} />
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="السعر" className={`flex-[2] p-3 border rounded-xl text-center ${inputBg}`} />
                            <button onClick={addItem} className="flex-1 bg-blue-600 text-white rounded-xl font-bold shadow-md">أضف</button>
                        </div>
                    </div>
                    {items.map((i, idx) => (
                        <div key={idx} className={`flex justify-between p-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                            <span className={darkMode ? 'text-white' : 'text-gray-900'}>{i.name} <span className="text-xs text-gray-500">({i.qty} {i.unit} × {i.price})</span> {i.isNew && <span className="text-xs text-green-500">(جديد)</span>}</span>
                            <div className="flex gap-3">
                                <span className="font-bold text-gray-500">{formatCurrency(i.subtotal)}</span>
                                <button onClick={() => setItems(items.filter((_, x) => x !== idx))} className="text-red-500 font-bold">x</button>
                            </div>
                        </div>
                    ))}
                    <div className={`p-4 rounded-xl border ${bg} space-y-3`}>
                        <div className="flex justify-between font-bold mb-2 text-lg"><span className="text-gray-500">الإجمالي:</span><span className="text-blue-600">{formatCurrency(totalAmount)}</span></div>
                        <div className="flex items-center gap-2"><span className="text-sm text-gray-500">المدفوع:</span><input type="number" value={paid} onChange={e => setPaid(e.target.value)} className="flex-1 p-2 border-b outline-none bg-transparent font-bold text-green-600" placeholder="0" /></div>
                        <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                            <span className="text-gray-500">متبقي (آجل):</span>
                            <span className="font-bold text-red-600">{formatCurrency(safeMath(totalAmount - (Number(paid)||0)))}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className={`${bg} p-4 rounded-xl border`}>
                    <label className="text-xs text-gray-500 block mb-1">المبلغ</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={`w-full p-3 border rounded-xl text-xl font-bold text-center outline-none ${inputBg}`} placeholder="0.00" autoFocus />
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={`w-full p-3 mt-3 border rounded-xl outline-none ${inputBg}`} placeholder="بيان..." />
                </div>
            )}

            <div className="flex gap-3 pt-4 pb-8">
                <div className="flex-[2]"><MobileButton onClick={save} disabled={loading}>{loading ? 'جارٍ الحفظ...' : 'حفظ'}</MobileButton></div>
                <MobileButton onClick={onClose} color="bg-gray-500" outline full={false}>إلغاء</MobileButton>
            </div>
        </div>
    );
};

const Dashboard = ({ summary, onNavigate, darkMode }) => (
    <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between px-2 items-center">
            <h2 className={`font-bold text-xl ${darkMode ? 'text-white' : 'text-gray-800'}`}>لوحة التحكم</h2>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold border border-blue-100">أ/ خالد إسماعيل</span>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10">
                <p className="text-blue-100 mb-1 text-sm">السيولة النقدية</p>
                <h2 className="text-5xl font-bold">{formatCurrency(summary.cash)}</h2>
            </div>
        </div>
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-50'} p-4 rounded-2xl border flex justify-between items-center`}>
            <div><p className="text-xs text-gray-400 mb-1">رأس المال المستثمر</p><p className="text-xl font-bold text-blue-500">{formatCurrency(summary.investedCapital)}</p></div>
            <div className="text-2xl">💰</div>
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

const App = () => {
    const [user, setUser] = useState(null);
    const [screen, setScreen] = useState('Dashboard');
    const [selectedContact, setSelectedContact] = useState(null);
    const [transactionToEdit, setTransactionToEdit] = useState(null);
    const [data, setData] = useState({ contacts: [], transactions: [], inventory: [] });
    const [darkMode, setDarkMode] = useState(false);
    const [notification, setNotification] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => { localStorage.setItem('darkMode', darkMode); }, [darkMode]);
    useEffect(() => {
        const h = () => setIsOffline(!navigator.onLine);
        window.addEventListener('online', h); window.addEventListener('offline', h);
        return () => { window.removeEventListener('online', h); window.removeEventListener('offline', h); };
    }, []);
    
    const notify = (message, type = 'success') => setNotification({ message, type });

    useEffect(() => {
        if (!auth) return;
        return onAuthStateChanged(auth, u => { setUser(u); });
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = (col) => query(collection(db, col), where('userId', '==', user.uid));
        const un1 = onSnapshot(q('contacts'), s => setData(d => ({ ...d, contacts: mapSnapshotToData(s) })));
        const un2 = onSnapshot(q('transactions'), s => setData(d => ({ ...d, transactions: mapSnapshotToData(s) })));
        const un3 = onSnapshot(q('inventory_items'), s => setData(d => ({ ...d, inventory: mapSnapshotToData(s) })));
        return () => { un1(); un2(); un3(); };
    }, [user]);

    const summary = useMemo(() => {
        let owedToMe = 0, iOwe = 0, cash = 0, tSales = 0, tPurchases = 0, tExpenses = 0, investedCapital = 0;
        data.contacts.forEach(c => { if (c.balance > 0) owedToMe += c.balance; if (c.balance < 0) iOwe += Math.abs(c.balance); });
        data.transactions.forEach(t => {
            const amt = safeMath(t.amount); const paid = safeMath(t.paidAmount);
            if (t.type === 'Sale') { cash += paid; tSales += amt; }
            if (t.type === 'Purchase') { cash -= paid; tPurchases += amt; }
            if (t.type === 'Expense') { cash -= amt; tExpenses += amt; }
            if (t.type === 'Capital') { cash += amt; investedCapital += amt; }
            if (t.type === 'Settlement') {
                const contact = data.contacts.find(x => x.id === t.contactId);
                if (contact) { if (contact.type === 'Customer') cash += amt; else cash -= amt; }
            }
        });
        return { owedToMe, iOwe, cash, tSales, tPurchases, tExpenses, investedCapital };
    }, [data]);

    const handleDelete = async (t) => {
        if (!window.confirm('حذف نهائي؟')) return;
        try {
            await runTransaction(db, async (tr) => {
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