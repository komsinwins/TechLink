import React, { useState, useEffect, useRef } from 'react';
import { OncallService } from '../types';
import { useFirebase } from './FirebaseProvider';
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
  Plus, Edit2, Trash2, PhoneCall, Calendar, Clock, AlertTriangle, 
  Search, CheckCircle, X, ChevronRight, User as UserIcon, Upload, Download, Printer,
  LayoutGrid, LayoutList, Menu, FileText
} from 'lucide-react';
import { calculateDaysBetween, isJobOverdue } from '../utils/date';
import { parseCSV, generateCSV, downloadFile } from '../utils/csvHelper';

export const OncallPanel: React.FC<{ initialSearch?: string }> = ({ initialSearch = '' }) => {
  const { user, lookups, addLookupItem, deleteLookupItem } = useFirebase();
  const [jobs, setJobs] = useState<OncallService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'View' | 'content' | 'Icon' | 'List'>('View');
  
  // Custom CSV and Print states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  const oncallHeaders = [
    'Company Name', 'Company Address', 'Contact Name', 'Contact Details', 
    'Contact Phone', 'Contact Email', 'Partner Company', 'Product Type', 
    'Tech Name', 'Sales Name', 'Assigned Date', 'Fixed Date', 
    'Symptom Report', 'Solution', 'Notes', 'Status'
  ];
  
  const oncallKeys = [
    'companyName', 'companyAddress', 'contactName', 'contactDetails', 
    'contactPhone', 'contactEmail', 'partnerCompany', 'productType', 
    'techName', 'salesName', 'assignedDate', 'fixedDate', 
    'symptomReport', 'solution', 'notes', 'status'
  ];

  const handleExportCSV = () => {
    const csvContent = generateCSV(oncallHeaders, filteredJobs, oncallKeys);
    downloadFile(`oncall_services_report_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
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
        const importedJobs: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

          const job: any = {};
          const todayStr = new Date().toISOString().split('T')[0];
          job.assignedDate = todayStr;
          job.fixedDate = todayStr;
          job.status = 'Pending';
          job.createdAt = new Date().toISOString();
          job.updatedAt = new Date().toISOString();

          headers.forEach((header, index) => {
            const val = row[index] || '';
            if (header === 'company name' || header === 'companyname') job.companyName = val;
            else if (header === 'company address' || header === 'companyaddress') job.companyAddress = val;
            else if (header === 'contact name' || header === 'contactname') job.contactName = val;
            else if (header === 'contact details' || header === 'contactdetails') job.contactDetails = val;
            else if (header === 'contact phone' || header === 'contactphone') job.contactPhone = val;
            else if (header === 'contact email' || header === 'contactemail') job.contactEmail = val;
            else if (header === 'partner company' || header === 'partnercompany') job.partnerCompany = val;
            else if (header === 'product type' || header === 'producttype') job.productType = val;
            else if (header === 'tech name' || header === 'techname') job.techName = val;
            else if (header === 'sales name' || header === 'salesname') job.salesName = val;
            else if (header === 'assigned date' || header === 'assigneddate') job.assignedDate = val;
            else if (header === 'fixed date' || header === 'fixeddate') job.fixedDate = val;
            else if (header === 'symptom report' || header === 'symptomreport') job.symptomReport = val;
            else if (header === 'solution') job.solution = val;
            else if (header === 'notes') job.notes = val;
            else if (header === 'status') {
              if (['Pending', 'In Progress', 'Completed'].includes(val)) {
                job.status = val;
              }
            }
          });

          if (!job.companyName) continue;
          importedJobs.push(job);
        }

        if (importedJobs.length === 0) {
          alert("ไม่พบข้อมูลงาน On-call Service ที่ถูกต้องในไฟล์ CSV");
          return;
        }

        if (!confirm(`คุณต้องการนำเข้าข้อมูลงาน On-call Service จำนวน ${importedJobs.length} รายการใช่หรือไม่?`)) {
          return;
        }

        const path = 'oncall_services';
        const customersPath = 'customers';

        for (const job of importedJobs) {
          await addDoc(collection(db, path), job);

          const snapshot = await getDocs(collection(db, customersPath));
          let exists = false;
          snapshot.forEach((docSnap) => {
            if (docSnap.data().companyName.toLowerCase().trim() === job.companyName.toLowerCase().trim()) {
              exists = true;
            }
          });

          if (!exists) {
            await addDoc(collection(db, customersPath), {
              companyName: job.companyName,
              companyAddress: job.companyAddress || '',
              contactName: job.contactName || '',
              contactDetails: job.contactDetails || '',
              contactPhone: job.contactPhone || '',
              contactEmail: job.contactEmail || '',
              partnerCompany: job.partnerCompany || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }

        alert("นำเข้าข้อมูลเสร็จสมบูรณ์!");
        fetchJobs();
      } catch (err) {
        console.error("Error importing CSV:", err);
        alert("เกิดข้อผิดพลาดในการนำเข้าไฟล์ CSV: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Form/Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeJob, setActiveJob] = useState<OncallService | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Autocomplete suggestions state
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Dynamic product type inline add
  const [newCustomProductType, setNewCustomProductType] = useState('');
  const [showAddProductType, setShowAddProductType] = useState(false);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [partnerCompany, setPartnerCompany] = useState('');
  const [productType, setProductType] = useState('');
  const [salesName, setSalesName] = useState('');
  const [assignedDate, setAssignedDate] = useState('');
  const [fixedDate, setFixedDate] = useState('');
  const [techName, setTechName] = useState('');
  const [symptomReport, setSymptomReport] = useState('');
  const [solution, setSolution] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Pending' | 'In Progress' | 'Completed'>('Pending');

  // Detail Drawer state
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [drawerJob, setDrawerJob] = useState<OncallService | null>(null);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const fetchJobs = async () => {
    setLoading(true);
    const path = 'oncall_services';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched: OncallService[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as OncallService);
      });
      setJobs(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbCustomers = async () => {
    try {
      const q = query(collection(db, 'customers'), orderBy('companyName'));
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDbCustomers(list);
    } catch (err) {
      console.error("Error fetching customers for autocomplete:", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchDbCustomers();
  }, []);

  useEffect(() => {
    if (lookups.oncallProductTypes.length > 0 && !productType) {
      setProductType(lookups.oncallProductTypes[0]);
    }
  }, [lookups, productType]);

  const repairDuration = calculateDaysBetween(assignedDate, fixedDate);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setActiveJob(null);
    setCompanyName('');
    setCompanyAddress('');
    setContactName('');
    setContactDetails('');
    setContactPhone('');
    setContactEmail('');
    setPartnerCompany('');
    setProductType(lookups.oncallProductTypes[0] || '');
    setSalesName('');
    setTechName('');
    
    const todayStr = new Date().toISOString().split('T')[0];
    setAssignedDate(todayStr);
    setFixedDate(todayStr);

    setSymptomReport('');
    setSolution('');
    setNotes('');
    setStatus('Pending');
    setShowFormModal(true);
  };

  const handleOpenEdit = (job: OncallService) => {
    setIsEditing(true);
    setActiveJob(job);
    setCompanyName(job.companyName);
    setCompanyAddress(job.companyAddress || '');
    setContactName(job.contactName || '');
    setContactDetails(job.contactDetails || '');
    setContactPhone(job.contactPhone || '');
    setContactEmail(job.contactEmail || '');
    setPartnerCompany(job.partnerCompany || '');
    setProductType(job.productType);
    setSalesName(job.salesName || '');
    setAssignedDate(job.assignedDate || '');
    setFixedDate(job.fixedDate || '');
    setTechName(job.techName || '');
    setSymptomReport(job.symptomReport || '');
    setSolution(job.solution || '');
    setNotes(job.notes || '');
    setStatus(job.status || 'Pending');
    setShowFormModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    const path = 'oncall_services';
    const payload = {
      companyName,
      companyAddress,
      contactName,
      contactDetails,
      contactPhone,
      contactEmail,
      partnerCompany,
      productType,
      salesName,
      assignedDate,
      fixedDate,
      repairDuration,
      techName,
      symptomReport,
      solution,
      notes,
      status,
      updatedAt: new Date().toISOString()
    };

    try {
      if (isEditing && activeJob) {
        const docRef = doc(db, path, activeJob.id);
        await updateDoc(docRef, payload);
      } else {
        const newDoc = {
          ...payload,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, path), newDoc);
        
        // Auto-add client if not exists
        const customersPath = 'customers';
        const clientQuery = query(collection(db, customersPath));
        const clientSnap = await getDocs(clientQuery);
        let exists = false;
        clientSnap.forEach((docSnap) => {
          if (docSnap.data().companyName.toLowerCase().trim() === companyName.toLowerCase().trim()) {
            exists = true;
          }
        });

        if (!exists) {
          await addDoc(collection(db, customersPath), {
            companyName,
            companyAddress,
            contactName,
            contactDetails,
            contactPhone,
            contactEmail,
            partnerCompany,
            salesName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        fetchDbCustomers();
      }
      setShowFormModal(false);
      fetchJobs();
    } catch (err) {
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณต้องการลบรายงาน Oncall นี้ใช่หรือไม่?')) return;
    const path = 'oncall_services';
    try {
      await deleteDoc(doc(db, path, id));
      fetchJobs();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleOpenDetail = (job: OncallService) => {
    setDrawerJob(job);
    setShowDetailDrawer(true);
  };

  // Custom Product/Service category lookup management
  const handleAddProductType = () => {
    const val = newCustomProductType.trim();
    if (val) {
      addLookupItem('oncallProductTypes', val);
      setProductType(val);
      setNewCustomProductType('');
      setShowAddProductType(false);
    }
  };

  const handleDeleteProductType = (typeToDelete: string) => {
    if (window.confirm(`คุณแน่ใจว่าต้องการลบประเภทสินค้า "${typeToDelete}" ใช่หรือไม่?`)) {
      deleteLookupItem('oncallProductTypes', typeToDelete);
      if (productType === typeToDelete) {
        setProductType(lookups.oncallProductTypes[0] || '');
      }
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchSearch = 
      job.companyName.toLowerCase().includes(search.toLowerCase()) ||
      job.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      job.techName?.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'All') return matchSearch;
    return matchSearch && job.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Search and Action area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm p-4 rounded-2xl">
        <div className="flex flex-1 flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อบริษัท, ช่างเทคนิค, เบอร์โทร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 flex-wrap">
            {['All', 'Pending', 'In Progress', 'Completed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'All' ? 'ทั้งหมด' : st === 'Pending' ? 'รอดำเนินการ' : st === 'In Progress' ? 'กำลังดำเนินการ' : 'เสร็จสมบูรณ์'}
              </button>
            ))}
          </div>

          {/* View Mode selectors */}
          <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 flex-wrap">
            {([
              { key: 'View', label: 'View', icon: Menu },
              { key: 'content', label: 'content', icon: FileText },
              { key: 'Icon', label: 'Icon', icon: LayoutGrid },
              { key: 'List', label: 'List', icon: LayoutList }
            ] as const).map(({ key, label, icon: IconComponent }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={label}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
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
            onClick={() => setShowPrintReportModal(true)}
            title="พิมพ์รายงานรวม PDF"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            <span>พิมพ์รายงานรวม (PDF)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มบันทึก Oncall Service</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
            กำลังโหลดข้อมูลงาน Oncall...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            ไม่มีบันทึกงาน Oncall Service ที่ตรงเงื่อนไข
          </div>
        ) : (
          <div className="p-1">
            {/* View Mode: View (Detailed Grid Table) */}
            {viewMode === 'View' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 tracking-wider uppercase">
                      <th className="px-6 py-4">ลูกค้า / ผู้ติดต่อ</th>
                      <th className="px-6 py-4">ประเภทผลิตภัณฑ์/ระบบ</th>
                      <th className="px-6 py-4">ผู้ปฏิบัติงาน / เซลส์</th>
                      <th className="px-6 py-4">วันที่แจ้ง / ปิดงาน</th>
                      <th className="px-6 py-4">ระยะเวลาซ่อม</th>
                      <th className="px-6 py-4">อาการเบื้องต้น</th>
                      <th className="px-6 py-4">สถานะ</th>
                      <th className="px-6 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredJobs.map((job) => {
                      const isOver = isJobOverdue(job.assignedDate, job.status);
                      return (
                        <tr 
                          key={job.id} 
                          className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                            isOver ? 'bg-rose-50/20 hover:bg-rose-50/40' : ''
                          }`}
                          onClick={() => handleOpenDetail(job)}
                        >
                          <td className="px-6 py-4 space-y-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <span 
                                onClick={() => handleOpenDetail(job)}
                                className="font-bold text-slate-900 text-sm hover:underline hover:text-blue-600 cursor-pointer"
                              >
                                {job.companyName}
                              </span>
                              {isOver && (
                                <span className="bg-rose-50 text-rose-700 border border-rose-150 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  ค้าง &gt; 7 วัน
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">ติดต่อ: {job.contactName} ({job.contactPhone})</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full font-medium text-[11px] text-indigo-700">
                              {job.productType}
                            </span>
                          </td>
                          <td className="px-6 py-4 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>ช่าง: <strong className="text-slate-900">{job.techName || '-'}</strong></span>
                            </div>
                            <p className="text-[11px] text-slate-500">เซลส์: {job.salesName || '-'}</p>
                          </td>
                          <td className="px-6 py-4 space-y-0.5 text-slate-500">
                            <p className="text-[11px]">แจ้ง: <strong className="text-slate-800">{job.assignedDate}</strong></p>
                            <p className="text-[11px]">ปิดงาน: <strong className="text-slate-800">{job.fixedDate || '-'}</strong></p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold bg-slate-50 px-2.5 py-1 rounded text-slate-800 border border-slate-200">
                              {job.repairDuration} วัน
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-[160px] truncate text-slate-600" title={job.symptomReport}>
                            {job.symptomReport || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              job.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : job.status === 'In Progress'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังแก้ไข' : 'รอดำเนินการ'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              id={`edit-oncall-btn-${job.id}`}
                              onClick={() => handleOpenEdit(job)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-oncall-btn-${job.id}`}
                              onClick={() => handleDelete(job.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-colors border border-rose-100 hover:border-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* View Mode: content (Content focused view focusing on Symptom Report & Solution) */}
            {viewMode === 'content' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 tracking-wider uppercase">
                      <th className="px-6 py-4">ลูกค้า / ผู้ติดต่อ</th>
                      <th className="px-6 py-4">อาการรับแจ้ง & วิธีแก้ไข (Content)</th>
                      <th className="px-6 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredJobs.map((job) => (
                      <tr 
                        key={job.id} 
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(job)}
                      >
                        <td className="px-6 py-4 space-y-1 align-top w-1/4" onClick={(e) => e.stopPropagation()}>
                          <p className="font-bold text-slate-900 text-sm hover:underline hover:text-blue-600" onClick={() => handleOpenDetail(job)}>{job.companyName}</p>
                          <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px] text-indigo-700 font-semibold block w-fit">
                            {job.productType}
                          </span>
                        </td>
                        <td className="px-6 py-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">อาการแจ้งเสีย (Oncall Symptom)</span>
                              <p className="text-slate-700 leading-relaxed text-xs">{job.symptomReport || '-'}</p>
                            </div>
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">แนวทางแก้ไข (Solution)</span>
                              <p className="text-slate-700 leading-relaxed text-xs">{job.solution || '-'}</p>
                            </div>
                          </div>
                          <div className="flex gap-4 text-[10px] text-slate-500">
                            <span>ช่างให้คำปรึกษา: <strong className="text-slate-700">{job.techName || '-'}</strong></span>
                            <span>วันที่โทรปรึกษา: <strong className="text-slate-700">{job.assignedDate}</strong></span>
                            {job.notes && <span>บันทึกเพิ่มเติม: <span className="text-slate-600 font-mono">{job.notes}</span></span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right align-top space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEdit(job)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-colors border border-rose-100 hover:border-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* View Mode: Icon (Grid Card style) */}
            {viewMode === 'Icon' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                {filteredJobs.map((job) => {
                  const isOver = isJobOverdue(job.assignedDate, job.status);
                  return (
                    <div 
                      key={job.id} 
                      onClick={() => handleOpenDetail(job)}
                      className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer ${
                        isOver ? 'border-rose-200 bg-rose-50/5' : 'border-slate-200'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded">
                            Oncall Log
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังแก้ไข' : 'รอดำเนินการ'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 text-base line-clamp-1">{job.companyName}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            <span>ผู้ติดต่อ: {job.contactName || '-'} ({job.contactPhone || '-'})</span>
                          </p>
                          <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded">
                            ระบบ: {job.productType}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block">รายละเอียดอาการ</span>
                          <p className="text-xs text-slate-700 line-clamp-2">{job.symptomReport || '-'}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-slate-400">ช่างเทคนิค: {job.techName || '-'}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(job)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg border border-indigo-100 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(job)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-150 text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-colors border border-rose-100"
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

            {/* View Mode: List (Minimalist text row list) */}
            {viewMode === 'List' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <th className="px-4 py-2.5">ลูกค้า</th>
                      <th className="px-4 py-2.5">ระบบ/ผลิตภัณฑ์</th>
                      <th className="px-4 py-2.5">ช่างเทคนิค</th>
                      <th className="px-4 py-2.5">วันที่โทรแจ้ง</th>
                      <th className="px-4 py-2.5">สถานะ</th>
                      <th className="px-4 py-2.5 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredJobs.map((job) => (
                      <tr 
                        key={job.id} 
                        className="hover:bg-slate-50/55 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(job)}
                      >
                        <td className="px-4 py-2 font-bold text-slate-900" onClick={(e) => e.stopPropagation()}>
                          <span onClick={() => handleOpenDetail(job)} className="hover:underline hover:text-blue-600 cursor-pointer">
                            {job.companyName}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{job.productType}</td>
                        <td className="px-4 py-2 text-slate-600">{job.techName || '-'}</td>
                        <td className="px-4 py-2 text-slate-500 font-mono text-[11px]">{job.assignedDate}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right space-x-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEdit(job)}
                            className="text-slate-600 hover:text-slate-900 text-[11px]"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="text-rose-600 hover:text-rose-900 text-[11px]"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =======================================
          ADD/EDIT ONCALL FORM MODAL
          ======================================= */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-xl space-y-6 text-slate-800">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <PhoneCall className="w-5.5 h-5.5 text-blue-600" />
                {isEditing ? 'แก้ไขบันทึก Oncall Service' : 'บันทึกประวัติการโทร Oncall Service'}
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              
              {/* Customer contact fields */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">1. ข้อมูลผู้ติดต่อ & บริษัท</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-semibold text-slate-600">ชื่อบริษัทลูกค้า *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        setShowCustomerSuggestions(true);
                      }}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      placeholder="บริษัท ซิสเต็ม พาร์ทเนอร์ จำกัด"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />

                    {showCustomerSuggestions && dbCustomers.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        <div className="p-1.5 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold flex justify-between items-center">
                          <span>รายชื่อแนะนำจากฐานข้อมูลลูกค้า ({dbCustomers.filter(c => c.companyName?.toLowerCase().includes(companyName.toLowerCase())).length})</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomerSuggestions(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ปิด
                          </button>
                        </div>
                        {dbCustomers
                          .filter(c => c.companyName?.toLowerCase().includes(companyName.toLowerCase()))
                          .map((cust) => (
                            <button
                              key={cust.id}
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-blue-50/50 border-b border-slate-100 last:border-b-0 transition-colors block"
                              onClick={() => {
                                setCompanyName(cust.companyName);
                                setCompanyAddress(cust.companyAddress || '');
                                setContactName(cust.contactName || '');
                                setContactDetails(cust.contactDetails || '');
                                setContactPhone(cust.contactPhone || '');
                                setContactEmail(cust.contactEmail || '');
                                setPartnerCompany(cust.partnerCompany || '');
                                if (cust.salesName) {
                                  setSalesName(cust.salesName);
                                }
                                setShowCustomerSuggestions(false);
                              }}
                            >
                              <div className="text-xs font-bold text-slate-800">{cust.companyName}</div>
                              <div className="text-[10px] text-slate-500 flex justify-between">
                                <span>ผู้ติดต่อ: {cust.contactName || '-'}</span>
                                <span>โทร: {cust.contactPhone || '-'}</span>
                              </div>
                            </button>
                          ))}
                        {dbCustomers.filter(c => c.companyName?.toLowerCase().includes(companyName.toLowerCase())).length === 0 && (
                          <div className="p-3 text-xs text-slate-400 text-center">ไม่พบข้อมูลในฐานข้อมูลลูกค้า (กรอกใหม่ได้เลย)</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">บริษัทคู่ค้า (ถ้ามี)</label>
                    <input
                      type="text"
                      value={partnerCompany}
                      onChange={(e) => setPartnerCompany(e.target.value)}
                      placeholder="เช่น บจก. พลัส แอดวานซ์"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ที่อยู่บริษัท</label>
                    <input
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="ที่อยู่เบื้องหลังการเคลม/ติดต่อบริการ"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ชื่อผู้ติดต่อ</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="คุณวรรณา ดีจัง"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">รายละเอียดเพิ่มเติมผู้ติดต่อ</label>
                    <input
                      type="text"
                      value={contactDetails}
                      onChange={(e) => setContactDetails(e.target.value)}
                      placeholder="เบอร์โทรภายใน หรือสังกัดส่วนงาน"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">เบอร์โทรศัพท์ผู้ติดต่อ *</label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="02-999-9999"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">อีเมลติดต่อ</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="wanna@systempartner.co.th"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Service Details & Schedule */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">2. ระบบที่แจ้งบริการ & ผู้ปฏิบัติหน้าที่</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  
                  {/* Product Type select with inline config */}
                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-600">ระบบที่รับแจ้ง / ประเภทสินค้า *</label>
                      <button
                        type="button"
                        onClick={() => setShowAddProductType(!showAddProductType)}
                        className="text-blue-600 hover:text-blue-500 text-[10px] font-bold underline"
                      >
                        {showAddProductType ? 'ซ่อนการเพิ่ม' : '+ เพิ่ม/ลบประเภทสินค้า'}
                      </button>
                    </div>

                    {showAddProductType ? (
                      <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCustomProductType}
                            onChange={(e) => setNewCustomProductType(e.target.value)}
                            placeholder="พิมพ์ประเภทสินค้าใหม่..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddProductType}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            เพิ่ม
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pt-2">
                          {lookups.oncallProductTypes.map((type) => (
                            <span key={type} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] px-2 py-1 rounded-md border border-slate-200">
                              {type}
                              <button
                                type="button"
                                onClick={() => handleDeleteProductType(type)}
                                className="text-rose-400 hover:text-rose-300 font-bold"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <select
                        value={productType}
                        onChange={(e) => setProductType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                      >
                        {lookups.oncallProductTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      วันที่รับแจ้ง *
                    </label>
                    <input
                      type="date"
                      required
                      value={assignedDate}
                      onChange={(e) => setAssignedDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      วันที่แก้ไขเสร็จสิ้น *
                    </label>
                    <input
                      type="date"
                      required
                      value={fixedDate}
                      onChange={(e) => setFixedDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl flex items-center justify-between col-span-1 md:col-span-2">
                    <p className="text-xs text-slate-600 font-bold uppercase">ระยะเวลาในการช่วยเหลือแก้ไขปัญหาโดยรวม</p>
                    <p className="text-base font-mono font-black text-slate-800">{repairDuration} วันปฏิทิน</p>
                  </div>

                </div>
              </div>

              {/* Descriptions & Status */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">3. รายละเอียดรายงาน</h3>
                
                <div className="space-y-3 text-left">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">คำบรรยายรับแจ้งอาการ *</label>
                    <textarea
                      required
                      value={symptomReport}
                      onChange={(e) => setSymptomReport(e.target.value)}
                      placeholder="อาการเบื้องต้นที่ลูกค้าโทรแจ้งเข้ามาให้ด่วนที่สุด เช่น ล็อกอิน VPN ไม่ผ่าน แผงวงจรเครื่องรีสตาร์ทตลอด..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">คำบรรยายวิธีการแก้ไขปัญหา</label>
                    <textarea
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      placeholder="อธิบายการช่วยเหลือของช่าง เช่น รีเซ็ตไอพีแอดเดรสเราเตอร์ และเคลียร์เซสชันค้างของโปรไฟล์ผู้ใช้งาน..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">หมายเหตุเพิ่มเติม</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="หมายเหตุเพิ่มเติม เช่น แนะนำให้ผู้ใช้อัปเกรดความเร็วอินเทอร์เน็ตเพิ่มขึ้น..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">สถานะบันทึกการโทร</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pending">Pending (รอดำเนินการ)</option>
                      <option value="In Progress">In Progress (กำลังดำเนินการ)</option>
                      <option value="Completed">Completed (เสร็จสิ้นการโทรและแก้ไข)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/10 transition-all active:scale-95"
                >
                  บันทึกข้อมูล
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =======================================
          DETAIL DRAWER VIEW (SIDE MODAL)
          ======================================= */}
      {showDetailDrawer && drawerJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 p-4 transition-all">
          <div className="bg-white border-l border-slate-200 w-full max-w-lg p-6 md:p-8 h-full shadow-xl overflow-y-auto space-y-6 text-left text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-slate-800 font-bold text-lg flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-blue-600" />
                รายละเอียดประวัติงาน Oncall
              </h3>
              <button
                onClick={() => setShowDetailDrawer(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Ticket Content */}
            <div className="space-y-5 text-sm">
              
              {/* Box 1: Company Profile */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">ข้อมูลติดต่อลูกค้า</span>
                <h4 className="text-base font-bold text-slate-900 leading-snug">{drawerJob.companyName}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">ที่อยู่: {drawerJob.companyAddress || 'ไม่มีข้อมูล'}</p>
                <p className="text-xs text-slate-700">ผู้ติดต่อหลัก: <strong className="text-slate-900">{drawerJob.contactName || '-'}</strong> {drawerJob.contactDetails ? `(${drawerJob.contactDetails})` : ''}</p>
                <p className="text-xs text-slate-700">โทรศัพท์: <strong className="text-slate-900">{drawerJob.contactPhone || '-'}</strong> | อีเมล: <strong className="text-slate-900">{drawerJob.contactEmail || '-'}</strong></p>
                {drawerJob.partnerCompany && <p className="text-xs text-indigo-600">พาร์ทเนอร์ร่วมงาน: {drawerJob.partnerCompany}</p>}
              </div>

              {/* Box 2: Job Assignment */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-500">รายละเอียดระบุระบบ</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">ระบบผลิตภัณฑ์:</span>
                    <strong className="text-slate-900 text-sm">{drawerJob.productType}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ช่างผู้รับผิดชอบ:</span>
                    <strong className="text-slate-900 text-sm">{drawerJob.techName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">พนักงานขายดูแล:</span>
                    <strong className="text-slate-900">{drawerJob.salesName || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">สถานะปัจจุบัน:</span>
                    <strong className="text-slate-900">{drawerJob.status === 'Completed' ? 'เสร็จงาน' : drawerJob.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}</strong>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2.5 grid grid-cols-3 gap-1 text-center bg-white p-2 rounded-lg border border-slate-150">
                  <div>
                    <span className="text-[9px] text-slate-500 block">วันที่รับแจ้ง</span>
                    <span className="text-xs font-bold text-slate-800">{drawerJob.assignedDate}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">วันที่ปิดงาน</span>
                    <span className="text-xs font-bold text-slate-800">{drawerJob.fixedDate}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">ระยะเวลาซ่อม</span>
                    <span className="text-xs font-bold text-blue-600">{drawerJob.repairDuration} วัน</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Technical Logs */}
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">อาการรับแจ้ง (Symptom Reported)</span>
                  <div className="bg-slate-50 border border-slate-250 p-3 rounded-xl">
                    <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{drawerJob.symptomReport || '-'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">วิธีการแก้ไขที่ดำเนินการ (Resolution)</span>
                  <div className="bg-slate-50 border border-slate-250 p-3 rounded-xl">
                    <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{drawerJob.solution || '-'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">หมายเหตุสำคัญ (Notes)</span>
                  <div className="bg-slate-50 border border-slate-250 p-3 rounded-xl">
                    <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{drawerJob.notes || '-'}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* =======================================
          PRINTABLE SUMMARY REPORT DOCUMENT (PDF)
          ======================================= */}
      {showPrintReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-5xl p-8 max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6 flex flex-col">
            
            {/* Window action buttons (sticky top) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                รายงานสรุปงาน Oncall Service ทั้งหมด ({filteredJobs.length} รายการ)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  สั่งพิมพ์ / บันทึก PDF
                </button>
                <button
                  onClick={() => setShowPrintReportModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Printable Document Core */}
            <div id="print-area" className="flex-1 space-y-6 font-sans pr-2 overflow-y-auto">
              {/* Document Header */}
              <div className="border-b-4 border-slate-800 pb-5 flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                    WSS Technical Support Service
                  </h1>
                  <p className="text-xs text-slate-500 font-semibold uppercase">ฝ่ายสนับสนุนด้านเทคนิคและซ่อมบำรุงเครือข่าย</p>
                  <p className="text-xs text-slate-500 font-medium">รายงานสรุปผลการดำเนินงานบริการ Oncall Service รายคาบ</p>
                </div>
                <div className="text-left md:text-right space-y-0.5">
                  <h2 className="text-xl font-black text-blue-800">รายงาน Oncall Service Report</h2>
                  <p className="text-xs text-slate-500">จำนวนรายการงาน: {filteredJobs.length} เคส</p>
                  <p className="text-xs text-slate-500">วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH')}</p>
                </div>
              </div>

              {/* Table of Jobs */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                      <th className="border border-slate-300 p-2 text-center">ลำดับ</th>
                      <th className="border border-slate-300 p-2">บริษัทลูกค้า</th>
                      <th className="border border-slate-300 p-2">ประเภทสินค้า/ระบบ</th>
                      <th className="border border-slate-300 p-2">ช่างรับผิดชอบ</th>
                      <th className="border border-slate-300 p-2">วันที่แจ้ง</th>
                      <th className="border border-slate-300 p-2">วันที่ปิดงาน</th>
                      <th className="border border-slate-300 p-2">อาการที่พบ / วิธีแก้ไข</th>
                      <th className="border border-slate-300 p-2 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] text-slate-800">
                    {filteredJobs.map((job, idx) => (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2">
                          <p className="font-bold text-slate-950">{job.companyName}</p>
                          <p className="text-[10px] text-slate-500">{job.contactName || '-'}</p>
                        </td>
                        <td className="border border-slate-300 p-2 font-semibold text-blue-800">{job.productType}</td>
                        <td className="border border-slate-300 p-2 font-medium">{job.techName || '-'}</td>
                        <td className="border border-slate-300 p-2 whitespace-nowrap">{job.assignedDate}</td>
                        <td className="border border-slate-300 p-2 whitespace-nowrap">{job.fixedDate}</td>
                        <td className="border border-slate-300 p-2 max-w-[200px] whitespace-normal">
                          <p className="font-semibold text-rose-800">อาการ: {job.symptomReport || '-'}</p>
                          <p className="text-emerald-800 mt-1">วิธีแก้: {job.solution || '-'}</p>
                        </td>
                        <td className="border border-slate-300 p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs">
                <div className="space-y-16">
                  <p className="text-slate-500 font-semibold uppercase">ผู้จัดทำรายงาน</p>
                  <div className="border-b border-slate-300 w-48 mx-auto" />
                  <p className="text-slate-800 font-bold">({user?.displayName || 'เจ้าหน้าที่ผู้รับผิดชอบ'})</p>
                </div>
                <div className="space-y-16">
                  <p className="text-slate-500 font-semibold uppercase">ผู้อนุมัติรายงาน</p>
                  <div className="border-b border-slate-300 w-48 mx-auto" />
                  <p className="text-slate-800 font-bold">(........................................................)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
