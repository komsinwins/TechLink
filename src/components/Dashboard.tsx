import React, { useState, useEffect } from 'react';
import { OnsiteService, OncallService, Claim, Customer } from '../types';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { 
  Laptop, PhoneCall, Clipboard, Users, AlertTriangle, 
  ChevronRight, Activity, Zap, BarChart3, PieChart as PieIcon, LineChart as LineIcon
} from 'lucide-react';
import { isJobOverdue, isClaimOverdue } from '../utils/date';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface DashboardProps {
  onNavigate: (tab: 'onsite' | 'oncall' | 'claim' | 'customer') => void;
  onSearchAcrossTabs: (searchQuery: string, tab: 'onsite' | 'oncall' | 'claim') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSearchAcrossTabs }) => {
  const [onsiteJobs, setOnsiteJobs] = useState<OnsiteService[]>([]);
  const [oncallJobs, setOncallJobs] = useState<OncallService[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const onsiteSnap = await getDocs(collection(db, 'onsite_services'));
      const onsiteList: OnsiteService[] = [];
      onsiteSnap.forEach((docSnap) => {
        onsiteList.push({ id: docSnap.id, ...docSnap.data() } as OnsiteService);
      });
      setOnsiteJobs(onsiteList);

      const oncallSnap = await getDocs(collection(db, 'oncall_services'));
      const oncallList: OncallService[] = [];
      oncallSnap.forEach((docSnap) => {
        oncallList.push({ id: docSnap.id, ...docSnap.data() } as OncallService);
      });
      setOncallJobs(oncallList);

      const claimsSnap = await getDocs(collection(db, 'claims'));
      const claimsList: Claim[] = [];
      claimsSnap.forEach((docSnap) => {
        claimsList.push({ id: docSnap.id, ...docSnap.data() } as Claim);
      });
      setClaims(claimsList);

      const custSnap = await getDocs(collection(db, 'customers'));
      const custList: Customer[] = [];
      custSnap.forEach((docSnap) => {
        custList.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });
      setCustomers(custList);
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute stats
  const totalOnsite = onsiteJobs.length;
  const pendingOnsite = onsiteJobs.filter(j => j.status !== 'Completed').length;
  const completedOnsite = onsiteJobs.filter(j => j.status === 'Completed').length;
  const overdueOnsite = onsiteJobs.filter(j => isJobOverdue(j.assignedDate, j.status)).length;

  const totalOncall = oncallJobs.length;
  const pendingOncall = oncallJobs.filter(j => j.status !== 'Completed').length;
  const completedOncall = oncallJobs.filter(j => j.status === 'Completed').length;
  const overdueOncall = oncallJobs.filter(j => isJobOverdue(j.assignedDate, j.status)).length;

  const totalClaims = claims.length;
  const pendingClaims = claims.filter(c => c.claimStatus !== 'Completed' && c.claimStatus !== 'Rejected').length;
  const completedClaims = claims.filter(c => c.claimStatus === 'Completed').length;
  const overdueClaims = claims.filter(c => isClaimOverdue(c.receivedClaimDate, c.claimStatus)).length;

  const totalCustomers = customers.length;
  const totalOverdueAlertsCount = overdueOnsite + overdueOncall + overdueClaims;
  const totalCompleted = completedOnsite + completedOncall + completedClaims;
  const totalPending = pendingOnsite + pendingOncall + pendingClaims;

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Activity className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="font-semibold text-slate-700">กำลังประมวลผลสถิติและเตรียมหน้าหลักแดชบอร์ด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Dynamic Header Badge/Intro */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-md text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-white/15 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase border border-white/25">
              Technical Support Platform V.1.0
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              ยินดีต้อนรับสู่ระบบ WSS_TechLink
            </h1>
            <p className="text-blue-100 text-xs md:text-sm max-w-xl leading-relaxed">
              ศูนย์ข้อมูลกลางสำหรับบันทึก ติดตาม วิเคราะห์ และบริหารจัดการงานสนับสนุนทางเทคนิคของฝ่าย Technical Support ครบจบในที่เดียว
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 px-5 py-4 rounded-2xl">
            <div className="bg-rose-500 text-white p-3 rounded-xl shadow-lg shadow-rose-500/10">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] text-blue-100 font-bold uppercase tracking-wider">งานเกินกำหนดส่งทั้งหมด</p>
              <p className="text-2xl font-black font-mono text-white leading-none mt-1">
                {totalOverdueAlertsCount} <span className="text-xs font-semibold text-blue-50">รายการค้าง</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of four main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Onsite service card */}
        <div 
          onClick={() => onNavigate('onsite')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-1 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100">
              <Laptop className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 uppercase tracking-wider">
              Onsite Service <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">งานบริการนอกสถานที่</p>
            <p className="text-3xl font-extrabold text-slate-900 font-mono">{totalOnsite}</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10px] text-center font-bold">
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">กำลังทำ</span>
              <span className="text-sm font-mono text-slate-800">{pendingOnsite}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="text-emerald-600 block">เสร็จแล้ว</span>
              <span className="text-sm font-mono text-slate-800">{completedOnsite}</span>
            </div>
            <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
              <span className="text-rose-600 block">เกินกำหนด</span>
              <span className="text-sm font-mono text-rose-700">{overdueOnsite}</span>
            </div>
          </div>
        </div>

        {/* Oncall service card */}
        <div 
          onClick={() => onNavigate('oncall')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-1 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100">
              <PhoneCall className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5 uppercase tracking-wider">
              Oncall Service <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">งานโทรศัพท์ & ตอบไลน์</p>
            <p className="text-3xl font-extrabold text-slate-900 font-mono">{totalOncall}</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10px] text-center font-bold">
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">กำลังแก้</span>
              <span className="text-sm font-mono text-slate-800">{pendingOncall}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="text-emerald-600 block">เสร็จสิ้น</span>
              <span className="text-sm font-mono text-slate-800">{completedOncall}</span>
            </div>
            <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
              <span className="text-rose-600 block">เกินกำหนด</span>
              <span className="text-sm font-mono text-rose-700">{overdueOncall}</span>
            </div>
          </div>
        </div>

        {/* Product Claim Card */}
        <div 
          onClick={() => onNavigate('claim')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-1 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl border border-teal-100">
              <Clipboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-teal-600 flex items-center gap-0.5 uppercase tracking-wider">
              Product Claims <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">งานส่งเคลมผลิตภัณฑ์</p>
            <p className="text-3xl font-extrabold text-slate-900 font-mono">{totalClaims}</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10px] text-center font-bold">
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="text-slate-500 block">ค้างเคลม</span>
              <span className="text-sm font-mono text-slate-800">{pendingClaims}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="text-emerald-600 block">คืนของแล้ว</span>
              <span className="text-sm font-mono text-slate-800">{completedClaims}</span>
            </div>
            <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
              <span className="text-rose-600 block">ช้าเกิน30วัน</span>
              <span className="text-sm font-mono text-rose-700">{overdueClaims}</span>
            </div>
          </div>
        </div>

        {/* Customer list card */}
        <div 
          onClick={() => onNavigate('customer')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-1 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl border border-amber-100">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 uppercase tracking-wider">
              Customer Directory <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">จำนวนลูกค้า / พาร์ทเนอร์</p>
            <p className="text-3xl font-extrabold text-slate-900 font-mono">{totalCustomers}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 mt-4 text-[10px] font-medium leading-relaxed text-slate-500">
            ระบบ auto-save รายชื่อลูกค้าลงในฐานข้อมูลผู้ติดต่อเมื่อมีการบันทึกงานบริการใหม่ทุกครั้ง
          </div>
        </div>

      </div>

      {/* =======================================
          STATISTICS GRAPH SECTION (EXCLUDING CUSTOMERS)
          ======================================= */}
      <div className="bg-white border border-slate-200 shadow-sm p-6 md:p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              รายงานสถิติการปฏิบัติงาน (Operational Analytics)
            </h3>
            <p className="text-xs text-slate-500">
              วิเคราะห์ภาพรวมประเภทบริการ อัตราความสำเร็จ และงานค้างส่งในระบบ (ไม่รวมฐานข้อมูลลูกค้า)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Volume by Service Type */}
          <div className="border border-slate-100 p-5 rounded-2xl bg-slate-50/40 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              ปริมาณงานแยกตามบริการ (Service Volume)
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Onsite', จำนวน: totalOnsite, color: '#3b82f6' },
                  { name: 'Oncall', จำนวน: totalOncall, color: '#f59e0b' },
                  { name: 'Claim', จำนวน: totalClaims, color: '#ec4899' }
                ]}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="จำนวน" radius={[4, 4, 0, 0]}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ec4899" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Status distribution (Pie Chart) */}
          <div className="border border-slate-100 p-5 rounded-2xl bg-slate-50/40 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wider">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              สัดส่วนสถานะการดำเนินงาน (Status Distribution)
            </div>
            <div className="h-60 flex flex-col justify-between">
              <div className="h-44">
                {totalCompleted + totalPending === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    ไม่มีข้อมูลงานสำหรับการวิเคราะห์
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'สำเร็จ', value: totalCompleted },
                          { name: 'รอดำเนินการ', value: totalPending }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex justify-center gap-6 text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 block" />
                  <span className="text-slate-600">เสร็จสิ้น ({totalCompleted})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 block" />
                  <span className="text-slate-600">ค้างงาน ({totalPending})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 3: Overdue Analytics */}
          <div className="border border-slate-100 p-5 rounded-2xl bg-slate-50/40 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wider">
              <LineIcon className="w-4 h-4 text-rose-500" />
              งานล่าช้าเกินกำหนด (Overdue Analytics)
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { name: 'Onsite', ล่าช้า: overdueOnsite },
                  { name: 'Oncall', ล่าช้า: overdueOncall },
                  { name: 'Claim', ล่าช้า: overdueClaims }
                ]}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="ล่าช้า" stroke="#f43f5e" fill="#ffe4e6" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue alert summary breakdown list */}
      {totalOverdueAlertsCount > 0 && (
        <div className="bg-rose-50/50 border border-rose-200/60 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-rose-100 pb-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
            <h3 className="text-rose-800 font-bold text-sm md:text-base">
              สรุปรายการบริการเกินกำหนดส่งมอบงาน ({totalOverdueAlertsCount} รายการล่าช้า)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Onsite overdue list */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 block bg-rose-100/50 px-3 py-1.5 rounded-lg border border-rose-200">
                1. งาน Onsite เกิน 7 วัน ({overdueOnsite})
              </span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {onsiteJobs.filter(j => isJobOverdue(j.assignedDate, j.status)).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ไม่มีรายการตกค้าง</p>
                ) : (
                  onsiteJobs
                    .filter(j => isJobOverdue(j.assignedDate, j.status))
                    .map(job => (
                      <div 
                        key={job.id} 
                        onClick={() => onSearchAcrossTabs(job.companyName, 'onsite')}
                        className="bg-white hover:bg-rose-50/35 border border-slate-200 p-2.5 rounded-xl cursor-pointer text-xs space-y-1 transition-all hover:border-rose-200 shadow-xs"
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <strong className="text-slate-800 truncate max-w-[120px]">{job.companyName}</strong>
                          <span className="text-rose-600 font-bold font-mono">{job.assignedDate}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">ผู้รับผิดชอบ: {job.techName || '-'}</p>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Oncall overdue list */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 block bg-rose-100/50 px-3 py-1.5 rounded-lg border border-rose-200">
                2. งาน Oncall เกิน 7 วัน ({overdueOncall})
              </span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {oncallJobs.filter(j => isJobOverdue(j.assignedDate, j.status)).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ไม่มีรายการตกค้าง</p>
                ) : (
                  oncallJobs
                    .filter(j => isJobOverdue(j.assignedDate, j.status))
                    .map(job => (
                      <div 
                        key={job.id} 
                        onClick={() => onSearchAcrossTabs(job.companyName, 'oncall')}
                        className="bg-white hover:bg-rose-50/35 border border-slate-200 p-2.5 rounded-xl cursor-pointer text-xs space-y-1 transition-all hover:border-rose-200 shadow-xs"
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <strong className="text-slate-800 truncate max-w-[120px]">{job.companyName}</strong>
                          <span className="text-rose-600 font-bold font-mono">{job.assignedDate}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">ระบบ: {job.productType}</p>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Claims overdue list */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 block bg-rose-100/50 px-3 py-1.5 rounded-lg border border-rose-200">
                3. เคลมอุปกรณ์ เกิน 30 วัน ({overdueClaims})
              </span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {claims.filter(c => isClaimOverdue(c.receivedClaimDate, c.claimStatus)).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ไม่มีรายการเคลมล่าช้า</p>
                ) : (
                  claims
                    .filter(c => isClaimOverdue(c.receivedClaimDate, c.claimStatus))
                    .map(claim => (
                      <div 
                        key={claim.id} 
                        onClick={() => onSearchAcrossTabs(claim.companyName, 'claim')}
                        className="bg-white hover:bg-rose-50/35 border border-slate-200 p-2.5 rounded-xl cursor-pointer text-xs space-y-1 transition-all hover:border-rose-200 shadow-xs"
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <strong className="text-slate-800 truncate max-w-[120px]">{claim.companyName}</strong>
                          <span className="text-rose-600 font-bold font-mono">{claim.receivedClaimDate}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">S/N: {claim.serialNumber}</p>
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tech Link Service Procedures Info Banner */}
      <div className="bg-blue-50/40 border border-blue-100 p-5 rounded-3xl flex flex-col md:flex-row items-center gap-5 justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl border border-blue-100">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 text-left">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">เคล็ดลับการใช้บริการและสิทธิ์การใช้งาน</h4>
            <p className="text-xs text-slate-600 leading-relaxed">พาร์ทเนอร์และช่างเทคนิคสามารถสร้างใบงานซ่อมและใบเคลม พร้อมกดปุ่มพิมพ์เพื่อแปลงเป็น Printable Job Card เพื่อยื่นให้กับฝ่ายตรวจสอบคลังสินค้าได้ทันที</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-600">
          <span className="text-[10px] font-semibold text-slate-500">ระบบคลาวด์ซิงก์ทำงานอยู่</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </div>
      </div>

    </div>
  );
};
