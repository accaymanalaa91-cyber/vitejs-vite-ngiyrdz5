import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, doc, runTransaction, where, deleteDoc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

// ------------------------------------------------------------------
// إعدادات Firebase الخاصة بك (تمت إضافتها بنجاح ✅)
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDMF65H0Sa5B_CC1h-pRGxhVHEjPaHmRRc",
  authDomain: "financial-manager-2d1c3.firebaseapp.com",
  projectId: "financial-manager-2d1c3",
  storageBucket: "financial-manager-2d1c3.firebasestorage.app",
  messagingSenderId: "730372364290",
  appId: "1:730372364290:web:014e9fd1566f178d926f1b"
  // measurementId تم تجاهله لأنه غير مستخدم في الكود الحالي
};

// تهيئة التطبيق
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("فشل تهيئة Firebase:", error);
}

// ------------------------------------------------------------------
// بداية كود التطبيق
// ------------------------------------------------------------------

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
    return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 2
    }).format(amount || 0);
};

// --- Custom Components ---

const NotificationToast = ({ notification, onClose }) => {
    if (!notification) return null;
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [notification, onClose]);
    return (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-md p-4 rounded-xl shadow-2xl flex items-center justify-between transition-all ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white`} dir="rtl">
            <span className="font-bold text-sm">{notification.message}</span>
            <button onClick={onClose} className="text-white font-bold px-2">&times;</button>
        </div>
    );
};

const MobileButton = ({ children, onClick, color = 'bg-indigo-600', type = 'button', disabled = false, small = false }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={`w-full text-white font-bold py-2 px-4 rounded-xl shadow-md ${color} disabled:opacity-50 ${small ? 'text-sm py-1' : ''}`}>
        {children}
    </button>
);

const SummaryCard = ({ title, value, color = 'text-gray-900', bgColor = 'bg-white', darkMode }) => (
    <div className={`p-4 rounded-xl shadow-lg border-b-4 border-indigo-500 ${darkMode ? 'bg-gray-800 text-white' : bgColor}`}>
        <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
        <p className={`mt-1 text-2xl font-bold ${darkMode ? 'text-indigo-300' : color}`}>{formatCurrency(value)}</p>
    </div>
);

const SearchBar = ({ value, onChange, placeholder, darkMode }) => (
    <div className="relative w-full mb-4">
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full p-2 pr-10 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className={`w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
    </div>
);

