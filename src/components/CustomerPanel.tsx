import React, { useState, useEffect, useRef } from 'react';
import { Customer, OnsiteService, OncallService, Claim } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  User, Edit2, Trash2, ShieldAlert, History, MapPin, Phone, Mail, 
  Building, Search, Plus, X, Laptop, MessageSquare, Clipboard, ArrowUpRight, Clock,
  Upload, Download
} from 'lucide-react';
import { isClaimOverdue } from '../utils/date';
import { parseCSV, generateCSV, downloadFile } from '../utils/csvHelper';

export const CustomerPanel: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [onsiteJobs, setOnsiteJobs] = useState<OnsiteService[]>([]);
  const [oncallJobs, setOncallJobs] = useState<OncallService[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Custom CSV states
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customerHeaders = [
    'Company Name', 'Company Address', 'Contact Name', 'Contact Details', 
    'Contact Phone', 'Contact Email', 'Partner Company'
  ];
  
  const customerKeys = [
    'companyName', 'companyAddress', 'contactName', 'contactDetails', 
    'contactPhone', 'contactEmail', 'partnerCompany'
  ];

  const handleExportCSV = () => {
    const csvContent = generateCSV(customerHeaders, filteredCustomers, customerKeys);
    downloadFile(`customers_report_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) return;

        const rows = parseCSV(text);
        if (rows.length < 2) {
          alert("ไฟล์ CSV ไม่มีข้อมูลเพียงพอ");
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const importedCustomers: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

          const customer: any = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          headers.forEach((header, index) => {
            const val = row[index] || '';
            if (header === 'company name' || header === 'companyname') customer.companyName = val;
            else if (header === 'company address' || header === 'companyaddress') customer.companyAddress = val;
            else if (header === 'contact name' || header === 'contactname') customer.contactName = val;
            else if (header === 'contact details' || header === 'contactdetails') customer.contactDetails = val;
            else if (header === 'contact phone' || header === 'contactphone') customer.contactPhone = val;
            else if (header === 'contact email' || header === 'contactemail') customer.contactEmail = val;
            else if (header === 'partner company' || header === 'partnercompany') customer.partnerCompany = val;
          });

          if (!customer.companyName) continue;
          importedCustomers.push(customer);
        }

        if (importedCustomers.length === 0) {
          alert("ไม่พบข้อมูลลูกค้าที่ถูกต้องในไฟล์ CSV");
          return;
        }

        if (!confirm(`คุณต้องการนำเข้าข้อมูลฐานข้อมูลลูกค้าจำนวน ${importedCustomers.length} รายการใช่หรือไม่?`)) {
          return;
        }

        const path = 'customers';
        for (const customer of importedCustomers) {
          const snapshot = await getDocs(collection(db, path));
          let exists = false;
          let existingDocId = '';
          
          snapshot.forEach((docSnap) => {
            if (docSnap.data().companyName.toLowerCase().trim() === customer.companyName.toLowerCase().trim()) {
              exists = true;
              existingDocId = docSnap.id;
            }
          });

          if (exists) {
            // Overwrite existing or update details
            await updateDoc(doc(db, path, existingDocId), {
              ...customer,
              updatedAt: new Date().toISOString()
            });
          } else {
            await addDoc(collection(db, path), customer);
          }
        }

        alert("นำเข้าข้อมูลเสร็จสมบูรณ์!");
        fetchData();
      } catch (err) {
        console.error("Error importing CSV:", err);
        alert("เกิดข้อผิดพลาดในการนำเข้าไฟล์ CSV: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Modal & Edit states
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  // History Detail view state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [partnerCompany, setPartnerCompany] = useState('');

  // Fetch Core Lists
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch customers
      const customersSnap = await getDocs(query(collection(db, 'customers'), orderBy('companyName')));
      const fetchedCust: Customer[] = [];
      customersSnap.forEach((docSnap) => {
        fetchedCust.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });
      setCustomers(fetchedCust);

      // Fetch onsite records for history
      const onsiteSnap = await getDocs(collection(db, 'onsite_services'));
      const fetchedOnsite: OnsiteService[] = [];
      onsiteSnap.forEach((docSnap) => {
        fetchedOnsite.push({ id: docSnap.id, ...docSnap.data() } as OnsiteService);
      });
      setOnsiteJobs(fetchedOnsite);

      // Fetch oncall records
      const oncallSnap = await getDocs(collection(db, 'oncall_services'));
      const fetchedOncall: OncallService[] = [];
      oncallSnap.forEach((docSnap) => {
        fetchedOncall.push({ id: docSnap.id, ...docSnap.data() } as OncallService);
      });
      setOncallJobs(fetchedOncall);

      // Fetch claims records
      const claimsSnap = await getDocs(collection(db, 'claims'));
      const fetchedClaims: Claim[] = [];
      claimsSnap.forEach((docSnap) => {
        fetchedClaims.push({ id: docSnap.id, ...docSnap.data() } as Claim);
      });
      setClaims(fetchedClaims);

    } catch (err) {
      console.error("Error reading Customer details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setActiveCustomer(null);
    setCompanyName('');
    setCompanyAddress('');
    setContactName('');
    setContactDetails('');
    setContactPhone('');
    setContactEmail('');
    setPartnerCompany('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setIsEditing(true);
    setActiveCustomer(cust);
    setCompanyName(cust.companyName);
    setCompanyAddress(cust.companyAddress || '');
    setContactName(cust.contactName || '');
    setContactDetails(cust.contactDetails || '');
    setContactPhone(cust.contactPhone);
    setContactEmail(cust.contactEmail || '');
    setPartnerCompany(cust.partnerCompany || '');
    setShowFormModal(true);
  };

  const handleOpenHistory = (cust: Customer) => {
    setHistoryCustomer(cust);
    setShowHistoryModal(true);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("คุณต้องการลบข้อมูลรายชื่อลูกค้าท่านนี้ออกจากฐานข้อมูลหลักใช่หรือไม่?")) return;

    try {
      await deleteDoc(doc(db, 'customers', id));
      setCustomers(customers.filter(c => c.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'customers');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCompany = companyName.trim();
    if (!trimmedCompany || !contactPhone.trim()) {
      alert("กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน");
      return;
    }

    const payload = {
      companyName: trimmedCompany,
      companyAddress: companyAddress.trim(),
      contactName: contactName.trim(),
      contactDetails: contactDetails.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      partnerCompany: partnerCompany.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (isEditing && activeCustomer?.id) {
        await updateDoc(doc(db, 'customers', activeCustomer.id), payload);
        setCustomers(customers.map(c => c.id === activeCustomer.id ? { ...c, ...payload } : c));
      } else {
        // Prevent company duplicate name checks on insert
        const duplicate = customers.some(c => c.companyName.toLowerCase().trim() === trimmedCompany.toLowerCase());
        if (duplicate) {
          alert("มีรายชื่อบริษัทนี้อยู่ในระบบฐานข้อมูลลูกค้าเรียบร้อยแล้ว");
          return;
        }
        const docRef = await addDoc(collection(db, 'customers'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setCustomers([{ id: docRef.id, ...payload, createdAt: new Date().toISOString() }, ...customers]);
      }
      setShowFormModal(false);
    } catch (err) {
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  // Helper check if customer has overdue claims > 30 days
  const hasDelayedClaims = (custCompanyName: string): boolean => {
    return claims.some(c => 
      c.companyName.toLowerCase().trim() === custCompanyName.toLowerCase().trim() && 
      isClaimOverdue(c.receivedClaimDate, c.claimStatus)
    );
  };

  const filteredCustomers = customers.filter(c => {
    const q = search.toLowerCase().trim();
    return (
      c.companyName.toLowerCase().includes(q) ||
      (c.contactName || '').toLowerCase().includes(q) ||
      c.contactPhone.toLowerCase().includes(q) ||
      (c.partnerCompany || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Search and Action area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm p-4 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อบริษัท, ผู้ติดต่อ, เบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            title="นำเข้าไฟล์ CSV สำหรับรายงาน"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>นำเข้า CSV</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="ส่งออกรายงาน Excel (.csv)"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>ส่งออก CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มรายชื่อลูกค้า</span>
          </button>
        </div>
      </div>

      {/* Grid of customer Cards */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          กำลังโหลดรายชื่อและประวัติลูกค้า...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="py-20 text-center text-slate-500">
          ไม่พบข้อมูลรายชื่อลูกค้าในฐานข้อมูล
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((cust) => {
            const hasOverdue = hasDelayedClaims(cust.companyName);
            const onsiteCount = onsiteJobs.filter(j => j.companyName.toLowerCase().trim() === cust.companyName.toLowerCase().trim()).length;
            const oncallCount = oncallJobs.filter(j => j.companyName.toLowerCase().trim() === cust.companyName.toLowerCase().trim()).length;
            const claimsCount = claims.filter(c => c.companyName.toLowerCase().trim() === cust.companyName.toLowerCase().trim()).length;

            return (
              <div 
                key={cust.id} 
                className={`bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-0.5 relative group ${
                  hasOverdue ? 'border-rose-300 bg-rose-50/10' : ''
                }`}
              >
                {/* Delayed warning label */}
                {hasOverdue && (
                  <span className="absolute top-4 right-4 bg-rose-100 text-rose-700 border border-rose-200 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <ShieldAlert className="w-3 h-3" />
                    มีของเคลมค้างเกิน 30 วัน
                  </span>
                )}

                {/* Company Title */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl border ${hasOverdue ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      <Building className="w-5 h-5" />
                    </div>
                    <h3 className="text-slate-900 font-bold text-base group-hover:text-blue-600 transition-colors leading-tight">
                      {cust.companyName}
                    </h3>
                  </div>
                  {cust.partnerCompany && (
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wide">
                      พาร์ทเนอร์: {cust.partnerCompany}
                    </p>
                  )}
                </div>

                {/* Details list */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <p className="flex items-start gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>ผู้ติดต่อ: <strong className="text-slate-800">{cust.contactName || '-'}</strong> {cust.contactDetails ? `(${cust.contactDetails})` : ''}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>โทรศัพท์: <strong className="text-slate-800">{cust.contactPhone || '-'}</strong></span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">อีเมล: {cust.contactEmail || '-'}</span>
                  </p>
                  {cust.companyAddress && (
                    <p className="flex items-start gap-1.5 pt-1 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{cust.companyAddress}</span>
                    </p>
                  )}
                </div>

                {/* Counter Summaries */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-center text-[10px]">
                  <div>
                    <span className="text-slate-500 block font-semibold uppercase">Onsite</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">{onsiteCount} ครั้ง</span>
                  </div>
                  <div className="border-x border-slate-200">
                    <span className="text-slate-500 block font-semibold uppercase">Oncall</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">{oncallCount} ครั้ง</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold uppercase">เคลมสินค้า</span>
                    <span className={`text-sm font-bold font-mono ${hasOverdue ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                      {claimsCount} ชิ้น
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenHistory(cust)}
                    className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3 py-1.5 rounded-lg border border-blue-100 hover:border-blue-600 transition-all font-semibold"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>ประวัติบริการย้อนหลัง</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>

                  <div className="flex space-x-1">
                    <button
                      id={`edit-cust-btn-${cust.id}`}
                      onClick={() => handleOpenEdit(cust)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-150 text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                      title="แก้ไขรายชื่อลูกค้า"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`delete-cust-btn-${cust.id}`}
                      onClick={() => handleDelete(cust.id)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-colors border border-rose-100 hover:border-rose-600"
                      title="ลบรายชื่อลูกค้า"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* =======================================
          ADD/EDIT CLIENT FORM MODAL
          ======================================= */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-xl space-y-6 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5.5 h-5.5 text-blue-600" />
                {isEditing ? 'แก้ไขรายชื่อผู้ว่าจ้าง/ลูกค้า' : 'เพิ่มรายชื่อลูกค้าใหม่'}
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-600">ชื่อบริษัท / ร้านค้าผู้ว่าจ้าง *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="บริษัท เทคโนโลยี โซลูชั่น จำกัด"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-600">บริษัทพาร์ทเนอร์ร่วมดูแล (ถ้ามี)</label>
                <input
                  type="text"
                  value={partnerCompany}
                  onChange={(e) => setPartnerCompany(e.target.value)}
                  placeholder="เช่น บจก. พลังเน็ตเวิร์ค"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-600">ที่อยู่สำนักงาน / สาขา</label>
                <textarea
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="ระบุที่อยู่สำนักงานของลูกค้า"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">ชื่อผู้ประสานงานหลัก</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="คุณจิตรดี รักการดี"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">รายละเอียดเพิ่มเติมผู้ติดต่อ</label>
                  <input
                    type="text"
                    value={contactDetails}
                    onChange={(e) => setContactDetails(e.target.value)}
                    placeholder="เช่น ผู้ช่วยไอที ชั้น 2"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">เบอร์โทรศัพท์มือถือ/สำนักงาน *</label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="089-111-2222"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">อีเมลติดต่อประสานงาน</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jitdee@techsolutions.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4 mt-5">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 px-5 py-2 rounded-xl text-sm font-semibold transition-colors border border-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-sm"
                >
                  บันทึกข้อมูลลูกค้า
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =======================================
          CUSTOMER HISTORIC SERVICE LOGS DIALOG (Drawer/Modal)
          ======================================= */}
      {showHistoryModal && historyCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl p-6 md:p-8 max-h-[92vh] overflow-y-auto shadow-xl space-y-6 text-slate-800">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-4">
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5.5 h-5.5 text-blue-600" />
                  ประวัติรายงานการบริการย้อนหลังทั้งหมด
                </h3>
                <p className="text-xs text-slate-500">บริษัท: <strong className="text-slate-900 text-sm">{historyCustomer.companyName}</strong></p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Logs Body */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
              
              {/* ONSITE History log list */}
              <div className="bg-slate-50/50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200/80 pb-2 flex items-center gap-1.5 text-blue-600">
                  <Laptop className="w-4 h-4" />
                  งานบริการนอกสถานที่ (Onsite)
                </h4>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {onsiteJobs.filter(j => j.companyName.toLowerCase().trim() === historyCustomer.companyName.toLowerCase().trim()).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">ไม่มีประวัติงาน Onsite</p>
                  ) : (
                    onsiteJobs
                      .filter(j => j.companyName.toLowerCase().trim() === historyCustomer.companyName.toLowerCase().trim())
                      .map(job => (
                        <div key={job.id} className="bg-white border border-slate-200 p-3 rounded-xl space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 font-semibold text-xs">{job.serviceType}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              job.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {job.status === 'Completed' ? 'เสร็จสิ้น' : 'รอดำเนินการ'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">อาการ: {job.symptomReport}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>ช่าง: {job.techName}</span>
                            <span>วันที่: {job.assignedDate}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* ONCALL History log list */}
              <div className="bg-slate-50/50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200/80 pb-2 flex items-center gap-1.5 text-indigo-600">
                  <MessageSquare className="w-4 h-4" />
                  งานตอบโทรศัพท์ (Oncall)
                </h4>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {oncallJobs.filter(j => j.companyName.toLowerCase().trim() === historyCustomer.companyName.toLowerCase().trim()).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">ไม่มีประวัติงาน Oncall</p>
                  ) : (
                    oncallJobs
                      .filter(j => j.companyName.toLowerCase().trim() === historyCustomer.companyName.toLowerCase().trim())
                      .map(job => (
                        <div key={job.id} className="bg-white border border-slate-200 p-3 rounded-xl space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 font-semibold text-xs">{job.productType}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              job.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {job.status === 'Completed' ? 'เสร็จสิ้น' : 'รอดำเนินการ'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">แจ้ง: {job.symptomReport}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>ช่าง: {job.techName}</span>
                            <span>วันที่: {job.assignedDate}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* CLAIMS History log list */}
              <div className="bg-slate-50/50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200/80 pb-2 flex items-center gap-1.5 text-teal-600">
                  <Clipboard className="w-4 h-4" />
                  การเคลมผลิตภัณฑ์สินค้า (Claims)
                </h4>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {claims.filter(c => c.companyName.toLowerCase().trim() === historyCustomer.companyName.toLowerCase().trim()).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">ไม่มีประวัติการส่งเคลม</p>
                  ) : (
                    claims
                      .filter(c => c.companyName.toLowerCase().trim() === historyCustomer.companyName.toLowerCase().trim())
                      .map(claim => (
                        <div key={claim.id} className="bg-white border border-slate-200 p-3 rounded-xl space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 font-semibold text-xs">{claim.productBrand} ({claim.model})</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              claim.claimStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {claim.claimStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium">S/N: <strong className="font-mono text-slate-900">{claim.serialNumber}</strong></p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>ผู้เช็ค: {claim.inspectorName || '-'}</span>
                            <span>รับเมื่อ: {claim.receivedClaimDate}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
