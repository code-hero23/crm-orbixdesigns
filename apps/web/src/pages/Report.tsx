import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Download, 
  Calendar, 
  Activity, 
  Clock, 
  User, 
  ArrowRight,
  BarChart2
} from 'lucide-react';
import { leadService } from '../services/api';
import type { DashboardStats, MasterData } from '../types/crm';

type ReportActivity = {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  lead?: {
    id: string;
    name: string;
    status?: { name: string };
  };
  user?: {
    fullName: string;
  };
};

const Report: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ReportActivity[]>([]);
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    activity_type: '',
    lead_status_id: ''
  });

  const fetchData = useCallback(async (searchFilters = {}) => {
    setIsSearching(true);
    try {
      const [statsData, activitiesData, mastersData] = await Promise.all([
        leadService.getStats(),
        leadService.getActivities(searchFilters),
        leadService.getMasters()
      ]);
      setStats(statsData);
      setActivities(activitiesData);
      setMasters(mastersData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(filters);
  };

  const handleExport = () => {
    if (activities.length === 0) return;
    
    const csvContent = [
      ['Date', 'User', 'Activity', 'Lead', 'Content'],
      ...activities.map(a => {
        const date = a.createdAt ? new Date(a.createdAt) : new Date();
        return [
          date.toLocaleString(),
          a.user?.fullName || 'System',
          a.type || '-',
          a.lead?.name || 'N/A',
          (a.content || '').replace(/,/g, ';') // Escape commas for CSV
        ];
      })
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-6">
      {/* Header & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand/5 flex items-center justify-center text-brand">
                <BarChart2 size={24} />
            </div>
            <div>
                <h4 className="text-xl font-bold text-gray-800 m-0">Report Based On Users Activity</h4>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-0.5">Filter and analyze system-wide operations</p>
            </div>
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="date" 
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                value={filters.from_date}
                onChange={(e) => setFilters({...filters, from_date: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="date" 
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                value={filters.to_date}
                onChange={(e) => setFilters({...filters, to_date: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Activity Type</label>
            <select 
              className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
              value={filters.activity_type}
              onChange={(e) => setFilters({...filters, activity_type: e.target.value})}
            >
              <option value="">-- All Activities --</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="NOTE">Note Added</option>
              <option value="SYSTEM">System Log</option>
              <option value="Order Booked">Order Booked</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Lead Status</label>
            <select 
              className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all appearance-none"
              value={filters.lead_status_id}
              onChange={(e) => setFilters({...filters, lead_status_id: e.target.value})}
            >
              <option value="">-- All Statuses --</option>
              {masters?.statuses?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button 
              type="submit"
              disabled={isSearching}
              className="flex-1 bg-brand text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#004d30] transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search size={16} />}
              Search
            </button>
            <button 
              type="button"
              onClick={handleExport}
              className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
              title="Export to CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Activity Timeline */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h5 className="text-sm font-bold text-gray-700 m-0 flex items-center gap-2">
                    <Activity size={18} className="text-brand" /> Activity Log
                </h5>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{activities.length} Records Found</span>
            </div>
            
            <div className="p-8 max-h-[800px] overflow-y-auto scrollbar-thin">
              {activities.length === 0 ? (
                <div className="py-20 text-center">
                    <Clock size={48} className="text-gray-100 mx-auto mb-4" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No activity records found</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-4">
                  {activities.map((activity, idx) => (
                    <div key={activity.id || `activity-${idx}`} className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white bg-brand shadow-sm"></div>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                         <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                activity.type === 'created' ? 'bg-green-100 text-green-700' : 
                                activity.type === 'NOTE' ? 'bg-blue-100 text-blue-700' : 
                                activity.type === 'SYSTEM' ? 'bg-gray-100 text-gray-600' : 
                                'bg-brand/10 text-brand'
                            }`}>
                                {activity.type}
                            </span>
                            <span className="text-xs font-bold text-gray-700">{activity.user?.fullName || 'System'}</span>
                         </div>
                         <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                            <Clock size={12} />
                            {new Date(activity.createdAt).toLocaleString()}
                         </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 group hover:border-brand/20 transition-all">
                         {activity.lead && (
                            <div className="flex items-center gap-1 mb-2">
                                <User size={12} className="text-gray-400" />
                                <span className="text-[11px] font-bold text-brand hover:underline cursor-pointer">{activity.lead.name}</span>
                                {activity.lead.status && (
                                    <span className="text-[10px] text-gray-400 ml-1">• {activity.lead.status.name}</span>
                                )}
                            </div>
                         )}
                         <p className="text-sm text-gray-600 leading-relaxed m-0">{activity.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-[#313a46] rounded-2xl shadow-xl p-6 text-white overflow-hidden relative">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
              <h5 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-white/50 border-b border-white/10 pb-4">Status Summary</h5>
              
              <div className="space-y-4">
                 {[
                   { label: 'Fresh Leads', value: stats?.freshlead || 0, color: 'bg-[#00BCD4]' },
                   { label: 'Follow-ups', value: stats?.followup || 0, color: 'bg-[#EB4386]' },
                   { label: 'Opportunities', value: stats?.opportunities || 0, color: 'bg-[#3373ED]' },
                   { label: 'Order Booked', value: stats?.orderbook || 0, color: 'bg-[#7519C8]' },
                   { label: 'Disqualified', value: stats?.disqualified || 0, color: 'bg-[#28C9A2]' },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all">
                      <div className="flex items-center gap-3">
                         <div className={`w-1.5 h-1.5 rounded-full ${item.color}`}></div>
                         <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors">{item.label}</span>
                      </div>
                      <span className="text-sm font-black tracking-wider">{item.value}</span>
                   </div>
                 ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Operations</span>
                 <span className="text-xl font-black text-brand">
                    {(stats?.freshlead || 0) + (stats?.followup || 0) + (stats?.opportunities || 0) + (stats?.orderbook || 0)}
                 </span>
              </div>
           </div>

           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h5 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-gray-400">Quick Links</h5>
              <div className="space-y-2">
                 <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-600 transition-all border border-transparent hover:border-gray-100">
                    Lead Hub <ArrowRight size={14} className="text-gray-300" />
                 </button>
                 <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-600 transition-all border border-transparent hover:border-gray-100">
                    Appointments <ArrowRight size={14} className="text-gray-300" />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
