import React, { useState, useEffect, useRef } from 'react';
import { Claim } from '../types';
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
  Plus, Edit2, Trash2, Clipboard, Calendar, Clock, AlertTriangle, 
  Search, CheckCircle, X, ChevronRight, User as UserIcon, Tag, Printer, Image as ImageIcon,
  Upload, Download
} from 'lucide-react';
import { calculateDaysBetween, calculateRemainingWarranty, isClaimOverdue } from '../utils/date';
import { techPresetImages } from '../utils/mockImages';
import { parseCSV, generateCSV, downloadFile } from '../utils/csvHelper';

export const ClaimPanel: React.FC<{ initialSearch?: string }> = ({ initialSearch = '' }) => {
  const { user, lookups, addLookupItem, deleteLookupItem } = useFirebase();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Custom CSV and Print states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  const claimHeaders = [
    'Company Name', 'Company Address', 'Contact Name', 'Contact Details', 
    'Contact Phone', 'Contact Email', 'Partner Company', 'Product Type', 
    'Product Brand', 'Model', 'Serial Number', 'Purchase Date', 
    'Warranty Period', 'Claim Destination', 'Claim Building', 
    'Received Claim Date', 'Returned Claim Date', 'Inspector Name', 
    'Claim Status', 'Photo Before URL', 'Photo After URL', 'Notes'
  ];
  
  const claimKeys = [
    'companyName', 'companyAddress', 'contactName', 'contactDetails', 
    'contactPhone', 'contactEmail', 'partnerCompany', 'productType', 
    'productBrand', 'model', 'serialNumber', 'purchaseDate', 
    'warrantyPeriod', 'claimDestination', 'claimBuilding', 
    'receivedClaimDate', 'returnedClaimDate', 'inspectorName', 
    'claimStatus', 'photoBeforeUrl', 'photoAfterUrl', 'notes'
  ];

  const handleExportCSV = () => {
    const csvContent = generateCSV(claimHeaders, filteredClaims, claimKeys);
    downloadFile(`claims_report_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
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
        const importedClaims: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

          const claim: any = {};
          const todayStr = new Date().toISOString().split('T')[0];
          claim.purchaseDate = todayStr;
          claim.receivedClaimDate = todayStr;
          claim.returnedClaimDate = todayStr;
          claim.warrantyPeriod = '1 Year';
          claim.claimStatus = 'Received';
          claim.photoBeforeUrl = '';
          claim.photoAfterUrl = '';
          claim.createdAt = new Date().toISOString();
          claim.updatedAt = new Date().toISOString();

          headers.forEach((header, index) => {
            const val = row[index] || '';
            if (header === 'company name' || header === 'companyname') claim.companyName = val;
            else if (header === 'company address' || header === 'companyaddress') claim.companyAddress = val;
            else if (header === 'contact name' || header === 'contactname') claim.contactName = val;
            else if (header === 'contact details' || header === 'contactdetails') claim.contactDetails = val;
            else if (header === 'contact phone' || header === 'contactphone') claim.contactPhone = val;
            else if (header === 'contact email' || header === 'contactemail') claim.contactEmail = val;
            else if (header === 'partner company' || header === 'partnercompany') claim.partnerCompany = val;
            else if (header === 'product type' || header === 'producttype') claim.productType = val;
            else if (header === 'product brand' || header === 'productbrand') claim.productBrand = val;
            else if (header === 'model') claim.model = val;
            else if (header === 'serial number' || header === 'serialnumber') claim.serialNumber = val;
            else if (header === 'purchase date' || header === 'purchasedate') claim.purchaseDate = val;
            else if (header === 'warranty period' || header === 'warrantyperiod') claim.warrantyPeriod = val;
            else if (header === 'claim destination' || header === 'claimdestination') claim.claimDestination = val;
            else if (header === 'claim building' || header === 'claimbuilding') claim.claimBuilding = val;
            else if (header === 'received claim date' || header === 'receivedclaimdate') claim.receivedClaimDate = val;
            else if (header === 'returned claim date' || header === 'returnedclaimdate') claim.returnedClaimDate = val;
            else if (header === 'inspector name' || header === 'inspectorname') claim.inspectorName = val;
            else if (header === 'photo before url' || header === 'photobeforeurl') claim.photoBeforeUrl = val;
            else if (header === 'photo after url' || header === 'photoafterurl') claim.photoAfterUrl = val;
            else if (header === 'notes') claim.notes = val;
            else if (header === 'claim status' || header === 'claimstatus') {
              if (['Received', 'In Inspection', 'Sent to Claim', 'Ready for Return', 'Returned'].includes(val)) {
                claim.claimStatus = val;
              }
            }
          });

          if (!claim.companyName) continue;
          importedClaims.push(claim);
        }

        if (importedClaims.length === 0) {
          alert("ไม่พบข้อมูลเคลมสินค้าที่ถูกต้องในไฟล์ CSV");
          return;
        }

        if (!confirm(`คุณต้องการนำเข้าข้อมูลเคลมสินค้าจำนวน ${importedClaims.length} รายการใช่หรือไม่?`)) {
          return;
        }

        const path = 'claims';
        const customersPath = 'customers';

        for (const claim of importedClaims) {
          await addDoc(collection(db, path), claim);

          const snapshot = await getDocs(collection(db, customersPath));
          let exists = false;
          snapshot.forEach((docSnap) => {
            if (docSnap.data().companyName.toLowerCase().trim() === claim.companyName.toLowerCase().trim()) {
              exists = true;
            }
          });

          if (!exists) {
            await addDoc(collection(db, customersPath), {
              companyName: claim.companyName,
              companyAddress: claim.companyAddress || '',
              contactName: claim.contactName || '',
              contactDetails: claim.contactDetails || '',
              contactPhone: claim.contactPhone || '',
              contactEmail: claim.contactEmail || '',
              partnerCompany: claim.partnerCompany || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }

        alert("นำเข้าข้อมูลเสร็จสมบูรณ์!");
        fetchClaims();
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Dynamic product type inline add
  const [newCustomClaimType, setNewCustomClaimType] = useState('');
  const [showAddClaimType, setShowAddClaimType] = useState(false);

  // Preset image uploader trigger state
  const [activePhotoSelectField, setActivePhotoSelectField] = useState<'photoBefore' | 'photoAfter' | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [partnerCompany, setPartnerCompany] = useState('');
  const [productType, setProductType] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyPeriod, setWarrantyPeriod] = useState('1 Year');
  const [claimDestination, setClaimDestination] = useState('');
  const [claimBuilding, setClaimBuilding] = useState('');
  const [receivedClaimDate, setReceivedClaimDate] = useState('');
  const [returnedClaimDate, setReturnedClaimDate] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [claimStatus, setClaimStatus] = useState<Claim['claimStatus']>('Received');
  const [photoBeforeUrl, setPhotoBeforeUrl] = useState('');
  const [photoAfterUrl, setPhotoAfterUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const fetchClaims = async () => {
    setLoading(true);
    const path = 'claims';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched: Claim[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as Claim);
      });
      setClaims(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    if (lookups.claimProductTypes.length > 0 && !productType) {
      setProductType(lookups.claimProductTypes[0]);
    }
  }, [lookups, productType]);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setActiveClaim(null);
    setCompanyName('');
    setCompanyAddress('');
    setContactName('');
    setContactDetails('');
    setContactPhone('');
    setContactEmail('');
    setPartnerCompany('');
    setProductType(lookups.claimProductTypes[0] || '');
    setProductBrand('');
    setModel('');
    setSerialNumber('');
    
    const todayStr = new Date().toISOString().split('T')[0];
    setPurchaseDate(todayStr);
    setWarrantyPeriod('1 Year');
    setClaimDestination('WSS Warehouse');
    setClaimBuilding('Building A');
    setReceivedClaimDate(todayStr);
    setReturnedClaimDate('');
    setInspectorName('');
    setClaimStatus('Received');
    setPhotoBeforeUrl('');
    setPhotoAfterUrl('');
    setNotes('');
    setRemarks('');
    
    setShowFormModal(true);
  };

  const handleOpenEdit = (claim: Claim) => {
    setIsEditing(true);
    setActiveClaim(claim);
    setCompanyName(claim.companyName);
    setCompanyAddress(claim.companyAddress || '');
    setContactName(claim.contactName || '');
    setContactDetails(claim.contactDetails || '');
    setContactPhone(claim.contactPhone || '');
    setContactEmail(claim.contactEmail || '');
    setPartnerCompany(claim.partnerCompany || '');
    setProductType(claim.productType);
    setProductBrand(claim.productBrand || '');
    setModel(claim.model || '');
    setSerialNumber(claim.serialNumber || '');
    setPurchaseDate(claim.purchaseDate || '');
    setWarrantyPeriod(claim.warrantyPeriod || '1 Year');
    setClaimDestination(claim.claimDestination || '');
    setClaimBuilding(claim.claimBuilding || '');
    setReceivedClaimDate(claim.receivedClaimDate || '');
    setReturnedClaimDate(claim.returnedClaimDate || '');
    setInspectorName(claim.inspectorName || '');
    setClaimStatus(claim.claimStatus || 'Received');
    setPhotoBeforeUrl(claim.photoBeforeUrl || '');
    setPhotoAfterUrl(claim.photoAfterUrl || '');
    setNotes(claim.notes || '');
    setRemarks(claim.remarks || '');
    
    setShowFormModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !productBrand.trim() || !serialNumber.trim()) return;

    // Remaining warranty string calculation on save
    const remaining = calculateRemainingWarranty(purchaseDate, warrantyPeriod).text;

    const path = 'claims';
    const payload = {
      companyName,
      companyAddress,
      contactName,
      contactDetails,
      contactPhone,
      contactEmail,
      partnerCompany,
      productType,
      productBrand,
      model,
      serialNumber,
      purchaseDate,
      warrantyPeriod,
      remainingWarranty: remaining,
      claimDestination,
      claimBuilding,
      receivedClaimDate,
      returnedClaimDate,
      inspectorName,
      claimStatus,
      photoBeforeUrl,
      photoAfterUrl,
      notes,
      remarks,
      updatedAt: new Date().toISOString()
    };

    try {
      if (isEditing && activeClaim) {
        const docRef = doc(db, path, activeClaim.id);
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      setShowFormModal(false);
      fetchClaims();
    } catch (err) {
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณต้องการลบรายงานส่งเคลมนี้ใช่หรือไม่?')) return;
    const path = 'claims';
    try {
      await deleteDoc(doc(db, path, id));
      fetchClaims();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleOpenReport = (claim: Claim) => {
    setActiveClaim(claim);
    setShowReportModal(true);
  };

  const handleAddClaimType = () => {
    const val = newCustomClaimType.trim();
    if (val) {
      addLookupItem('claimProductTypes', val);
      setProductType(val);
      setNewCustomClaimType('');
      setShowAddClaimType(false);
    }
  };

  const handleDeleteClaimType = (typeToDelete: string) => {
    if (window.confirm(`คุณแน่ใจว่าต้องการลบประเภทสินค้า "${typeToDelete}" ใช่หรือไม่?`)) {
      deleteLookupItem('claimProductTypes', typeToDelete);
      if (productType === typeToDelete) {
        setProductType(lookups.claimProductTypes[0] || '');
      }
    }
  };

  const handleSelectPresetPhoto = (url: string) => {
    if (activePhotoSelectField === 'photoBefore') {
      setPhotoBeforeUrl(url);
    } else if (activePhotoSelectField === 'photoAfter') {
      setPhotoAfterUrl(url);
    }
    setActivePhotoSelectField(null);
  };

  const filteredClaims = claims.filter((claim) => {
    const matchSearch = 
      claim.companyName.toLowerCase().includes(search.toLowerCase()) ||
      claim.productBrand.toLowerCase().includes(search.toLowerCase()) ||
      claim.serialNumber.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'All') return matchSearch;
    return matchSearch && claim.claimStatus === statusFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Search and action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-1 flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อบริษัท, ยี่ห้อ, หมายเลขซีเรียล..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 overflow-x-auto scrollbar-none">
            {['All', 'Received', 'Checking', 'Sent to Vendor', 'Ready for Return', 'Completed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'All' ? 'ทั้งหมด' : st === 'Received' ? 'รับเคลม' : st === 'Checking' ? 'ตรวจเช็ค' : st === 'Sent to Vendor' ? 'ส่งนอก' : st === 'Ready for Return' ? 'พร้อมคืน' : 'เสร็จสิ้น'}
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
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มรายการเคลมสินค้า</span>
          </button>
        </div>
      </div>

      {/* Claims List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
            กำลังโหลดข้อมูลรายการเคลมสินค้า...
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            ไม่มีบันทึกการส่งเคลมสินค้าที่ตรงเงื่อนไข
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 tracking-wider uppercase">
                  <th className="px-6 py-4">ลูกค้าผู้เคลม</th>
                  <th className="px-6 py-4">อุปกรณ์สินค้า</th>
                  <th className="px-6 py-4">S/N / รุ่น</th>
                  <th className="px-6 py-4">สถานะประกัน</th>
                  <th className="px-6 py-4">วันที่รับเคลม</th>
                  <th className="px-6 py-4">ผู้เช็ค / อาคาร</th>
                  <th className="px-6 py-4">สถานะเคลม</th>
                  <th className="px-6 py-4 text-center">รายงาน</th>
                  <th className="px-6 py-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredClaims.map((claim) => {
                  const isOver = isClaimOverdue(claim.receivedClaimDate, claim.claimStatus);
                  const warranty = calculateRemainingWarranty(claim.purchaseDate, claim.warrantyPeriod);
                  return (
                     <tr 
                      key={claim.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOver ? 'bg-rose-50/50 hover:bg-rose-50' : ''
                      }`}
                    >
                      {/* Customer info */}
                      <td className="px-6 py-4 space-y-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{claim.companyName}</span>
                          {isOver && (
                            <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              เกิน 30 วัน
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">ติดต่อ: {claim.contactName} ({claim.contactPhone})</p>
                      </td>

                      {/* Equipment Type */}
                      <td className="px-6 py-4 space-y-0.5 text-left">
                        <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-700">
                          {claim.productType}
                        </span>
                        <p className="text-slate-900 font-semibold pt-1">{claim.productBrand}</p>
                      </td>

                      {/* Serial Number / Model */}
                      <td className="px-6 py-4 space-y-0.5 text-left">
                        <span className="font-mono bg-slate-50 border border-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                          {claim.serialNumber}
                        </span>
                        <p className="text-[11px] text-slate-500">รุ่น: {claim.model || '-'}</p>
                      </td>

                      {/* Warranty */}
                      <td className="px-6 py-4 max-w-[150px] text-left">
                        <span className={`inline-block font-semibold text-[10px] ${
                          warranty.isExpired ? 'text-rose-600' : 'text-emerald-600 font-bold'
                        }`}>
                          {warranty.text}
                        </span>
                      </td>

                      {/* Received date */}
                      <td className="px-6 py-4 font-mono text-slate-700 text-left">
                        {claim.receivedClaimDate}
                      </td>

                      {/* Inspector / Location */}
                      <td className="px-6 py-4 space-y-0.5 text-left">
                        <p className="text-slate-900 font-bold">{claim.inspectorName || '-'}</p>
                        <p className="text-[11px] text-slate-500">อาคาร: {claim.claimBuilding || '-'}</p>
                      </td>

                      {/* Claim Status */}
                      <td className="px-6 py-4 text-left">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          claim.claimStatus === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : claim.claimStatus === 'Ready for Return'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : claim.claimStatus === 'Sent to Vendor'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : claim.claimStatus === 'Checking'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}>
                          {claim.claimStatus === 'Completed' ? 'เสร็จสิ้น' : claim.claimStatus === 'Ready for Return' ? 'พร้อมรับคืน' : claim.claimStatus === 'Sent to Vendor' ? 'ส่งซัพพลายเออร์' : claim.claimStatus === 'Checking' ? 'กำลังตรวจสอบ' : 'รับเคลมสินค้า'}
                        </span>
                      </td>

                      {/* Report generation icon */}
                      <td className="px-6 py-4 text-center">
                        <button
                          id={`report-btn-${claim.id}`}
                          onClick={() => handleOpenReport(claim)}
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-200 hover:border-blue-300 transition-all"
                          title="ดูรายงานเคลมสินค้า"
                        >
                          <Clipboard className="w-4.5 h-4.5" />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          id={`edit-claim-btn-${claim.id}`}
                          onClick={() => handleOpenEdit(claim)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-colors border border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-claim-btn-${claim.id}`}
                          onClick={() => handleDelete(claim.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition-colors border border-rose-200"
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
      </div>

      {/* =======================================
          ADD/EDIT CLAIM FORM MODAL
          ======================================= */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 text-left">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Clipboard className="w-5.5 h-5.5 text-blue-600" />
                {isEditing ? 'แก้ไขรายการสินค้าส่งเคลม' : 'บันทึกเคลมสินค้าใหม่'}
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Part 1: Client contact */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">1. ข้อมูลผู้ส่งเคลมสินค้า</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ชื่อบริษัท / ร้านค้า *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="บริษัท คิงดอม เทรดดิ้ง จำกัด"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">บริษัทคู่ค้า (ถ้ามี)</label>
                    <input
                      type="text"
                      value={partnerCompany}
                      onChange={(e) => setPartnerCompany(e.target.value)}
                      placeholder="พาร์ทเนอร์นำส่ง"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ที่อยู่จัดส่งส่งเคลม</label>
                    <textarea
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="ที่อยู่ร้านค้าเพื่อจัดส่งอุปกรณ์คืน..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-16 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ชื่อผู้ติดต่อ</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="คุณเกรียงไกร นำชัย"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">เบอร์โทรศัพท์ติดต่อกลับ *</label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="083-999-8888"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Part 2: Product specification */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">2. รายละเอียดอุปกรณ์และประกัน</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Category Type Select with inline configure */}
                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-600">ประเภทผลิตภัณฑ์อุปกรณ์ *</label>
                      <button
                        type="button"
                        onClick={() => setShowAddClaimType(!showAddClaimType)}
                        className="text-blue-600 hover:text-blue-500 text-[10px] font-bold underline"
                      >
                        {showAddClaimType ? 'ซ่อนการเพิ่ม' : '+ เพิ่ม/ลบประเภทสินค้า'}
                      </button>
                    </div>

                    {showAddClaimType ? (
                      <div className="space-y-2 p-3 bg-slate-100 rounded-xl border border-slate-200">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCustomClaimType}
                            onChange={(e) => setNewCustomClaimType(e.target.value)}
                            placeholder="พิมพ์ประเภทอุปกรณ์เคลมใหม่..."
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={handleAddClaimType}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            เพิ่ม
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pt-2">
                          {lookups.claimProductTypes.map((type) => (
                            <span key={type} className="inline-flex items-center gap-1 bg-white text-slate-700 text-[10px] px-2 py-1 rounded-md border border-slate-200">
                              {type}
                              <button
                                type="button"
                                onClick={() => handleDeleteClaimType(type)}
                                className="text-rose-500 hover:text-rose-600 font-bold"
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
                        {lookups.claimProductTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ยี่ห้อสินค้า *</label>
                    <input
                      type="text"
                      required
                      value={productBrand}
                      onChange={(e) => setProductBrand(e.target.value)}
                      placeholder="เช่น Hikvision, Cisco, APC"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">รุ่น (Model) *</label>
                    <input
                      type="text"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="เช่น DS-2CD2121G0-I"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">หมายเลขซีเรียล (S/N) *</label>
                    <input
                      type="text"
                      required
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="เช่น SN88899922233"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">วันที่สั่งซื้อสินค้า</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ระยะเวลารับประกัน (Warranty Period)</label>
                    <select
                      value={warrantyPeriod}
                      onChange={(e) => setWarrantyPeriod(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="1 Year">1 ปี (12 เดือน)</option>
                      <option value="2 Years">2 ปี (24 เดือน)</option>
                      <option value="3 Years">3 ปี (36 เดือน)</option>
                      <option value="5 Years">5 ปี (60 เดือน)</option>
                      <option value="6 Months">6 เดือน</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Part 3: Claim specifications */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">3. ข้อมูลการส่งเคลม & ตรวจเช็ค</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">สถานที่ส่งเคลม (ศูนย์เคลม)</label>
                    <input
                      type="text"
                      value={claimDestination}
                      onChange={(e) => setClaimDestination(e.target.value)}
                      placeholder="เช่น ศูนย์ Synnex พระราม 9"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">อาคารคลังสินค้ารับเก็บเคลม</label>
                    <input
                      type="text"
                      value={claimBuilding}
                      onChange={(e) => setClaimBuilding(e.target.value)}
                      placeholder="อาคาร A ห้องล็อกเกอร์ 3"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">ชื่อเจ้าหน้าที่ผู้ตรวจสอบ</label>
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      placeholder="ชื่อช่างเทคนิคผู้ตรวจ"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      วันที่รับสินค้าเคลม *
                    </label>
                    <input
                      type="date"
                      required
                      value={receivedClaimDate}
                      onChange={(e) => setReceivedClaimDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      วันส่งสินค้าเคลมคืนลูกค้า
                    </label>
                    <input
                      type="date"
                      value={returnedClaimDate}
                      onChange={(e) => setReturnedClaimDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">สถานะสินค้าเคลม</label>
                    <select
                      value={claimStatus}
                      onChange={(e) => setClaimStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Received">Received (รับเรื่องเคลมแล้ว)</option>
                      <option value="Checking">Checking (กำลังตรวจสอบอาการ)</option>
                      <option value="Sent to Vendor">Sent to Vendor (ส่งซ่อมศูนย์บริการนอก)</option>
                      <option value="Ready for Return">Ready for Return (ซ่อมเสร็จพร้อมส่งคืนลูกค้า)</option>
                      <option value="Completed">Completed (ลูกค้าได้รับของคืนเสร็จสิ้น)</option>
                      <option value="Rejected">Rejected (ปฏิเสธการเคลม/คืนของเดิม)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">อาการชำรุด / อาการปัญหาที่พบ</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="อาการชำรุด เช่น เลนส์กล้องแตกร้าว ไฟไม่เข้าพอร์ตจ่าย PoE..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">หมายเหตุ</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="หมายเหตุเพิ่มเติมสำหรับการเคลม..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 h-20"
                    />
                  </div>
                </div>
              </div>

              {/* Part 4: Before/After Photos */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h3 className="text-slate-800 font-bold text-sm tracking-wider uppercase border-b border-slate-200 pb-1.5">4. แนบรูปถ่ายสินค้าส่งเคลม</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Photo Before */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <span className="text-xs font-semibold text-slate-600 block text-center">รูปถ่ายสินค้ารับเคลม (สภาพตอนรับ)</span>
                    <div className="aspect-video bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
                      {photoBeforeUrl ? (
                        <>
                          <img
                            src={photoBeforeUrl}
                            alt="Claimed before"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoBeforeUrl('')}
                            className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full shadow-md"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePhotoSelectField('photoBefore')}
                          className="flex flex-col items-center space-y-2 text-slate-500 hover:text-slate-800"
                        >
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-semibold">เลือก/แนบรูปประกอบตอนรับเคลม</span>
                        </button>
                      )}
                    </div>
                    {!photoBeforeUrl && (
                      <input
                        type="text"
                        placeholder="วางที่อยู่ลิงก์รูปถ่าย (URL)..."
                        value={photoBeforeUrl}
                        onChange={(e) => setPhotoBeforeUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                      />
                    )}
                  </div>

                  {/* Photo After */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <span className="text-xs font-semibold text-slate-600 block text-center">รูปถ่ายสินค้าหลังซ่อมเสร็จ/เคลมกลับมา</span>
                    <div className="aspect-video bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
                      {photoAfterUrl ? (
                        <>
                          <img
                            src={photoAfterUrl}
                            alt="Claimed after"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoAfterUrl('')}
                            className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full shadow-md"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePhotoSelectField('photoAfter')}
                          className="flex flex-col items-center space-y-2 text-slate-500 hover:text-slate-800"
                        >
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-semibold">เลือก/แนบรูปประกอบหลังเคลมเสร็จ</span>
                        </button>
                      )}
                    </div>
                    {!photoAfterUrl && (
                      <input
                        type="text"
                        placeholder="วางที่อยู่ลิงก์รูปถ่าย (URL)..."
                        value={photoAfterUrl}
                        onChange={(e) => setPhotoAfterUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-xs transition-all"
                >
                  บันทึกข้อมูลเคลม
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =======================================
          PRESET PHOTO SELECTOR DIALOG
          ======================================= */}
      {activePhotoSelectField !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                คลังรูปภาพประเภทผลิตภัณฑ์ (Hardware Presets)
              </h3>
              <button
                onClick={() => setActivePhotoSelectField(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto p-1">
              {techPresetImages.map((pImg) => (
                <div
                  key={pImg.name}
                  onClick={() => handleSelectPresetPhoto(pImg.url)}
                  className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-xs transition-all group"
                >
                  <img
                    src={pImg.url}
                    alt={pImg.name}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                  />
                  <p className="text-[10px] text-slate-600 p-2 text-center truncate font-semibold">
                    {pImg.name}
                  </p>
                </div>
              ))}
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
                รายงานสรุปงานเคลมสินค้าทั้งหมด ({filteredClaims.length} รายการ)
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
                  <p className="text-xs text-slate-500 font-medium">รายงานสรุปผลการดำเนินงานซ่อมเคลมสินค้า รายคาบ</p>
                </div>
                <div className="text-left md:text-right space-y-0.5">
                  <h2 className="text-xl font-black text-blue-800">รายงาน Claims Service Report</h2>
                  <p className="text-xs text-slate-500">จำนวนรายการงาน: {filteredClaims.length} เคส</p>
                  <p className="text-xs text-slate-500">วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH')}</p>
                </div>
              </div>

              {/* Table of Claims */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                      <th className="border border-slate-300 p-2 text-center">ลำดับ</th>
                      <th className="border border-slate-300 p-2">บริษัทลูกค้า</th>
                      <th className="border border-slate-300 p-2">อุปกรณ์ / ยี่ห้อ / รุ่น</th>
                      <th className="border border-slate-300 p-2">หมายเลขซีเรียล S/N</th>
                      <th className="border border-slate-300 p-2">ผู้ตรวจสอบ</th>
                      <th className="border border-slate-300 p-2">วันที่รับเคลม</th>
                      <th className="border border-slate-300 p-2">ปลายทางส่งเคลม</th>
                      <th className="border border-slate-300 p-2 text-center">สถานะเคลม</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] text-slate-800">
                    {filteredClaims.map((claim, idx) => (
                      <tr key={claim.id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2">
                          <p className="font-bold text-slate-950">{claim.companyName}</p>
                          <p className="text-[10px] text-slate-500">ติดต่อ: {claim.contactName || '-'}</p>
                        </td>
                        <td className="border border-slate-300 p-2">
                          <p className="font-semibold text-blue-800">{claim.productType}</p>
                          <p className="text-slate-600">{claim.productBrand} - {claim.model}</p>
                        </td>
                        <td className="border border-slate-300 p-2 font-mono text-[10px]">{claim.serialNumber || '-'}</td>
                        <td className="border border-slate-300 p-2 font-medium">{claim.inspectorName || '-'}</td>
                        <td className="border border-slate-300 p-2 whitespace-nowrap">{claim.receivedClaimDate}</td>
                        <td className="border border-slate-300 p-2">{claim.claimDestination || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            claim.claimStatus === 'Returned' ? 'bg-emerald-100 text-emerald-800' :
                            claim.claimStatus === 'Ready for Return' ? 'bg-indigo-100 text-indigo-800' :
                            claim.claimStatus === 'Sent to Claim' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {claim.claimStatus === 'Received' ? 'รับเคลม' :
                             claim.claimStatus === 'In Inspection' ? 'ตรวจเช็ค' :
                             claim.claimStatus === 'Sent to Claim' ? 'ส่งนอก' :
                             claim.claimStatus === 'Ready for Return' ? 'พร้อมคืน' : 'เสร็จสิ้น'}
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

      {/* =======================================
          PRINTABLE CLAIM REPORT DOCUMENT
          ======================================= */}
      {showReportModal && activeClaim && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-4xl p-8 max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6 flex flex-col">
            
            {/* Sticky Actions */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full border border-indigo-200">
                เอกสารเคลมหมายเลข: CLM-{activeClaim.id.substring(0, 8).toUpperCase()}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์เอกสารเคลม
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Core Document */}
            <div id="print-area" className="flex-1 space-y-6 font-sans pr-2 overflow-y-auto">
              
              {/* Document Header */}
              <div className="border-b-4 border-indigo-800 pb-5 flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                    WSS Product Claims Center
                  </h1>
                  <p className="text-xs text-slate-500 font-semibold uppercase">ฝ่ายบริการเคลมและตรวจสอบสถานะคุณภาพผลิตภัณฑ์</p>
                  <p className="text-xs text-slate-500">ที่ทำการ: ฝ่ายเคลม WSS Warehouse 101 | โทร: 02-123-4567 ต่อ 9</p>
                </div>
                <div className="text-left md:text-right space-y-0.5">
                  <h2 className="text-xl font-black text-indigo-800">รายงานการส่งเคลมสินค้า (Claim Report)</h2>
                  <p className="text-xs text-slate-500">สถานะสินค้าเคลม: <strong className="text-slate-950">{activeClaim.claimStatus}</strong></p>
                  <p className="text-xs text-slate-500">วันที่ออกรายงาน: {new Date().toLocaleDateString('th-TH')}</p>
                </div>
              </div>

              {/* Grid 1: Customer Profile & Device details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 pb-5">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">ข้อมูลผู้ส่งอุปกรณ์เคลม</h3>
                  <div className="space-y-1 text-sm text-slate-800">
                    <p className="font-bold text-slate-900 text-base">{activeClaim.companyName}</p>
                    <p className="text-xs leading-relaxed">{activeClaim.companyAddress || 'ไม่มีข้อมูลที่อยู่จัดส่ง'}</p>
                    <p className="text-xs pt-1">ผู้ติดต่อกลับ: <strong>{activeClaim.contactName || '-'}</strong> | โทร: <strong>{activeClaim.contactPhone || '-'}</strong></p>
                    <p className="text-xs">อีเมล: {activeClaim.contactEmail || '-'}</p>
                    {activeClaim.partnerCompany && <p className="text-xs text-indigo-700">พาร์ทเนอร์ผู้นำส่ง: {activeClaim.partnerCompany}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">รายละเอียดผลิตภัณฑ์</h3>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-slate-800">
                    <div>ประเภทผลิตภัณฑ์: <strong className="text-slate-900 block">{activeClaim.productType}</strong></div>
                    <div>ยี่ห้อแบรนด์: <strong className="text-slate-900 block">{activeClaim.productBrand}</strong></div>
                    <div>รุ่นสินค้า (Model): <strong className="text-slate-900 block">{claimStatus} ({activeClaim.model || '-'})</strong></div>
                    <div>ซีเรียลนัมเบอร์ (S/N): <strong className="text-indigo-800 text-sm font-mono block">{activeClaim.serialNumber}</strong></div>
                    
                    <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2 space-y-1">
                      <p>วันที่สั่งซื้อดั้งเดิม: <strong>{activeClaim.purchaseDate}</strong></p>
                      <p>ระยะเวลาการประกันดั้งเดิม: <strong>{activeClaim.warrantyPeriod}</strong></p>
                      <p className="text-indigo-800 font-bold">สถานะประกันคงเหลือปัจจุบัน: <strong>{activeClaim.remainingWarranty}</strong></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid 2: Claim logistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 pb-5">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">ข้อมูลการขนส่งเคลม</h3>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-800">
                    <div>ศูนย์รับเคลมปลายทาง: <strong className="text-slate-950 block">{activeClaim.claimDestination || '-'}</strong></div>
                    <div>อาคารคลังสินค้าจัดเก็บ: <strong className="text-slate-950 block">{activeClaim.claimBuilding || '-'}</strong></div>
                    <div>วันที่รับสินค้าเข้าเคลม: <strong className="text-slate-950 block">{activeClaim.receivedClaimDate}</strong></div>
                    <div>วันส่งมอบคืนเรียบร้อย: <strong className="text-slate-950 block">{activeClaim.returnedClaimDate || 'รอดำเนินการ'}</strong></div>
                    <div className="col-span-2 pt-1">เจ้าหน้าที่ผู้ทดสอบ/ตรวจเช็ค: <strong className="text-slate-950">{activeClaim.inspectorName || '-'}</strong></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">อาการเสีย & หมายเหตุ</h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-full space-y-2 text-left">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 block uppercase">อาการชำรุด / อาการปัญหาที่พบ</span>
                      <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{activeClaim.notes || '-'}</p>
                    </div>
                    {activeClaim.remarks && (
                      <div className="border-t border-slate-200/60 pt-2">
                        <span className="text-[10px] font-black text-slate-400 block uppercase">หมายเหตุเพิ่มเติม</span>
                        <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{activeClaim.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Before/After Photos */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">รูปถ่ายบันทึกหลักฐานอุปกรณ์ (Before vs. After Comparison)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Before */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden p-3 bg-slate-50 text-center">
                    <p className="text-xs font-bold text-slate-500 mb-2">สภาพก่อนนำส่งซ่อมเคลม (Before)</p>
                    {activeClaim.photoBeforeUrl ? (
                      <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden">
                        <img
                          src={activeClaim.photoBeforeUrl}
                          alt="Before"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        ไม่ได้ระบุภาพถ่ายก่อนรับเคลม
                      </div>
                    )}
                  </div>

                  {/* After */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden p-3 bg-slate-50 text-center">
                    <p className="text-xs font-bold text-slate-500 mb-2">สภาพหลังได้รับคืนจากศูนย์/เคลมเสร็จ (After)</p>
                    {activeClaim.photoAfterUrl ? (
                      <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden">
                        <img
                          src={activeClaim.photoAfterUrl}
                          alt="After"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        ยังไม่ได้รับการส่งซ่อมคืนจากผู้ขาย / ไม่มีภาพถ่าย
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                <div className="space-y-16">
                  <p className="text-slate-500 font-semibold uppercase">ลงชื่อผู้ทำการตรวจสอบ/ตรวจรับเคลม</p>
                  <div className="border-b border-slate-300 w-48 mx-auto" />
                  <p className="text-slate-800 font-bold">({activeClaim.inspectorName || '...........................................'})</p>
                </div>
                <div className="space-y-16">
                  <p className="text-slate-500 font-semibold uppercase">ลงชื่อลูกค้าผู้มารับสินค้าคืน</p>
                  <div className="border-b border-slate-300 w-48 mx-auto" />
                  <p className="text-slate-800 font-bold">({activeClaim.contactName || '...........................................'})</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
