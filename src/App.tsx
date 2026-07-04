import React, { useState } from 'react';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { Navbar } from './components/Navbar';
import { OverdueAlerts } from './components/OverdueAlerts';
import { Dashboard } from './components/Dashboard';
import { OnsitePanel } from './components/OnsitePanel';
import { OncallPanel } from './components/OncallPanel';
import { ClaimPanel } from './components/ClaimPanel';
import { CustomerPanel } from './components/CustomerPanel';
import { Terminal, Shield, AlertTriangle } from 'lucide-react';

type Tab = 'dashboard' | 'onsite' | 'oncall' | 'claim' | 'customer';

const MainAppContent: React.FC = () => {
  const { user, loading, connectionStatus } = useFirebase();
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard');
  
  // Cross-navigation search state
  const [onsiteSearch, setOnsiteSearch] = useState('');
  const [oncallSearch, setOncallSearch] = useState('');
  const [claimSearch, setClaimSearch] = useState('');

  const handleSearchAcrossTabs = (searchQuery: string, tab: 'onsite' | 'oncall' | 'claim') => {
    if (tab === 'onsite') {
      setOnsiteSearch(searchQuery);
      setCurrentTab('onsite');
    } else if (tab === 'oncall') {
      setOncallSearch(searchQuery);
      setCurrentTab('oncall');
    } else if (tab === 'claim') {
      setClaimSearch(searchQuery);
      setCurrentTab('claim');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans print:bg-white print:text-slate-900">
      
      {/* Top Warning/Notification Banner about unresolved items */}
      <div className="print:hidden">
        <OverdueAlerts />
      </div>

      {/* Navigation bar with auth & lookup control */}
      <div className="print:hidden">
        <Navbar currentTab={currentTab} onTabChange={(tab) => {
          // Reset quick search query upon manual navigation clicks
          if (tab !== 'onsite') setOnsiteSearch('');
          if (tab !== 'oncall') setOncallSearch('');
          if (tab !== 'claim') setClaimSearch('');
          setCurrentTab(tab as Tab);
        }} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        
        {/* Connection status notification */}
        <div className="print:hidden flex justify-end mb-4">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>โหมดการเชื่อมต่อ: {connectionStatus === 'online' ? 'ออนไลน์ (คลาวด์ซิงก์)' : 'ออฟไลน์ (เซฟในหน่วยความจำ)'}</span>
          </div>
        </div>

        {/* Auth protection info screen */}
        {!user && !loading ? (
          <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 p-8 rounded-3xl text-center space-y-6 shadow-lg print:hidden">
            <div className="bg-blue-50 text-blue-600 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-blue-100">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">กรุณาเข้าสู่ระบบด้วย Google Account</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                คุณจำเป็นต้องล็อกอินเพื่อเข้าสู่ระบบบันทึกประวัติการโทรศัพท์ เคลมสินค้า และตรวจสอบงานบริการ Technical Support WSS_TechLink V.1.0 อย่างปลอดภัย
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs text-left text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                หมายเหตุเกี่ยวกับสิทธิ์การใช้งาน:
              </p>
              ระบุให้เฉพาะบุคลากรทีม Technical Support, วิศวกร, พนักงานขาย (Sales) และฝ่ายบริการเคลมที่ได้รับการอนุญาตเท่านั้นในระบบ
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {currentTab === 'dashboard' && (
              <Dashboard 
                onNavigate={(tab) => {
                  if (tab !== 'onsite') setOnsiteSearch('');
                  if (tab !== 'oncall') setOncallSearch('');
                  if (tab !== 'claim') setClaimSearch('');
                  setCurrentTab(tab);
                }} 
                onSearchAcrossTabs={handleSearchAcrossTabs} 
              />
            )}
            
            {currentTab === 'onsite' && (
              <OnsitePanel initialSearch={onsiteSearch} />
            )}
            
            {currentTab === 'oncall' && (
              <OncallPanel initialSearch={oncallSearch} />
            )}
            
            {currentTab === 'claim' && (
              <ClaimPanel initialSearch={claimSearch} />
            )}
            
            {currentTab === 'customer' && (
              <CustomerPanel />
            )}
          </div>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; 2026 WSS Technical Support Co., Ltd. สงวนลิขสิทธิ์</p>
          <div className="flex space-x-4">
            <span className="font-semibold text-slate-700">WSS_TechLink V.1.0</span>
            <span className="text-slate-300">&bull;</span>
            <span>ระบบบันทึกประวัติ Onsite, Oncall, Claims ครบวงจร</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default function App() {
  return (
    <FirebaseProvider>
      <MainAppContent />
    </FirebaseProvider>
  );
}
