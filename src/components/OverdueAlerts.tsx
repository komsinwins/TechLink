import React, { useState, useEffect } from 'react';
import { OnsiteService, OncallService, Claim } from '../types';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { isJobOverdue, isClaimOverdue } from '../utils/date';
import { ShieldAlert, AlertTriangle, ArrowRight, Clock } from 'lucide-react';

interface OverdueAlertsProps {
  onsiteJobs?: OnsiteService[];
  oncallJobs?: OncallService[];
  claims?: Claim[];
  onNavigateToTab?: (tabId: string, searchFilter: string) => void;
}

export const OverdueAlerts: React.FC<OverdueAlertsProps> = ({
  onsiteJobs: propOnsite,
  oncallJobs: propOncall,
  claims: propClaims,
  onNavigateToTab,
}) => {
  const [onsite, setOnsite] = useState<OnsiteService[]>([]);
  const [oncall, setOncall] = useState<OncallService[]>([]);
  const [claimsData, setClaimsData] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (propOnsite) {
      setOnsite(propOnsite);
    }
    if (propOncall) {
      setOncall(propOncall);
    }
    if (propClaims) {
      setClaimsData(propClaims);
    }

    if (!propOnsite || !propOncall || !propClaims) {
      const fetchOverdueData = async () => {
        setLoading(true);
        try {
          if (!propOnsite) {
            const snap = await getDocs(collection(db, 'onsite_services'));
            const list: OnsiteService[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as OnsiteService));
            setOnsite(list);
          }
          if (!propOncall) {
            const snap = await getDocs(collection(db, 'oncall_services'));
            const list: OncallService[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as OncallService));
            setOncall(list);
          }
          if (!propClaims) {
            const snap = await getDocs(collection(db, 'claims'));
            const list: Claim[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as Claim));
            setClaimsData(list);
          }
        } catch (err) {
          console.error("Error fetching overdue tasks:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchOverdueData();
    }
  }, [propOnsite, propOncall, propClaims]);

  const overdueOnsite = onsite.filter((job) => isJobOverdue(job.assignedDate, job.status));
  const overdueOncall = oncall.filter((job) => isJobOverdue(job.assignedDate, job.status));
  const overdueClaims = claimsData.filter((claim) => isClaimOverdue(claim.receivedClaimDate, claim.claimStatus));

  const totalOverdue = overdueOnsite.length + overdueOncall.length + overdueClaims.length;

  if (totalOverdue === 0) {
    if (loading) return null;
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center shadow-sm mb-6">
        <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <h3 className="text-slate-800 font-bold text-sm mb-1">สถานะงานปกติทั้งหมด</h3>
        <p className="text-slate-500 text-xs">ไม่มีงานค้างรับแจ้งเกินกำหนด (7 วันสำหรับงานบริการ, 30 วันสำหรับสินค้าเคลม)</p>
      </div>
    );
  }

  const handleNavigateClick = (tabId: string, companyName: string) => {
    if (onNavigateToTab) {
      onNavigateToTab(tabId, companyName);
    } else {
      // Fallback cross navigation via dispatch event or global state if applicable
      const navBtn = document.getElementById(`tab-btn-${tabId === 'claims' ? 'claim' : tabId}`);
      if (navBtn) {
        navBtn.click();
      }
    }
  };

  return (
    <div className="bg-white border border-rose-200/80 rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50/50 to-white border-b border-rose-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-rose-100 text-rose-600 p-2 rounded-xl border border-rose-200 animate-pulse">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-slate-900 font-bold text-sm md:text-base">ระบบแจ้งเตือนงานเกินกำหนดเวลา (Overdue Task Monitor)</h2>
            <p className="text-xs text-slate-500">พบการแจ้งเตือนงานเกินกำหนดเวลาที่อยู่ระหว่างการจัดการล่าช้า</p>
          </div>
        </div>
        <span className="bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-mono font-bold">
          {totalOverdue} รายการล่าช้า
        </span>
      </div>

      {/* Grid of Alert List */}
      <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto divide-y divide-rose-100 scrollbar-thin">
        
        {/* Onsite Service Alerts */}
        {overdueOnsite.length > 0 && (
          <div className="pt-2 first:pt-0">
            <h3 className="text-rose-600 text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Onsite Service เกินกำหนด &gt; 7 วัน ({overdueOnsite.length} รายการ)
            </h3>
            <div className="space-y-2">
              {overdueOnsite.map((job) => {
                const days = Math.ceil((new Date().getTime() - new Date(job.assignedDate).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div 
                    key={job.id}
                    onClick={() => handleNavigateClick('onsite', job.companyName)}
                    className="group bg-rose-50/30 hover:bg-rose-50/75 border border-rose-100/70 hover:border-rose-200 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-rose-700 transition-colors">
                        {job.companyName}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>ผู้ปฏิบัติงาน: <strong className="text-slate-800">{job.techName || 'ยังไม่ได้ระบุ'}</strong></span>
                        <span>วันที่รับแจ้ง: <strong className="text-rose-600">{job.assignedDate}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg font-mono font-bold">
                        ล่าช้า {days} วัน
                      </span>
                      <ArrowRight className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Oncall Service Alerts */}
        {overdueOncall.length > 0 && (
          <div className="pt-4">
            <h3 className="text-rose-600 text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Oncall Service เกินกำหนด &gt; 7 วัน ({overdueOncall.length} รายการ)
            </h3>
            <div className="space-y-2">
              {overdueOncall.map((job) => {
                const days = Math.ceil((new Date().getTime() - new Date(job.assignedDate).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div 
                    key={job.id}
                    onClick={() => handleNavigateClick('oncall', job.companyName)}
                    className="group bg-rose-50/30 hover:bg-rose-50/75 border border-rose-100/70 hover:border-rose-200 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-rose-700 transition-colors">
                        {job.companyName}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>ผู้ปฏิบัติงาน: <strong className="text-slate-800">{job.techName || 'ยังไม่ได้ระบุ'}</strong></span>
                        <span>วันที่รับแจ้ง: <strong className="text-rose-600">{job.assignedDate}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg font-mono font-bold">
                        ล่าช้า {days} วัน
                      </span>
                      <ArrowRight className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Claims Alerts */}
        {overdueClaims.length > 0 && (
          <div className="pt-4">
            <h3 className="text-rose-600 text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              เคลมสินค้า เกินกำหนด &gt; 30 วัน ({overdueClaims.length} รายการ)
            </h3>
            <div className="space-y-2">
              {overdueClaims.map((claim) => {
                const days = Math.ceil((new Date().getTime() - new Date(claim.receivedClaimDate).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div 
                    key={claim.id}
                    onClick={() => handleNavigateClick('claims', claim.companyName)}
                    className="group bg-rose-50/30 hover:bg-rose-50/75 border border-rose-100/70 hover:border-rose-200 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-rose-700 transition-colors">
                        {claim.companyName} ({claim.productBrand} - {claim.model})
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>S/N: <strong className="text-slate-800 font-mono">{claim.serialNumber}</strong></span>
                        <span>วันที่รับสินค้าเคลม: <strong className="text-rose-600">{claim.receivedClaimDate}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg font-mono font-bold">
                        ล่าช้า {days} วัน
                      </span>
                      <ArrowRight className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
