import React, { useState, useEffect, useRef } from 'react';
import { OnsiteService, PhotoItem } from '../types';
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
  Plus, Edit2, Trash2, FileText, Calendar, Clock, AlertTriangle, 
  Upload, X, Image as ImageIcon, CheckCircle, Search, Printer, User as UserIcon, Download,
  LayoutGrid, LayoutList, ListFilter, Menu
} from 'lucide-react';
import { calculateDaysBetween, isJobOverdue } from '../utils/date';
import { techPresetImages } from '../utils/mockImages';
import { parseCSV, generateCSV, downloadFile } from '../utils/csvHelper';

export const OnsitePanel: React.FC<{ initialSearch?: string }> = ({ initialSearch = '' }) => {
  const { user, lookups, addLookupItem, deleteLookupItem } = useFirebase();
  const [jobs, setJobs] = useState<OnsiteService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('All');

  const getJobNumber = (job: OnsiteService) => {
    const sortedJobs = [...jobs].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
    const index = sortedJobs.findIndex(j => j.id === job.id);
    const seqNum = index !== -1 ? index + 1 : 1;
    const year = new Date(job.createdAt || Date.now()).getFullYear();
    return `WSS_Service_${String(seqNum).padStart(3, '0')}_${year}`;
  };
  
  // Custom CSV Ref and Report States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [showCombinedPrintModal, setShowCombinedPrintModal] = useState(false);

  const onsiteHeaders = [
    'Company Name', 'Company Address', 'Contact Name', 'Contact Details', 
    'Contact Phone', 'Contact Email', 'Partner Company', 'Service Type', 
    'Onsite Location', 'Tech Name', 'Sales Name', 'Assigned Date', 
    'Action Date', 'Fixed Date', 'Symptom Report', 'Inspection Cause', 
    'Solution', 'Notes', 'Status'
  ];
  
  const onsiteKeys = [
    'companyName', 'companyAddress', 'contactName', 'contactDetails', 
    'contactPhone', 'contactEmail', 'partnerCompany', 'serviceType', 
    'onsiteLocation', 'techName', 'salesName', 'assignedDate', 
    'actionDate', 'fixedDate', 'symptomReport', 'inspectionCause', 
    'solution', 'notes', 'status'
  ];

  const handleExportCSV = () => {
    const csvContent = generateCSV(onsiteHeaders, filteredJobs, onsiteKeys);
    downloadFile(`onsite_services_report_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(filteredJobs.map(j => j.id).filter((id): id is string => !!id));
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobIds(prev => [...prev, jobId]);
    } else {
      setSelectedJobIds(prev => prev.filter(id => id !== jobId));
    }
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
          job.actionDate = todayStr;
          job.fixedDate = todayStr;
          job.status = 'Pending';
          job.createdAt = new Date().toISOString();
          job.updatedAt = new Date().toISOString();
          job.photos = [
            { url: '', caption: '' },
            { url: '', caption: '' },
            { url: '', caption: '' },
            { url: '', caption: '' },
          ];

          headers.forEach((header, index) => {
            const val = row[index] || '';
            if (header === 'company name' || header === 'companyname') job.companyName = val;
            else if (header === 'company address' || header === 'companyaddress') job.companyAddress = val;
            else if (header === 'contact name' || header === 'contactname') job.contactName = val;
            else if (header === 'contact details' || header === 'contactdetails') job.contactDetails = val;
            else if (header === 'contact phone' || header === 'contactphone') job.contactPhone = val;
            else if (header === 'contact email' || header === 'contactemail') job.contactEmail = val;
            else if (header === 'partner company' || header === 'partnercompany') job.partnerCompany = val;
            else if (header === 'service type' || header === 'servicetype') job.serviceType = val;
            else if (header === 'onsite location' || header === 'onsitelocation') job.onsiteLocation = val;
            else if (header === 'tech name' || header === 'techname') job.techName = val;
            else if (header === 'sales name' || header === 'salesname') job.salesName = val;
            else if (header === 'assigned date' || header === 'assigneddate') job.assignedDate = val;
            else if (header === 'action date' || header === 'actiondate') job.actionDate = val;
            else if (header === 'fixed date' || header === 'fixeddate') job.fixedDate = val;
            else if (header === 'symptom report' || header === 'symptomreport') job.symptomReport = val;
            else if (header === 'inspection cause' || header === 'inspectioncause') job.inspectionCause = val;
            else if (header === 'solution') job.solution = val;
            else if (header === 'notes') job.notes = val;
            else if (header === 'status') {
              if (['Pending', 'In Progress', 'Completed'].includes(val)) {
                job.status = val;
              }
            }
          });

          if (!job.companyName) {
            continue;
          }

          importedJobs.push(job);
        }

        if (importedJobs.length === 0) {
          alert("ไม่พบข้อมูลงาน Onsite Service ที่ถูกต้องในไฟล์ CSV");
          return;
        }

        if (!confirm(`คุณต้องการนำเข้าข้อมูลงาน Onsite Service จำนวน ${importedJobs.length} รายการใช่หรือไม่?`)) {
          return;
        }

        const path = 'onsite_services';
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
  const [showJobCardModal, setShowJobCardModal] = useState(false);
  const [activeJob, setActiveJob] = useState<OnsiteService | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'View' | 'content' | 'Icon' | 'List'>('View');

  // Customer Autocomplete states
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Dynamic service type inline add
  const [newCustomType, setNewCustomType] = useState('');
  const [showAddTypeField, setShowAddTypeField] = useState(false);

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
    fetchDbCustomers();
  }, []);

  // Form Field states
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [partnerCompany, setPartnerCompany] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [onsiteLocation, setOnsiteLocation] = useState('');
  const [techName, setTechName] = useState('');
  const [techName1, setTechName1] = useState('');
  const [techName2, setTechName2] = useState('');
  const [salesName, setSalesName] = useState('');
  const [assignedDate, setAssignedDate] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [fixedDate, setFixedDate] = useState('');
  
  const [symptomReport, setSymptomReport] = useState('');
  const [inspectionCause, setInspectionCause] = useState('');
  const [cause, setCause] = useState('');
  const [reportedEquipment, setReportedEquipment] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [reportFileUrl, setReportFileUrl] = useState('');
  const [reportFileName, setReportFileName] = useState('');
  const [solution, setSolution] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Pending' | 'In Progress' | 'Completed'>('Pending');
  
  // 4 photos with captions
  const [photos, setPhotos] = useState<PhotoItem[]>([
    { url: '', caption: '' },
    { url: '', caption: '' },
    { url: '', caption: '' },
    { url: '', caption: '' },
  ]);
  const [activePhotoSelectIndex, setActivePhotoSelectIndex] = useState<number | null>(null);

  // Apply search from props
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  // Fetch Jobs
  const fetchJobs = async () => {
    setLoading(true);
    const path = 'onsite_services';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched: OnsiteService[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as OnsiteService);
      });
      setJobs(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Set default lookup option on mount or change
  useEffect(() => {
    if (lookups.onsiteServiceTypes.length > 0 && !serviceType) {
      setServiceType(lookups.onsiteServiceTypes[0]);
    }
  }, [lookups, serviceType]);

  // Sync computed values
  // Sync computed values
  const workingDays = calculateDaysBetween(actionDate, fixedDate);
  const repairDuration = calculateDaysBetween(assignedDate, fixedDate || new Date().toISOString().split('T')[0]);

  // Open form for adding
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
    setServiceType(lookups.onsiteServiceTypes[0] || '');
    setOnsiteLocation('');
    setTechName('');
    setTechName1('');
    setTechName2('');
    setSalesName('');
    
    // Default dates to current date
    const todayStr = new Date().toISOString().split('T')[0];
    setAssignedDate(todayStr);
    setActionDate(todayStr);
    setFixedDate(todayStr);

    setSymptomReport('');
    setInspectionCause('');
    setCause('');
    setReportedEquipment('');
    setCloseDate('');
    setReportFileUrl('');
    setReportFileName('');
    setSolution('');
    setNotes('');
    setStatus('Pending');
    setPhotos([
      { url: '', caption: '' },
      { url: '', caption: '' },
      { url: '', caption: '' },
      { url: '', caption: '' },
    ]);
    setShowFormModal(true);
  };

  // Open form for editing
  const handleOpenEdit = (job: OnsiteService) => {
    setIsEditing(true);
    setActiveJob(job);
    setCompanyName(job.companyName);
    setCompanyAddress(job.companyAddress || '');
    setContactName(job.contactName || '');
    setContactDetails(job.contactDetails || '');
    setContactPhone(job.contactPhone || '');
    setContactEmail(job.contactEmail || '');
    setPartnerCompany(job.partnerCompany || '');
    setServiceType(job.serviceType);
    setOnsiteLocation(job.onsiteLocation || '');
    setTechName(job.techName || '');
    setTechName1(job.techName1 || '');
    setTechName2(job.techName2 || '');
    setSalesName(job.salesName || '');
    setAssignedDate(job.assignedDate || '');
    setActionDate(job.actionDate || '');
    setFixedDate(job.fixedDate || '');
    setSymptomReport(job.symptomReport || '');
    setInspectionCause(job.inspectionCause || '');
    setCause(job.cause || '');
    setReportedEquipment(job.reportedEquipment || '');
    setCloseDate(job.closeDate || '');
    setReportFileUrl(job.reportFileUrl || '');
    setReportFileName(job.reportFileName || '');
    setSolution(job.solution || '');
    setNotes(job.notes || '');
    setStatus(job.status || 'Pending');
    
    // Set photos, pad to 4 items
    const filledPhotos = [...job.photos];
    while (filledPhotos.length < 4) {
      filledPhotos.push({ url: '', caption: '' });
    }
    setPhotos(filledPhotos.slice(0, 4));
    
    setShowFormModal(true);
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    let finalCloseDate = fixedDate || new Date().toISOString().split('T')[0];

    const path = 'onsite_services';
    const combinedTech = [techName1, techName2].filter(Boolean).join(', ');
    
    const payload = {
      companyName,
      companyAddress,
      contactName,
      contactDetails,
      contactPhone,
      contactEmail,
      partnerCompany,
      serviceType,
      onsiteLocation,
      techName: combinedTech || techName,
      techName1,
      techName2,
      salesName,
      assignedDate,
      actionDate,
      fixedDate,
      workingDays,
      repairDuration,
      symptomReport,
      inspectionCause,
      cause,
      reportedEquipment,
      closeDate: finalCloseDate,
      reportFileUrl,
      reportFileName,
      solution,
      notes,
      status,
      photos: photos.filter(p => p.url.trim() !== ''),
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
        
        // Also auto-save to Customers list if not exists
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
      }
      setShowFormModal(false);
      fetchJobs();
    } catch (err) {
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณต้องการลบใบงานนี้ใช่หรือไม่?')) return;
    const path = 'onsite_services';
    try {
      await deleteDoc(doc(db, path, id));
      fetchJobs();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Open Printable Job Card
  const handleOpenJobCard = (job: OnsiteService) => {
    setActiveJob(job);
    setShowJobCardModal(true);
  };

  // Custom Service type management
  const handleAddCustomType = () => {
    const val = newCustomType.trim();
    if (val) {
      addLookupItem('onsiteServiceTypes', val);
      setServiceType(val);
      setNewCustomType('');
      setShowAddTypeField(false);
    }
  };

  const handleDeleteCustomType = (typeToDelete: string) => {
    if (window.confirm(`คุณแน่ใจว่าต้องการลบประเภทบริการ "${typeToDelete}" ใช่หรือไม่?`)) {
      deleteLookupItem('onsiteServiceTypes', typeToDelete);
      if (serviceType === typeToDelete) {
        setServiceType(lookups.onsiteServiceTypes[0] || '');
      }
    }
  };

  // Photos helpers
  const handleSelectPresetPhoto = (url: string) => {
    if (activePhotoSelectIndex !== null) {
      const updated = [...photos];
      updated[activePhotoSelectIndex].url = url;
      setPhotos(updated);
      setActivePhotoSelectIndex(null);
    }
  };

  const handleClearPhoto = (index: number) => {
    const updated = [...photos];
    updated[index].url = '';
    updated[index].caption = '';
    setPhotos(updated);
  };

  const handlePhotoCaptionChange = (index: number, val: string) => {
    const updated = [...photos];
    updated[index].caption = val;
    setPhotos(updated);
  };

  const handleManualPhotoUrl = (index: number, url: string) => {
    const updated = [...photos];
    updated[index].url = url;
    setPhotos(updated);
  };

  const handleExportExcel = (job: OnsiteService) => {
    const jobNum = getJobNumber(job);
    const rows = [
      ['WSS TECHNICAL SERVICE REPORT (รายงานปฏิบัติการบริการ)'],
      ['หมายเลขใบงาน (Job Number)', jobNum],
      [],
      ['[ส่วนที่ 1: ข้อมูลลูกค้า / Customer Information]'],
      ['ชื่อบริษัท (Company Name)', job.companyName],
      ['ที่อยู่ปฏิบัติงาน (Address)', job.companyAddress || ''],
      ['ผู้ติดต่อ (Contact Name)', job.contactName || ''],
      ['เบอร์โทรศัพท์ (Contact Phone)', job.contactPhone || ''],
      ['อีเมล (Contact Email)', job.contactEmail || ''],
      ['บริษัทคู่ค้า (Partner Company)', job.partnerCompany || ''],
      [],
      ['[ส่วนที่ 2: รายละเอียดงานบริการ / Service Details]'],
      ['ประเภทบริการ (Service Type)', job.serviceType],
      ['สถานที่ปฏิบัติงานจริง (Onsite Location)', job.onsiteLocation || ''],
      ['อุปกรณ์ที่รับแจ้ง (Reported Equipment)', job.reportedEquipment || ''],
      ['ช่างปฏิบัติงานหลัก (Technician 1)', job.techName1 || ''],
      ['ช่างปฏิบัติงานรอง (Technician 2)', job.techName2 || ''],
      ['พนักงานขาย (Salesperson)', job.salesName || ''],
      ['วันที่รับแจ้ง (Assigned Date)', job.assignedDate],
      ['วันที่เข้าปฏิบัติงาน (Action Date)', job.actionDate],
      ['วันที่ทำงานเสร็จสิ้น (Fixed Date)', job.fixedDate],
      ['วันที่ปิดงาน (Close Date)', job.closeDate || ''],
      ['จำนวนวันทำงาน (Working Days)', job.workingDays],
      ['ระยะเวลาแก้ไขปัญหา (Repair Duration)', job.repairDuration],
      [],
      ['[ส่วนที่ 3: สรุปผลการตรวจสอบและแก้ไข / Service Summary]'],
      ['อาการรับแจ้ง (Symptom Reported)', job.symptomReport || ''],
      ['ขั้นตอนการตรวจสอบ (Inspection)', job.inspectionCause || ''],
      ['สาเหตุของปัญหา (Root Cause)', job.cause || ''],
      ['วิธีการแก้ไข (Solution)', job.solution || ''],
      ['หมายเหตุ (Notes)', job.notes || ''],
      [],
      ['[ส่วนที่ 4: ลายมือชื่ออ้างอิง / Signature Proofs]'],
      ['ลงลายมือชื่อผู้ตรวจสอบ (Inspector Signature)', 'ลงชื่อตัวบรรจง (............................................................)'],
      ['ลงลายมือชื่อลูกค้า (Customer Signature)', 'ลงชื่อตัวบรรจง (............................................................)']
    ];
    
    const csvContent = "\ufeff" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${jobNum}_Service_Report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filters
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
      
      {/* Action / Search Bar */}
      <div className="space-y-4 bg-white border border-slate-200 shadow-sm p-4 rounded-2xl">
        {/* Tier 1: Search and Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อบริษัท, ชื่อผู้ติดต่อ, ช่างเทคนิค..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter tabs */}
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 flex-wrap">
              {['All', 'Pending', 'In Progress', 'Completed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
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
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 my-1" />

        {/* Tier 2: Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
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
              <span>ส่งออก Excel (.csv)</span>
            </button>

            <button
              onClick={() => setShowPrintReportModal(true)}
              title="พิมพ์รายงานรวม PDF"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>พิมพ์รายงานรวม (PDF)</span>
            </button>

            {selectedJobIds.length > 0 && (
              <button
                onClick={() => setShowCombinedPrintModal(true)}
                title="พิมพ์รวมใบงานที่เลือกเป็น PDF เดียวกัน"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md shadow-indigo-500/10"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์รวม ({selectedJobIds.length} ใบงาน)</span>
              </button>
            )}
          </div>

          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มงาน Onsite Service</span>
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
            กำลังโหลดข้อมูลงาน Onsite Service...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            ไม่มีข้อมูลงาน Onsite Service ที่ตรงเงื่อนไข
          </div>
        ) : (
          <div className="p-1">
            {/* View Mode: View (Detailed Grid Table) */}
            {viewMode === 'View' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-250 text-[11px] font-bold text-slate-600 tracking-wider uppercase">
                      <th className="px-4 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredJobs.length > 0 && selectedJobIds.length === filteredJobs.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4">ลูกค้า / ผู้ติดต่อ</th>
                      <th className="px-6 py-4">ประเภทบริการ</th>
                      <th className="px-6 py-4">สถานที่ปฏิบัติงาน</th>
                      <th className="px-6 py-4">ผู้รับผิดชอบ / เซลส์</th>
                      <th className="px-6 py-4">วันที่รับแจ้ง / ปฏิบัติการ</th>
                      <th className="px-6 py-4">ระยะเวลาดำเนินการ</th>
                      <th className="px-6 py-4">สถานะ</th>
                      <th className="px-6 py-4 text-center">เอกสาร</th>
                      <th className="px-6 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredJobs.map((job) => {
                      const isOver = isJobOverdue(job.assignedDate, job.status, job.fixedDate);
                      const isChecked = selectedJobIds.includes(job.id || '');
                      return (
                        <tr 
                          key={job.id} 
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isOver ? 'bg-rose-50/20 hover:bg-rose-50/40' : ''
                          } ${isChecked ? 'bg-blue-50/20 hover:bg-blue-50/35' : ''}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleSelectJob(job.id || '', e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{job.companyName}</span>
                              {isOver && (
                                <span className="bg-rose-50 text-rose-700 border border-rose-150 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  เกิน 30 วัน (Overdue)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">ติดต่อ: {job.contactName} ({job.contactPhone})</p>
                            {job.partnerCompany && <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded border border-slate-200 mt-1">พาร์ทเนอร์: {job.partnerCompany}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium text-[11px] text-blue-700">
                              {job.serviceType}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-[150px] truncate text-slate-600" title={job.onsiteLocation}>
                            {job.onsiteLocation}
                          </td>
                          <td className="px-6 py-4 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>ช่าง: <strong className="text-slate-900">{job.techName || '-'}</strong></span>
                            </div>
                            <p className="text-[11px] text-slate-500">เซลส์: {job.salesName || '-'}</p>
                          </td>
                          <td className="px-6 py-4 space-y-0.5 text-slate-500">
                            <p className="text-[11px]">รับแจ้ง: <strong className="text-slate-800">{job.assignedDate}</strong></p>
                            <p className="text-[11px]">เข้างาน: <strong className="text-slate-800">{job.actionDate}</strong></p>
                          </td>
                          <td className="px-6 py-4 space-y-0.5 text-slate-500">
                            <p className="text-[11px]">ระยะซ่อม: <strong className="text-slate-800 font-mono">{job.repairDuration} วัน</strong></p>
                            <p className="text-[11px] font-mono">ปฏิบัติงาน: <strong className="text-slate-800">{job.workingDays} วัน</strong></p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              job.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : job.status === 'In Progress'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              id={`jobcard-btn-${job.id}`}
                              onClick={() => handleOpenJobCard(job)}
                              className="p-2 bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white rounded-lg border border-slate-200 hover:border-blue-500 transition-all"
                              title="เปิดใบงาน Job Service"
                            >
                              <FileText className="w-4.5 h-4.5" />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              id={`edit-onsite-btn-${job.id}`}
                              onClick={() => handleOpenEdit(job)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-150 text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-onsite-btn-${job.id}`}
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

            {/* View Mode: content (Content focused view showing Symptoms and Solutions) */}
            {viewMode === 'content' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-250 text-[11px] font-bold text-slate-600 tracking-wider uppercase">
                      <th className="px-4 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredJobs.length > 0 && selectedJobIds.length === filteredJobs.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4">ลูกค้า / ผู้ติดต่อ</th>
                      <th className="px-6 py-4">รายละเอียดปัญหา & วิธีแก้ไข (Content)</th>
                      <th className="px-6 py-4 text-center">เอกสาร</th>
                      <th className="px-6 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredJobs.map((job) => {
                      const isChecked = selectedJobIds.includes(job.id || '');
                      return (
                        <tr key={job.id} className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-blue-50/20 hover:bg-blue-50/35' : ''}`}>
                          <td className="px-4 py-4 text-center align-top">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleSelectJob(job.id || '', e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer mt-1"
                            />
                          </td>
                          <td className="px-6 py-4 space-y-1 align-top w-1/4">
                          <p className="font-bold text-slate-900 text-sm">{job.companyName}</p>
                          <span className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[10px] text-blue-700 font-semibold block w-fit">
                            {job.serviceType}
                          </span>
                        </td>
                        <td className="px-6 py-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1">อาการรับแจ้ง (Symptom Reported)</span>
                              <p className="text-slate-700 leading-relaxed text-xs">{job.symptomReport || '-'}</p>
                            </div>
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">วิธีการแก้ไข (Solution)</span>
                              <p className="text-slate-700 leading-relaxed text-xs">{job.solution || '-'}</p>
                            </div>
                          </div>
                          <div className="flex gap-4 text-[10px] text-slate-500">
                            <span>ช่างผู้ปฏิบัติงาน: <strong className="text-slate-700">{job.techName1 || '-'}</strong></span>
                            <span>วันที่เข้าแก้ไข: <strong className="text-slate-700">{job.actionDate}</strong></span>
                            <span>วันที่ทำงานเสร็จสิ้น: <strong className="text-slate-700">{job.fixedDate || '-'}</strong></span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center align-top">
                          <button
                            onClick={() => handleOpenJobCard(job)}
                            className="p-2 bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white rounded-lg border border-slate-200 hover:border-blue-500 transition-all"
                            title="เปิดใบงาน Job Service"
                          >
                            <FileText className="w-4.5 h-4.5" />
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right align-top space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(job)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-150 text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
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
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* View Mode: Icon (Grid of modern cards) */}
            {viewMode === 'Icon' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                {filteredJobs.map((job) => {
                  const isOver = isJobOverdue(job.assignedDate, job.status, job.fixedDate);
                  return (
                    <div 
                      key={job.id} 
                      className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between relative ${
                        isOver ? 'border-rose-200 bg-rose-50/5' : 'border-slate-200'
                      } ${selectedJobIds.includes(job.id || '') ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.includes(job.id || '')}
                              onChange={(e) => handleSelectJob(job.id || '', e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">
                              {getJobNumber(job)}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 text-base line-clamp-1">{job.companyName}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            <span>ผู้ติดต่อ: {job.contactName || '-'}</span>
                          </p>
                          {job.onsiteLocation && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              📍 {job.onsiteLocation}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block">อาการรับแจ้ง</span>
                          <p className="text-xs text-slate-700 line-clamp-2">{job.symptomReport || '-'}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">วันที่เข้า: {job.actionDate}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleOpenJobCard(job)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg border border-blue-100 transition-colors"
                            title="ใบงานรายงาน"
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

            {/* View Mode: List (Minimalist high density view) */}
            {viewMode === 'List' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <th className="px-3 py-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredJobs.length > 0 && selectedJobIds.length === filteredJobs.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-2.5">อ้างอิง</th>
                      <th className="px-4 py-2.5">ลูกค้า</th>
                      <th className="px-4 py-2.5">ประเภทบริการ</th>
                      <th className="px-4 py-2.5">ช่าง</th>
                      <th className="px-4 py-2.5">วันที่เข้า</th>
                      <th className="px-4 py-2.5">สถานะ</th>
                      <th className="px-4 py-2.5 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredJobs.map((job) => {
                      const isChecked = selectedJobIds.includes(job.id || '');
                      return (
                        <tr key={job.id} className={`hover:bg-slate-50/55 transition-colors ${isChecked ? 'bg-blue-50/20' : ''}`}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleSelectJob(job.id || '', e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2 font-mono text-[10px] text-blue-600 font-bold">{getJobNumber(job)}</td>
                          <td className="px-4 py-2 font-bold text-slate-900">{job.companyName}</td>
                          <td className="px-4 py-2 text-slate-600">{job.serviceType}</td>
                          <td className="px-4 py-2 text-slate-600">{job.techName1 || '-'}</td>
                          <td className="px-4 py-2 text-slate-500 font-mono text-[11px]">{job.actionDate}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                              job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {job.status === 'Completed' ? 'เสร็จงาน' : job.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenJobCard(job)}
                              className="text-blue-600 hover:text-blue-900 text-[11px] font-bold"
                            >
                              ใบงาน
                            </button>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =======================================
          ADD/EDIT FORM MODAL
          ======================================= */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-xl space-y-6 text-slate-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-blue-900/40 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5.5 h-5.5 text-blue-400" />
                {isEditing ? 'แก้ไขใบงาน Onsite Service' : 'สร้างใบงาน Onsite Service'}
              </h2>
              <button
                id="close-form-modal"
                onClick={() => setShowFormModal(false)}
                className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-blue-900/30 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              
              {/* SECTION 1: Customer Details */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">1. ข้อมูลลูกค้า & ช่องทางติดต่อ</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-semibold text-slate-600">ชื่อบริษัท *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => {
                          setCompanyName(e.target.value);
                          setShowCustomerSuggestions(true);
                        }}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        placeholder="ค้นหาหรือกรอกชื่อบริษัท เช่น บริษัท แอดวานซ์..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                      {companyName && (
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyName('');
                            setShowCustomerSuggestions(false);
                          }}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

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
                      placeholder="เช่น บจก. เน็ตเวิร์คพาร์ทเนอร์"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ที่อยู่บริษัทลูกค้า</label>
                    <textarea
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="เลขที่ 123/45 ถนนวิภาวดีรังสิต แขวงดินแดง เขตดินแดง กรุงเทพฯ"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-16 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ชื่อผู้ติดต่อ</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="คุณสมชาย ใจดี"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">รายละเอียดผู้ติดต่ออื่นๆ (ถ้ามี)</label>
                    <input
                      type="text"
                      value={contactDetails}
                      onChange={(e) => setContactDetails(e.target.value)}
                      placeholder="เช่น แผนกไอที ชั้น 4 ประตูเปิด 09:00 น."
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
                      placeholder="081-234-5678"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">อีเมลติดต่อ</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="somchai@company.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Service Configurations */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">2. รายละเอียดบริการ & กำหนดเวลา</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  {/* Service Type with Inline Edit */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 flex justify-between items-center">
                      <span>ประเภทบริการ *</span>
                      <button
                        type="button"
                        onClick={() => setShowAddTypeField(!showAddTypeField)}
                        className="text-blue-600 hover:text-blue-500 text-[10px] font-bold underline"
                      >
                        {showAddTypeField ? 'ซ่อนการเพิ่ม' : '+ เพิ่ม/ลบประเภท'}
                      </button>
                    </label>

                    {showAddTypeField ? (
                      <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCustomType}
                            onChange={(e) => setNewCustomType(e.target.value)}
                            placeholder="พิมพ์ประเภทบริการใหม่..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomType}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            เพิ่ม
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pt-2">
                          {lookups.onsiteServiceTypes.map((type) => (
                            <span key={type} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] px-2 py-1 rounded-md border border-slate-200">
                              {type}
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomType(type)}
                                className="text-rose-500 hover:text-rose-700 font-bold"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <select
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                      >
                        {lookups.onsiteServiceTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">สถานที่ปฏิบัติงานจริง</label>
                    <input
                      type="text"
                      value={onsiteLocation}
                      onChange={(e) => setOnsiteLocation(e.target.value)}
                      placeholder="เช่น สาขาพระราม 9 ชั้น 2"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Dual technician select dropdowns */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-slate-600">ช่างปฏิบัติงานคนที่ 1 *</label>
                    <select
                      required
                      value={techName1}
                      onChange={(e) => setTechName1(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- เลือกช่างหลัก --</option>
                      {(lookups.technicians || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-slate-600">ช่างปฏิบัติงานคนที่ 2</label>
                    <select
                      value={techName2}
                      onChange={(e) => setTechName2(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- ไม่มี (ช่างคนเดียว) --</option>
                      {(lookups.technicians || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Inline technicians list management */}
                  <div className="md:col-span-3 bg-slate-100/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จัดการรายชื่อช่างเทคนิคในระบบ</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="new-tech-onsite-input"
                        placeholder="เพิ่มช่างเทคนิคใหม่..."
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const inputEl = document.getElementById('new-tech-onsite-input') as HTMLInputElement;
                          const val = inputEl?.value.trim();
                          if (val) {
                            await addLookupItem('technicians', val);
                            inputEl.value = '';
                            if (!techName1) setTechName1(val);
                            else if (!techName2) setTechName2(val);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                      >
                        เพิ่มช่าง
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(lookups.technicians || []).map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 bg-white border border-slate-250 text-slate-700 text-[10px] px-2 py-0.5 rounded-md shadow-3xs">
                          {name}
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`ลบช่าง "${name}" ออกจากรายชื่อสำเร็จรูป?`)) {
                                if (techName1 === name) setTechName1('');
                                if (techName2 === name) setTechName2('');
                                await deleteLookupItem('technicians', name);
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Salesperson select dropdown */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-slate-600">พนักงานขาย (เซลส์)</label>
                    <select
                      value={salesName}
                      onChange={(e) => setSalesName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- เลือกพนักงานขาย --</option>
                      {(lookups.salespersons || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Inline salesperson list management */}
                  <div className="md:col-span-3 bg-slate-100/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จัดการรายชื่อพนักงานขายในระบบ</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="new-sales-onsite-input"
                        placeholder="เพิ่มพนักงานขายใหม่..."
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const inputEl = document.getElementById('new-sales-onsite-input') as HTMLInputElement;
                          const val = inputEl?.value.trim();
                          if (val) {
                            await addLookupItem('salespersons', val);
                            inputEl.value = '';
                            setSalesName(val);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                      >
                        เพิ่มเซลส์
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(lookups.salespersons || []).map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 bg-white border border-slate-250 text-slate-700 text-[10px] px-2 py-0.5 rounded-md shadow-3xs">
                          {name}
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`ลบพนักงานขาย "${name}" ออกจากรายชื่อสำเร็จรูป?`)) {
                                if (salesName === name) setSalesName('');
                                await deleteLookupItem('salespersons', name);
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reported equipment select dropdown */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-slate-600">อุปกรณ์ที่รับแจ้ง</label>
                    <select
                      value={reportedEquipment}
                      onChange={(e) => setReportedEquipment(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- เลือกอุปกรณ์ที่ได้รับแจ้ง --</option>
                      {(lookups.equipmentList || []).map((eq) => (
                        <option key={eq} value={eq}>{eq}</option>
                      ))}
                    </select>
                  </div>

                  {/* Inline equipment list management */}
                  <div className="md:col-span-3 bg-slate-100/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จัดการรายการประเภทอุปกรณ์ที่รับแจ้ง</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="new-eq-onsite-input"
                        placeholder="เพิ่มอุปกรณ์ใหม่ (เช่น DVR, Camera, Switch)..."
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const inputEl = document.getElementById('new-eq-onsite-input') as HTMLInputElement;
                          const val = inputEl?.value.trim();
                          if (val) {
                            await addLookupItem('equipmentList', val);
                            inputEl.value = '';
                            setReportedEquipment(val);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                      >
                        เพิ่มอุปกรณ์
                      </button>
                    </div>
                    {/* List of equipment badges under the text box */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(lookups.equipmentList || []).map((eq) => (
                        <span key={eq} className="inline-flex items-center gap-1 bg-white border border-slate-250 text-slate-700 text-[10px] px-2 py-0.5 rounded-md shadow-3xs">
                          {eq}
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`ลบอุปกรณ์ "${eq}" ออกจากรายชื่อสำเร็จรูป?`)) {
                                if (reportedEquipment === eq) setReportedEquipment('');
                                await deleteLookupItem('equipmentList', eq);
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 2 Date parameters */}
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
                      วันที่เข้าปฏิบัติงาน *
                    </label>
                    <input
                      type="date"
                      required
                      value={actionDate}
                      onChange={(e) => setActionDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      วันที่ทำงานเสร็จสิ้น *
                    </label>
                    <input
                      type="date"
                      required
                      value={fixedDate}
                      onChange={(e) => setFixedDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Read-only calculations */}
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between col-span-1 md:col-span-3">
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">สรุปวันทำงาน (Action &rarr; End)</p>
                      <p className="text-xl font-mono font-bold text-slate-900">{workingDays} วัน</p>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-200" />
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">ระยะเวลาแก้ไขปัญหา (Assigned &rarr; End)</p>
                      <p className="text-xl font-mono font-bold text-slate-900">{repairDuration} วัน</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left md:col-span-3">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      แนบไฟล์รายงานการปฏิบัติหน้าที่ (ทางเลือก)
                    </label>
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col sm:flex-row justify-between items-center gap-2">
                      {reportFileName ? (
                        <div className="flex items-center gap-2">
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-1 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800 truncate max-w-[160px]">{reportFileName}</p>
                            <p className="text-[9px] text-slate-400">สถานะ: แนบไฟล์เสร็จสิ้น</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">ยังไม่ได้แนบไฟล์รายงาน (.pdf)</p>
                      )}
                      <div className="flex gap-1.5 shrink-0">
                        {reportFileName && (
                          <button
                            type="button"
                            onClick={() => {
                              setReportFileName('');
                              setReportFileUrl('');
                            }}
                            className="bg-slate-50 text-rose-600 border border-slate-200 hover:bg-rose-50 px-2 py-1 rounded-lg text-[10px] font-bold"
                          >
                            ลบ
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const num = Math.floor(100 + Math.random() * 900);
                            setReportFileName(`WSS_Service_Report_Job_${num}.pdf`);
                            setReportFileUrl(`https://storage.googleapis.com/wss-service-reports/WSS_Service_Report_Job_${num}.pdf`);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          {reportFileName ? 'เปลี่ยนไฟล์' : 'จำลองแนบไฟล์'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Textarea Reports */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">3. รายละเอียดการตรวจสอบ & ผลสรุป</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">อาการรับแจ้งอาการ</label>
                    <textarea
                      value={symptomReport}
                      onChange={(e) => setSymptomReport(e.target.value)}
                      placeholder="บรรยายอาการรับแจ้ง เช่น กล้องวงจรปิดดับไป 3 ตัว ไม่มีสัญญาณภาพขึ้นหน้าจอหลัก..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">การตรวจสอบ</label>
                    <textarea
                      value={inspectionCause}
                      onChange={(e) => setInspectionCause(e.target.value)}
                      placeholder="บรรยายขั้นตอนการตรวจสอบ เช่น ตรวจเช็คสายสัญญาณและวัดแรงดันไฟฟ้าขาเข้า..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">สาเหตุ</label>
                    <textarea
                      value={cause}
                      onChange={(e) => setCause(e.target.value)}
                      placeholder="ระบุสาเหตุปัญหา เช่น อุปกรณ์ชำรุดเสียหายจากไฟฟ้าลัดวงจร หรือความชื้นสะสม..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">วิธีการแก้ไขปัญหา</label>
                    <textarea
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      placeholder="บรรยายการแก้ไข เช่น ทำการเปลี่ยนอะแดปเตอร์ 12V 2A ตัวใหม่ และทำการตั้งค่ากล้องขึ้นจอภาพเรียบร้อย..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">หมายเหตุอื่นๆ</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="รายละเอียดเพิ่มเติมหรือข้อควรระวัง..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-left">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">สถานะการดำเนินงาน</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pending">Pending (รอดำเนินการ)</option>
                      <option value="In Progress">In Progress (กำลังดำเนินการ)</option>
                      <option value="Completed">Completed (เสร็จงาน)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Photos Attachments (Up to 4) */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span>4. แนบรูปถ่ายการปฏิบัติงาน (สูงสุด 4 รูป)</span>
                    <span className="text-[11px] text-slate-500 capitalize">แนบรูปประกอบใบงาน Job Service</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">คลิกเลือกช่องถ่ายภาพ เพื่อใส่ที่อยู่ลิงก์รูป หรือเลือกใช้รูปภาพสำเร็จรูปจากสต็อกเทคโนโลยีเพื่อความสะดวกในการสาธิต!</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col space-y-2.5 p-3 relative group text-left">
                      
                      {/* Photo slot */}
                      <div className="aspect-video bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group-hover:border-blue-500 transition-colors">
                        {photo.url ? (
                          <>
                            <img
                              src={photo.url}
                              alt={`Job site sample ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleClearPhoto(index)}
                              className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full shadow-lg"
                              title="ลบรูปภาพ"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActivePhotoSelectIndex(index)}
                            className="flex flex-col items-center space-y-1.5 text-slate-500 hover:text-slate-800"
                          >
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-[10px] font-semibold">เลือก/แนบรูปถ่าย</span>
                          </button>
                        )}
                      </div>

                      {/* Manual URL entry if needed */}
                      {!photo.url && (
                        <input
                          type="text"
                          placeholder="วางลิงก์รูปภาพ (URL)..."
                          onChange={(e) => handleManualPhotoUrl(index, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-700 focus:outline-none focus:border-blue-500"
                        />
                      )}

                      {/* Photo description/caption */}
                      <input
                        type="text"
                        placeholder="คำบรรยายใต้ภาพ..."
                        value={photo.caption}
                        onChange={(e) => handlePhotoCaptionChange(index, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
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
          PRESET PHOTO SELECTOR DIALOG
          ======================================= */}
      {activePhotoSelectIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                คลังรูปภาพสาธิตเทคโนโลยี (Preset Stock Photos)
              </h3>
              <button
                onClick={() => setActivePhotoSelectIndex(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 text-left">คลิกเลือกรูปภาพที่คุณต้องการใช้เป็นรูปแนบในการปฏิบัติงาน:</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto p-1">
              {techPresetImages.map((pImg) => (
                <div
                  key={pImg.name}
                  onClick={() => handleSelectPresetPhoto(pImg.url)}
                  className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-sm transition-all group"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={pImg.url}
                      alt={pImg.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 p-2 text-center truncate font-medium">
                    {pImg.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =======================================
          PRINTABLE JOB CARD WORK ORDER DOCUMENT
          ======================================= */}
      {/* =======================================
          PRINTABLE SUMMARY REPORT DOCUMENT (PDF)
          ======================================= */}
      {showPrintReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-5xl p-8 max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6 flex flex-col">
            
            {/* Window action buttons (sticky top) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                รายงานสรุปงาน Onsite Service ทั้งหมด ({filteredJobs.length} รายการ)
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
                  <p className="text-xs text-slate-500 font-medium">รายงานสรุปผลการดำเนินงานบริการ Onsite Service รายคาบ</p>
                </div>
                <div className="text-left md:text-right space-y-0.5">
                  <h2 className="text-xl font-black text-blue-800">รายงาน Onsite Service Report</h2>
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
                      <th className="border border-slate-300 p-2">ประเภทบริการ</th>
                      <th className="border border-slate-300 p-2">ช่างเทคนิค</th>
                      <th className="border border-slate-300 p-2">วันที่แจ้ง</th>
                      <th className="border border-slate-300 p-2">วันที่ปฏิบัติงาน</th>
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
                          <p className="text-[10px] text-slate-500">{job.onsiteLocation}</p>
                        </td>
                        <td className="border border-slate-300 p-2 font-semibold text-blue-800">{job.serviceType}</td>
                        <td className="border border-slate-300 p-2 font-medium">{job.techName || '-'}</td>
                        <td className="border border-slate-300 p-2 whitespace-nowrap">{job.assignedDate}</td>
                        <td className="border border-slate-300 p-2 whitespace-nowrap">{job.actionDate}</td>
                        <td className="border border-slate-300 p-2 max-w-[200px] whitespace-normal">
                          <p className="font-semibold text-rose-800">อาการ: {job.symptomReport || '-'}</p>
                          <p className="text-emerald-800 mt-1">วิธีแก้: {job.solution || '-'}</p>
                        </td>
                        <td className="border border-slate-300 p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            job.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {job.status === 'Completed' ? 'เสร็จสิ้น' : job.status === 'In Progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
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

      {showJobCardModal && activeJob && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-4xl p-8 max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6 flex flex-col">
            
            <style>{`
              @media print {
                body {
                  color: #000 !important;
                  background: #fff !important;
                }
                body * {
                  visibility: hidden;
                }
                #print-area, #print-area * {
                  visibility: visible;
                }
                #print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  margin: 0;
                  padding: 0;
                }
                .print\\:break-before-page {
                  page-break-before: always !important;
                  break-before: page !important;
                  margin-top: 0 !important;
                  padding-top: 2rem !important;
                }
              }
            `}</style>

            {/* Window action buttons (sticky top) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 shrink-0">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full border border-blue-200 w-fit">
                ใบงานหมายเลขอ้างอิง: {getJobNumber(activeJob)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleExportExcel(activeJob)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  ดาวน์โหลดรายงาน Excel
                </button>
                <button
                  onClick={() => { window.focus(); window.print(); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-500/10"
                >
                  <Printer className="w-4 h-4" />
                  สั่งพิมพ์ / PDF
                </button>
                <button
                  onClick={() => setShowJobCardModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-4 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Instruction notice (Visible only on screen, hidden on print) */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-3 print:hidden shrink-0 text-left">
              <span className="text-lg">💡</span>
              <div className="space-y-1">
                <p className="font-bold">แนะนำการส่งออก PDF / สั่งพิมพ์:</p>
                <p>หากสั่งพิมพ์ในหน้าต่าง Preview นี้แล้วไม่ตอบสนอง หรือหน้า PDF จัดเรียงไม่สมบูรณ์ กรุณากดปุ่ม <strong>"เปิดในแท็บใหม่"</strong> (ปุ่มลูกศรชี้ขึ้นที่มุมขวาบนสุดของหน้าจอ) เพื่อสั่งพิมพ์ใหม่อีกครั้ง ระบบจะส่งออกไฟล์ PDF ได้อย่างปกติและสมบูรณ์</p>
              </div>
            </div>

            {/* Printable Document Core */}
            <div id="print-area" className="flex-1 pr-2 overflow-y-auto">
              <PrintableJobCard job={activeJob} user={user} getJobNumber={getJobNumber} />
            </div>

          </div>
        </div>
      )}

      {/* =======================================
          COMBINED PRINT MODAL (MULTIPLE SELECTED JOBS)
          ======================================= */}
      {showCombinedPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto print:p-0 print:bg-transparent">
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl w-full max-w-5xl h-full sm:h-[90vh] flex flex-col overflow-hidden border border-slate-100 print:border-0 print:shadow-none print:rounded-none print:h-auto print:w-auto">
            
            {/* Inline CSS overrides to handle print rules cleanly */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body {
                  color: #000 !important;
                  background: #fff !important;
                }
                body * {
                  visibility: hidden;
                }
                #print-area, #print-area * {
                  visibility: visible;
                }
                #print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  margin: 0;
                  padding: 0;
                }
                .print\\:break-before-page {
                  page-break-before: always !important;
                  break-before: page !important;
                  margin-top: 0 !important;
                  padding-top: 2rem !important;
                }
              }
            ` }} />

            {/* Window action buttons (sticky top) - Hidden during print */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 p-5 shrink-0 bg-slate-50 print:hidden">
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-slate-900">พิมพ์รวมใบงาน PDF ({selectedJobIds.length} รายการ)</h3>
                <p className="text-xs text-slate-500">ใบงานที่เลือกจะถูกจัดเรียงเป็นแผ่นเดียวกันเพื่อการบันทึก PDF หรือพิมพ์พร้อมกัน</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { window.focus(); window.print(); }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-500/10"
                >
                  <Printer className="w-4 h-4" />
                  สั่งพิมพ์ / บันทึกเป็น PDF
                </button>
                <button
                  onClick={() => setShowCombinedPrintModal(false)}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Instruction notice (Visible only on screen, hidden on print) */}
            <div className="mx-5 my-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-3 print:hidden shrink-0 text-left">
              <span className="text-lg">💡</span>
              <div className="space-y-1">
                <p className="font-bold">แนะนำการส่งออก PDF / สั่งพิมพ์รวม:</p>
                <p>หากสั่งพิมพ์ในหน้าต่าง Preview นี้แล้วไม่ตอบสนอง หรือหน้า PDF จัดเรียงไม่สมบูรณ์ กรุณากดปุ่ม <strong>"เปิดในแท็บใหม่"</strong> (ปุ่มลูกศรชี้ขึ้นที่มุมขวาบนสุดของหน้าจอ) เพื่อสั่งพิมพ์ใหม่อีกครั้ง ระบบจะจัดหน้ากระดาษและรวมเล่มเอกสารได้อย่างสมบูรณ์</p>
              </div>
            </div>

            {/* Printable Area / Scrollable Preview Container */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 print:p-0 bg-slate-100 print:bg-white">
              <div 
                id="print-area" 
                className="mx-auto w-full max-w-[210mm] bg-white border border-slate-200 p-[15mm] sm:p-[20mm] rounded-2xl shadow-sm print:shadow-none print:border-0 print:p-0 print:max-w-none space-y-16"
              >
                {jobs
                  .filter(job => job.id && selectedJobIds.includes(job.id))
                  .map((job, idx) => {
                    const isNotFirst = idx > 0;
                    return (
                      <div 
                        key={job.id} 
                        className={`${isNotFirst ? 'print:break-before-page border-t-2 border-dashed border-slate-300 pt-16 print:pt-0 print:border-0' : ''}`}
                      >
                        <PrintableJobCard job={job} user={user} getJobNumber={getJobNumber} />
                      </div>
                    );
                  })}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// =======================================
// PRINTABLE JOB CARD SUB-COMPONENT
// =======================================
interface PrintableJobCardProps {
  job: OnsiteService;
  user: any;
  getJobNumber: (job: OnsiteService) => string;
}

const PrintableJobCard: React.FC<PrintableJobCardProps> = ({ job, user, getJobNumber }) => {
  return (
    <div className="space-y-6 font-sans">
      {/* Document Header */}
      <div className="border-b-4 border-slate-800 pb-5 flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-1.5 text-left">
          <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight flex items-center gap-2">
            ใบงานปฏิบัติการบริการ (Job Service)
          </h1>
          <p className="text-sm text-slate-700 font-bold uppercase">ฝ่ายสนับสนุนด้านเทคนิคและซ่อมบำรุงเครือข่าย WSS</p>
          <p className="text-xs text-slate-600 font-semibold">Email : wssservice.wins@gmail.com เบอร์โทรติดต่อ 085 502 9624</p>
        </div>
        <div className="text-left md:text-right space-y-0.5">
          <p className="text-xs text-slate-500">หมายเลขอ้างอิง: <strong className="text-blue-700">{getJobNumber(job)}</strong></p>
          <p className="text-xs text-slate-500">สถานะ: <strong>{job.status === 'Completed' ? 'ดำเนินการเสร็จสมบูรณ์' : job.status === 'In Progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}</strong></p>
          <p className="text-xs text-slate-500">วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')}</p>
        </div>
      </div>

      {/* Informational Grid 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 pb-5 text-left">
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">ข้อมูลผู้ว่าจ้าง / ลูกค้า</h3>
          <div className="space-y-1 text-sm text-slate-800">
            <p className="font-bold text-slate-900 text-base">{job.companyName}</p>
            <p className="text-xs leading-relaxed">{job.companyAddress || 'ไม่มีข้อมูลที่อยู่'}</p>
            <p className="text-xs pt-1">ผู้ติดต่อ: <strong>{job.contactName || '-'}</strong> | เบอร์โทร: <strong>{job.contactPhone || '-'}</strong></p>
            <p className="text-xs">อีเมล: {job.contactEmail || '-'}</p>
            {(!job.salesName || !job.salesName.includes('ภัทราภรณ์')) && (
              <p className="text-xs text-slate-700 font-medium">พนักงานขายดูแลลูกค้า: <strong className="text-emerald-700 font-bold">{job.salesName || '-'}</strong></p>
            )}
            {job.partnerCompany && <p className="text-xs text-blue-700">บริษัทคู่ค้าดูแลร่วม: {job.partnerCompany}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">รายละเอียดงานบริการ</h3>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-slate-800">
            <div>ประเภทบริการ: <strong className="text-slate-900 text-sm block">{job.serviceType}</strong></div>
            <div>สถานที่หน้างาน: <strong className="text-slate-900 block">{job.onsiteLocation || '-'}</strong></div>
            <div>อุปกรณ์ที่รับแจ้ง: <strong className="text-slate-900 text-sm block text-blue-800">{job.reportedEquipment || '-'}</strong></div>
            <div>ช่างผู้ปฏิบัติงาน: 
              <strong className="text-slate-900 text-xs block">
                {[job.techName1, job.techName2].filter(Boolean).join(', ') || job.techName || '-'}
              </strong>
            </div>
            
            <div className="col-span-2 grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 text-center">
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">วันที่รับแจ้ง</span>
                <span className="font-bold text-slate-800">{job.assignedDate || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">วันที่เข้างาน</span>
                <span className="font-bold text-slate-800">{job.actionDate || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">วันที่ทำงานสำเร็จ</span>
                <span className="font-bold text-slate-800">{job.fixedDate || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Informational Grid 2: Logs and description */}
      <div className="space-y-4 border-b border-slate-200 pb-6 text-left">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">อาการรับแจ้งอาการ (Symptom Reported)</h4>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{job.symptomReport || 'ไม่มีข้อมูลอาการแจ้งซ่อม'}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">ขั้นตอนการตรวจสอบ (Inspection Details)</h4>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{job.inspectionCause || 'ไม่มีข้อมูลการตรวจสอบ'}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">สาเหตุข้อบกพร่อง (Root Cause)</h4>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{job.cause || 'ไม่มีข้อมูลระบุสาเหตุ'}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">วิธีการแก้ไขและปรับปรุงการทำงาน (Action Resolved)</h4>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{job.solution || 'ไม่มีข้อมูลวิธีการแก้ไข'}</p>
          </div>

          <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">หมายเหตุและคำแนะนำเพิ่มเติม (Additional Notes)</h4>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{job.notes || '-'}</p>
          </div>
        </div>
      </div>

      {/* Inspector & Customer Signature Blocks */}
      <div className="pt-6 grid grid-cols-2 gap-12 text-center text-xs pb-4 border-b border-slate-100">
        <div className="space-y-12">
          <p className="text-slate-500 font-bold uppercase tracking-wider">ลงลายมือชื่อผู้ตรวจสอบ (Inspector's Signature)</p>
          <div className="border-b border-slate-300 w-56 mx-auto" />
          <p className="text-slate-800 font-medium text-xs">ลงชื่อตัวบรรจง (............................................................)</p>
          <p className="text-[10px] text-slate-400">วันที่: ......./......./.......</p>
        </div>
        <div className="space-y-12">
          <p className="text-slate-500 font-bold uppercase tracking-wider">ลงลายมือชื่อลูกค้า (Customer's Signature)</p>
          <div className="border-b border-slate-300 w-56 mx-auto" />
          <p className="text-slate-800 font-medium text-xs">ลงชื่อตัวบรรจง (............................................................)</p>
          <p className="text-[10px] text-slate-400">วันที่: ......./......./.......</p>
        </div>
      </div>

      {/* Attached Photos section - INDIVIDUAL PAGES FOR PRINTING */}
      {job.photos && job.photos.filter(ph => ph.url).length > 0 && (
        <div className="text-left">
          {job.photos.filter(ph => ph.url).map((ph, idx) => (
            <div 
              key={idx} 
              className="print:break-before-page pt-8 border-t border-slate-200 mt-8 print:mt-0 print:pt-4 flex flex-col justify-between"
            >
              <div className="border-b border-slate-200 pb-2 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  เอกสารแนบส่วนที่ 2: รูปภาพประกอบอ้างอิงของใบงาน {getJobNumber(job)} (หน้า {idx + 2})
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">แนบภาพประกอบการปฏิบัติงานและผลลัพธ์เพื่อเป็นหลักฐานอ้างอิง</p>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center py-6">
                <div className="w-full max-w-2xl border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 p-4 shadow-xs">
                  <div className="aspect-[4/3] max-h-[500px] w-full bg-slate-200 rounded-xl overflow-hidden shadow-inner border border-slate-100 flex items-center justify-center">
                    <img
                      src={ph.url}
                      alt={`Site Work Proof ${idx + 1}`}
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <p className="text-sm text-slate-800 font-bold text-center mt-4 bg-white p-3 rounded-lg border border-slate-100 shadow-3xs">
                    คำบรรยาย: {ph.caption || `รูปถ่ายอ้างอิงประกอบการทำงานส่วนที่ ${idx + 1}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