const InstallGuide = ({ show, onClose, darkMode }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" dir="rtl">
            <div className={`p-6 rounded-xl shadow-2xl max-w-sm w-full ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                <h3 className="text-lg font-bold mb-4 text-indigo-500">كيفية التثبيت على أندرويد</h3>
                <ol className="list-decimal list-inside space-y-3 text-sm mb-6">
                    <li>اضغط على زر القائمة في متصفح كروم (الثلاث نقاط ⋮ في الأعلى).</li>
                    <li>اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> أو <strong>"Install App"</strong>.</li>
                    <li>اضغط "إضافة" للتأكيد.</li>
                    <li>سيظهر أيقونة التطبيق على شاشة هاتفك وتعمل كتطبيق منفصل!</li>
                </ol>
                <MobileButton onClick={onClose}>حسناً، فهمت</MobileButton>
            </div>
        </div>
    );
};

const MobileContainer = ({ children, darkMode }) => (
    <div className={`min-h-screen flex flex-col items-center p-0 font-sans text-right transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`} dir="rtl">
        <div className="w-full max-w-[480px] min-h-screen flex flex-col shadow-2xl bg-inherit relative">
            {children}
        </div>
    </div>
);

// --- Login Screen ---
const LoginScreen = ({ setUserId }) => {
    const [loading, setLoading] = useState(false);
    const handleGoogleSignIn = async () => {
        if (!auth) return;
        setLoading(true);
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-indigo-900 to-gray-900 text-white p-4 text-center" dir="rtl">
             <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl mb-6 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-4xl font-extrabold mb-2">مديرك المالي</h2>
            <p className="text-indigo-300 mb-8 text-lg">نظامك المحاسبي الذكي</p>
            <div className="w-full max-w-xs"><MobileButton onClick={handleGoogleSignIn} color="bg-white"><span className="text-gray-900 font-bold">{loading ? '...' : 'دخول بجوجل'}</span></MobileButton></div>
        </div>
    );
};

// --- Transactions ---
const AddTransactionForm = ({ contacts, inventoryItems, notify, darkMode, userId }) => {
    const [type, setType] = useState('Purchase'); 
    const [category, setCategory] = useState('عام'); 
    const [amount, setAmount] = useState('');
    const [paidAmount, setPaidAmount] = useState('');
    const [contactId, setContactId] = useState('');
    const [description, setDescription] = useState('');
    const [purchaseItems, setPurchaseItems] = useState([]); 
    const [saleItems, setSaleItems] = useState([]); 
    const [loading, setLoading] = useState(false);

    const expenseCategories = ['إيجار', 'كهرباء/مياه', 'رواتب', 'نقل/شحن', 'صيانة', 'بضاعة تالفة', 'سحوبات شخصية', 'أخرى'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        const totalItemsAmount = (type === 'Purchase' ? purchaseItems : saleItems).reduce((sum, i) => sum + i.subtotal, 0);
        const finalAmount = type === 'Expense' ? (parseFloat(amount) || 0) : totalItemsAmount;
        const paid = type === 'Expense' ? finalAmount : (parseFloat(paidAmount) || 0);
        
        if (type !== 'Expense' && totalItemsAmount <= 0) { notify('يجب إضافة بنود.', 'error'); return; }
        if (paid > finalAmount) { notify('المدفوع أكبر من الإجمالي!', 'error'); return; }

        setLoading(true);
        const itemsToSave = type === 'Purchase' ? purchaseItems : saleItems;
        const credit = finalAmount - paid;

        try {
            await runTransaction(db, async (transaction) => {
                const itemsList = [];
                if (type !== 'Expense') {
                    for (const item of itemsToSave) {
                        let itemRef;
                        if (item.isNew) {
                            const newRef = doc(collection(db, 'inventory_items'));
                            transaction.set(newRef, { name: item.name, unit: item.unit, quantity: item.quantity, lastPurchasePrice: item.price, totalPurchased: item.quantity, totalSold: 0, userId });
                            item.itemId = newRef.id;
                        } else {
                            itemRef = doc(db, 'inventory_items', item.itemId);
                            const iDoc = await transaction.get(itemRef);
                            if (!iDoc.exists()) throw "Item not found";
                            const d = iDoc.data();
                            transaction.update(itemRef, {
                                quantity: type === 'Purchase' ? d.quantity + item.quantity : d.quantity - item.quantity,
                                ...(type === 'Purchase' ? { lastPurchasePrice: item.price, totalPurchased: (d.totalPurchased || 0) + item.quantity } : { totalSold: (d.totalSold || 0) + item.quantity })
                            });
                        }
                        itemsList.push({ ...item, isNew: false });
                    }
                }

                const transactionRef = doc(collection(db, 'transactions'));
                const contactName = contactId ? contacts.find(c => c.id === contactId)?.name : null;
                
                transaction.set(transactionRef, {
                    userId, type, amount: finalAmount, paidAmount: paid, creditAmount: credit,
                    contactId: contactId || null, contactName,
                    date: new Date().toISOString(), 
                    description: type === 'Expense' ? `${category} - ${description}` : description || type, 
                    category: type === 'Expense' ? category : null,
                    items: itemsList.length ? itemsList : null
                });

                if (contactId && credit !== 0) {
                    const cRef = doc(db, 'contacts', contactId);
                    const cDoc = await transaction.get(cRef);
                    const bal = cDoc.data().balance || 0;
                    transaction.update(cRef, { balance: bal + (type === 'Purchase' ? -credit : credit) });
                }
            });
            notify('تم الحفظ بنجاح', 'success');
            setAmount(''); setPaidAmount(''); setContactId(''); setDescription(''); setPurchaseItems([]); setSaleItems([]);
        } catch (err) { console.error(err); notify('حدث خطأ أثناء الحفظ', 'error'); } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 p-4 border rounded-xl shadow-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className='flex space-x-2 rtl:space-x-reverse'>
                {['Sale', 'Purchase', 'Expense'].map(t => (
                    <button key={t} type="button" onClick={() => { setType(t); setPaidAmount(''); setContactId(''); }} 
                        className={`flex-1 py-2 rounded-lg font-semibold transition ${type === t ? 'bg-indigo-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700 border'}`}>
                        {t === 'Sale' ? 'بيع' : t === 'Purchase' ? 'شراء' : 'مصروف'}
                    </button>
                ))}
            </div>

            {type === 'Expense' ? (
                <>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 rounded-lg border">
                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="قيمة المصروف" className="w-full p-2 rounded-lg border text-lg text-right"/>
                </>
            ) : (
                <>
                    <select value={contactId} onChange={(e) => setContactId(e.target.value)} required className="w-full p-2 rounded-lg border">
                        <option value="">اختر {type === 'Sale' ? 'العميل' : 'المورد'}</option>
                        {contacts.filter(c => (type === 'Sale' ? c.type === 'Customer' : c.type === 'Supplier')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <LineItemInput inventoryItems={inventoryItems} items={type === 'Purchase' ? purchaseItems : saleItems} setItems={type === 'Purchase' ? setPurchaseItems : setSaleItems} totalAmount={(type === 'Purchase' ? purchaseItems : saleItems).reduce((s,i)=>s+i.subtotal,0)} transactionType={type} notify={notify} darkMode={darkMode} />
                    <div className={`p-3 rounded-lg border space-y-2 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white'}`}>
                        <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} required placeholder="المدفوع كاش" className="w-full p-2 rounded-lg border text-lg text-right"/>
                    </div>
                </>
            )}

            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ملاحظات إضافية" className="w-full p-2 rounded-lg border"/>
            <MobileButton type="submit" disabled={loading}>{loading ? 'جارٍ الحفظ...' : 'تسجيل العملية'}</MobileButton>
        </form>
    );
};

const LineItemInput = ({ inventoryItems, items, setItems, totalAmount, transactionType, notify, darkMode }) => {
    const [selectedItemId, setSelectedItemId] = useState('');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('قطعة');
    const [isNew, setIsNew] = useState(false);

    const isSale = transactionType === 'Sale';

    const addItem = () => {
        if (!qty || !price || (isNew && !newItemName) || (!isNew && !selectedItemId)) return notify('بيانات ناقصة', 'error');
        
        const itemData = isNew ? { name: newItemName, unit: newItemUnit, quantity: Infinity, lastPurchasePrice: 0 } : inventoryItems.find(i => i.id === selectedItemId);
        const q = parseFloat(qty);
        const p = parseFloat(price);

        if (isSale && !isNew && itemData.quantity < q) return notify(`الكمية المتاحة ${itemData.quantity} فقط`, 'error');

        setItems([...items, { 
            itemId: isNew ? `NEW_${Date.now()}` : selectedItemId, 
            name: itemData.name, unit: itemData.unit, quantity: q, price: p, subtotal: q * p, isNew: isNew && transactionType === 'Purchase' 
        }]);
        setQty(''); setPrice(''); setSelectedItemId(''); setNewItemName(''); setIsNew(false);
    };

    return (
        <div className={`p-3 rounded-lg border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            {!isNew ? (
                <div className="flex gap-2 mb-2">
                    <select value={selectedItemId} onChange={(e) => {
                        setSelectedItemId(e.target.value);
                        if (isSale) {
                            const i = inventoryItems.find(x => x.id === e.target.value);
                            if (i) setPrice((i.lastPurchasePrice * 1.2).toFixed(2));
                        }
                    }} className="flex-grow p-2 rounded border text-sm">
                        <option value="">اختر صنف</option>
                        {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>)}
                    </select>
                    {transactionType === 'Purchase' && <button type="button" onClick={() => setIsNew(true)} className="bg-green-600 text-white px-3 rounded text-lg">+</button>}
                </div>
            ) : (
                <div className="flex gap-2 mb-2">
                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="اسم الصنف" className="w-2/3 p-2 rounded border text-sm"/>
                    <input value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)} placeholder="وحدة" className="w-1/3 p-2 rounded border text-sm"/>
                    <button type="button" onClick={() => setIsNew(false)} className="bg-red-500 text-white px-3 rounded">x</button>
                </div>
            )}
            <div className="flex gap-2 mb-2">
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="الكمية" className="w-1/2 p-2 rounded border text-sm"/>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="السعر" className="w-1/2 p-2 rounded border text-sm"/>
                <button type="button" onClick={addItem} className="bg-indigo-600 text-white px-4 rounded font-bold">أضف</button>
            </div>
            {items.length > 0 && (
                <div className="bg-white/10 rounded p-2 max-h-32 overflow-y-auto">
                    {items.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b border-gray-500/30 py-1">
                            <span>{i.name} ({i.quantity}×{i.price})</span>
                            <div className="flex gap-2 items-center">
                                <span className="font-bold">{i.subtotal}</span>
                                <button onClick={() => setItems(items.filter((_, x) => x !== idx))} className="text-red-500 font-bold">x</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-2 pt-2 border-t border-gray-500/30 flex justify-between font-bold">
                <span>الإجمالي:</span>
                <span>{formatCurrency(totalAmount)}</span>
            </div>
        </div>
    );
};

const TransactionHistory = ({ transactions, contacts, notify, darkMode }) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const handleDelete = async (t) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه العملية؟ سيتم عكس تأثيرها على المخزون والعملاء.')) return;
        try {
            await runTransaction(db, async (transaction) => {
                // Reverse Inventory
                if (t.items) {
                    for (const item of t.items) {
                        const itemRef = doc(db, 'inventory_items', item.itemId);
                        const iDoc = await transaction.get(itemRef);
                        if (iDoc.exists()) {
                            const d = iDoc.data();
                            transaction.update(itemRef, {
                                quantity: t.type === 'Purchase' ? d.quantity - item.quantity : d.quantity + item.quantity,
                                ...(t.type === 'Purchase' ? { totalPurchased: d.totalPurchased - item.quantity } : { totalSold: d.totalSold - item.quantity })
                            });
                        }
                    }
                }
                // Reverse Contact Balance
                if (t.contactId && t.creditAmount) {
                    const cRef = doc(db, 'contacts', t.contactId);
                    const cDoc = await transaction.get(cRef);
                    if (cDoc.exists()) {
                        const bal = cDoc.data().balance;
                        const change = t.type === 'Purchase' ? t.creditAmount : -t.creditAmount;
                        transaction.update(cRef, { balance: bal + change });
                    }
                }
                transaction.delete(doc(db, 'transactions', t.id));
            });
            notify('تم الحذف وعكس العملية بنجاح', 'success');
        } catch (e) { console.error(e); notify('فشل الحذف', 'error'); }
    };

    const filtered = transactions.filter(t => {
        const matchesSearch = (t.contactName || '').includes(search) || (t.description || '').includes(search) || t.amount.toString().includes(search);
        const tDate = new Date(t.date);
        const now = new Date();
        if (filter === 'today') return matchesSearch && tDate.setHours(0,0,0,0) === now.setHours(0,0,0,0);
        if (filter === 'month') return matchesSearch && tDate.getMonth() === now.getMonth();
        return matchesSearch;
    });

    return (
        <div className="space-y-4">
            <SearchBar value={search} onChange={setSearch} placeholder="ابحث في العمليات..." darkMode={darkMode} />
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                {[{id:'all',l:'الكل'},{id:'today',l:'اليوم'},{id:'month',l:'هذا الشهر'}].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)} className={`px-4 py-1 rounded-full text-xs font-bold ${filter === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{f.l}</button>
                ))}
            </div>
            <ul className="space-y-3">
                {filtered.map(t => (
                    <li key={t.id} className={`p-3 rounded-xl border relative group ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                        <button onClick={() => handleDelete(t)} className="absolute top-2 left-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                        <div className="flex justify-between mb-1">
                            <span className={`font-bold text-sm ${t.type==='Sale'?'text-green-500':t.type==='Purchase'?'text-yellow-500':'text-red-500'}`}>
                                {t.type === 'Sale' ? 'بيع' : t.type === 'Purchase' ? 'شراء' : t.description}
                            </span>
                            <span className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <p className="font-bold">{formatCurrency(t.amount)}</p>
                        {t.contactName && <p className="text-xs text-gray-500">الطرف: {t.contactName}</p>}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const ContactsScreen = ({ contacts, userId, notify, darkMode }) => {
    const [name, setName] = useState('');
    const [search, setSearch] = useState('');
    const [type, setType] = useState('Customer');
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!name) return;
        try {
            await addDoc(collection(db, 'contacts'), { userId, name, type, balance: 0, createdAt: new Date().toISOString() });
            notify('تمت الإضافة', 'success'); setIsAdding(false); setName('');
        } catch (e) { notify('خطأ', 'error'); }
    };

    const filteredContacts = contacts.filter(c => c.name.includes(search));

    return (
        <div className="space-y-4">
            <SearchBar value={search} onChange={setSearch} placeholder="ابحث عن عميل/مورد..." darkMode={darkMode} />
            <MobileButton onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'إلغاء' : 'إضافة عميل/مورد'}</MobileButton>
            {isAdding && (
                <form onSubmit={handleAdd} className={`p-4 rounded-xl border space-y-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setType('Customer')} className={`flex-1 py-1 rounded ${type === 'Customer' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-300'}`}>عميل</button>
                        <button type="button" onClick={() => setType('Supplier')} className={`flex-1 py-1 rounded ${type === 'Supplier' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-300'}`}>مورد</button>
                    </div>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="w-full p-2 rounded border"/>
                    <MobileButton type="submit">حفظ</MobileButton>
                </form>
            )}
            <div className="space-y-2">
                {filteredContacts.map(c => (
                    <div key={c.id} className={`p-3 rounded-lg border flex justify-between items-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                        <div>
                            <p className="font-bold">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.type === 'Customer' ? 'عميل' : 'مورد'}</p>
                        </div>
                        <div className={`text-left font-bold ${c.balance > 0 ? 'text-red-500' : c.balance < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                            {formatCurrency(Math.abs(c.balance))}
                            <p className="text-[10px] font-normal">{c.balance > 0 ? (c.type==='Customer'?'(لي)':'(علي)') : c.balance < 0 ? (c.type==='Customer'?'(علي)':'(لي)') : '-'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const InventoryManagement = ({ inventoryItems, transactions, darkMode }) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const itemsWithStats = useMemo(() => {
        return inventoryItems.map(item => {
            const itemSales = transactions.filter(t => t.type === 'Sale' && t.items).flatMap(t => t.items).filter(i => i.itemId === item.id);
            const revenue = itemSales.reduce((sum, i) => sum + i.subtotal, 0);
            const qtySold = itemSales.reduce((sum, i) => sum + i.quantity, 0);
            const profit = revenue - (qtySold * (item.lastPurchasePrice || 0));
            return { ...item, qtySold, profit };
        });
    }, [inventoryItems, transactions]);

    const displayed = itemsWithStats.filter(i => i.name.includes(search) && (filter === 'low' ? i.quantity <= 5 : filter === 'top' ? true : true));
    if (filter === 'top') displayed.sort((a, b) => b.qtySold - a.qtySold);

    return (
        <div className="space-y-4">
            <SearchBar value={search} onChange={setSearch} placeholder="ابحث عن صنف..." darkMode={darkMode} />
            <div className="flex gap-2 pb-2">
                {[{id:'all',l:'الكل'},{id:'low',l:'⚠️ نواقص'},{id:'top',l:'🔥 الأكثر مبيعاً'}].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)} className={`flex-1 py-1 rounded-md text-xs font-bold ${filter === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{f.l}</button>
                ))}
            </div>
            <div className="space-y-3">
                {displayed.map(item => (
                    <div key={item.id} className={`p-3 rounded-xl border relative overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                        <div className="absolute bottom-0 left-0 h-1 bg-gray-200 w-full"><div className={`h-full ${item.quantity <= 5 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(item.quantity * 10, 100)}%` }} /></div>
                        <div className="flex justify-between">
                            <div>
                                <p className="font-bold">{item.name}</p>
                                <p className={`text-xs font-bold ${item.quantity <= 5 ? 'text-red-500' : 'text-indigo-500'}`}>{item.quantity} {item.unit}</p>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500">ربح تقديري</p>
                                <p className="font-bold text-green-600 text-sm">{formatCurrency(item.profit)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingsScreen = ({ handleLogout, userEmail, darkMode, toggleDarkMode, showInstall }) => (
    <div className="space-y-6 p-4">
        <div className={`p-4 rounded-xl shadow-md space-y-3 border-l-4 border-green-500 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="text-xl font-bold text-green-600 border-b border-gray-600 pb-2">تثبيت التطبيق</h3>
            <p className="text-sm text-gray-500">قم بتثبيت "مديرك المالي" على هاتفك ليعمل كتطبيق منفصل.</p>
            <MobileButton onClick={showInstall} color="bg-green-600">📱 تثبيت على الهاتف</MobileButton>
        </div>
        <div className={`p-4 rounded-xl shadow-md space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="text-xl font-bold text-indigo-500 border-b border-gray-600 pb-2">المظهر</h3>
            <div className="flex justify-between items-center">
                <span>الوضع المظلم (Dark Mode)</span>
                <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${darkMode ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'}`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                </button>
            </div>
        </div>
        <div className={`p-4 rounded-xl shadow-md space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="text-xl font-bold text-indigo-500 border-b border-gray-600 pb-2">الحساب</h3>
            <p className="text-sm opacity-70">المستخدم: {userEmail}</p>
            <MobileButton onClick={handleLogout} color="bg-red-600">خروج</MobileButton>
        </div>
    </div>
);

const Dashboard = ({ transactions, contacts, darkMode }) => {
    const stats = useMemo(() => {
        let p = 0, s = 0, e = 0, c = 0;
        transactions.forEach(t => {
            if (t.type === 'Purchase') p += t.amount;
            if (t.type === 'Sale') s += t.amount;
            if (t.type === 'Expense') e += t.amount;
            if (t.type === 'Capital') c += t.amount;
            if (t.type === 'Settlement') {
                const contact = contacts.find(x => x.id === t.contactId);
                if (contact) c += (contact.type === 'Customer' ? t.amount : -t.amount);
            }
        });
        return { p, s, e, c: c + (s - p - e) };
    }, [transactions, contacts]);

    const debts = useMemo(() => {
        let owe = 0, owed = 0;
        contacts.forEach(c => { if (c.balance > 0) owed += c.balance; if (c.balance < 0) owe += Math.abs(c.balance); });
        return { owe, owed };
    }, [contacts]);

    return (
        <div className="space-y-4">
            <SummaryCard title="النقدية (الكاش)" value={stats.c} color={stats.c >= 0 ? 'text-green-600' : 'text-red-600'} darkMode={darkMode} />
            <div className="grid grid-cols-2 gap-4">
                <SummaryCard title="لي (عند العملاء)" value={debts.owed} color="text-green-600" darkMode={darkMode} />
                <SummaryCard title="علي (للموردين)" value={debts.owe} color="text-red-600" darkMode={darkMode} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <SummaryCard title="مبيعات" value={stats.s} color="text-indigo-600" darkMode={darkMode} />
                <SummaryCard title="مصروفات" value={stats.e} color="text-red-600" darkMode={darkMode} />
            </div>
        </div>
    );
};

const App = () => {
    const [userId, setUserId] = useState(null);
    const [screen, setScreen] = useState('Dashboard'); 
    const [transactions, setTransactions] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]); 
    const [userEmail, setUserEmail] = useState(null);
    const [notification, setNotification] = useState(null);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => { localStorage.setItem('darkMode', darkMode); }, [darkMode]);
    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    const notify = (message, type = 'success') => setNotification({ message, type });

    useEffect(() => {
        if (!auth) return;
        return onAuthStateChanged(auth, u => { setUserId(u ? u.uid : null); setUserEmail(u ? u.email : null); });
    }, []);

    useEffect(() => {
        if (!db || !userId) return;
        const q = (col) => query(collection(db, col), where('userId', '==', userId));
        const un1 = onSnapshot(q('transactions'), s => setTransactions(mapSnapshotToData(s)));
        const un2 = onSnapshot(q('contacts'), s => setContacts(mapSnapshotToData(s)));
        const un3 = onSnapshot(q('inventory_items'), s => setInventoryItems(mapSnapshotToData(s)));
        return () => { un1(); un2(); un3(); };
    }, [userId]);

    if (!userId) return <LoginScreen setUserId={setUserId} />;

    const props = { contacts, inventoryItems, transactions, userId, notify, darkMode };
    const renderScreen = () => {
        switch (screen) {
            case 'Transactions': return <AddTransactionForm {...props} />;
            case 'History': return <TransactionHistory {...props} />;
            case 'Contacts': return <ContactsScreen {...props} />;
            case 'Inventory': return <InventoryManagement {...props} />;
            case 'Settings': return <SettingsScreen handleLogout={() => signOut(auth)} userEmail={userEmail} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} showInstall={() => setShowInstallGuide(true)} />;
            default: return <Dashboard {...props} />;
        }
    };

    return (
        <MobileContainer darkMode={darkMode}>
            <NotificationToast notification={notification} onClose={() => setNotification(null)} />
            <InstallGuide show={showInstallGuide} onClose={() => setShowInstallGuide(false)} darkMode={darkMode} />
            
            <header className={`p-4 shadow-lg flex flex-col items-center sticky top-0 z-10 transition-colors ${darkMode ? 'bg-gray-800 text-white' : 'bg-indigo-700 text-white'}`}>
                <div className="w-full flex justify-between items-center">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    <h1 className="text-xl font-extrabold">مديرك المالي</h1>
                    <div className="w-2"></div>
                </div>
                <p className="text-xs opacity-80">{screen === 'Settings' ? 'الإعدادات' : screen === 'Inventory' ? 'المخزون والأرباح' : 'الرئيسية'}</p>
                {!isOnline && <p className="text-[10px] bg-red-500 text-white px-2 rounded mt-1">وضع العمل بدون إنترنت</p>}
            </header>
            <div className="mobile-body p-4 w-full max-w-md">{renderScreen()}</div>
            <nav className={`absolute bottom-0 w-full max-w-[480px] border-t shadow-2xl z-10 flex justify-around items-center h-16 transition-colors ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                {[{n:'الرئيسية',i:'home',s:'Dashboard'}, {n:'حركة',i:'plus',s:'Transactions'}, {n:'سجل',i:'clock',s:'History'}, {n:'المخزون',i:'box',s:'Inventory'}, {n:'إعدادات',i:'cog',s:'Settings'}].map(x => (
                    <button key={x.s} onClick={() => setScreen(x.s)} className={`flex flex-col items-center p-2 text-sm ${screen === x.s ? 'text-indigo-500 font-bold' : 'text-gray-500'}`}>
                         {x.i === 'home' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l-7-7m7 7v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                         {x.i === 'plus' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                         {x.i === 'clock' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                         {x.i === 'box' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                         {x.i === 'cog' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35-.29.474-.483 1.05-.483 1.649 0 2.21 1.79 4 4 4s4-1.79 4-4c0-.598-.193-1.174-.484-1.648a3.36 3.36 0 00-.918-1.503 3.36 3.36 0 00-1.503-.918c-.474-.29-.667-.667-.923-1.077a2.954 2.954 0 00-1.385-1.385c-.41-.256-.787-.449-1.077-.923a1.724 1.724 0 00-2.572-1.065 3.36 3.36 0 00-1.503-.918 3.36 3.36 0 00-.918-1.503c-.29-.474-.483-1.05-.483-1.649 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 .598.193 1.174.484 1.648a3.36 3.36 0 00.918 1.503 3.36 3.36 0 001.503.918c.474.29.667.667.923 1.077a2.954 2.954 0 001.385 1.385c.41.256.787.449 1.077.923a1.724 1.724 0 002.572 1.065 3.36 3.36 0 001.503.918 3.36 3.36 0 00.918 1.503c.29.474.483 1.05.483 1.649 0 2.21 1.79 4 4 4s4-1.79 4-4z" /></svg>}
                         <span className="text-[10px]">{x.n}</span>
                    </button>
                ))}
            </nav>
        </MobileContainer>
    );
};

export default App;