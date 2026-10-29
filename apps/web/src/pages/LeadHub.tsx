import React, { useState, useEffect, useCallback, useRef } from 'react';
import DataTable from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { leadService } from '../services/api';
import type { Lead, MasterData } from '../types/crm';
import { 
  Users, 
  Plus, 
  RefreshCw, 
  FileUp, 
  Upload,
  Download,
  ChevronRight 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Trash2 } from 'lucide-react';
import LeadModal from '../components/modals/LeadModal';
import { useAuth } from '../contexts/AuthContext';

const LeadHub: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | undefined>(undefined);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({
    brandId: '',
    projectId: '',
    search: ''
  });
  
  const [tempFilters, setTempFilters] = useState<any>({
    brandId: '',
    projectId: '',
  });

  const fetchMasters = async () => {
    try {
      const data = await leadService.getMasters();
      setMasters(data);
    } catch (error) {
      console.error('Error fetching masters:', error);
    }
  };

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await leadService.getLeads({ 
        page, 
        limit: 10,
        ...activeFilters
      });
      setLeads(res.data);
      setTotal(res.total);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, activeFilters]);

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleApplyFilters = () => {
    setActiveFilters((prev: any) => ({
      ...prev,
      ...tempFilters
    }));
    setPage(1);
  };

  const handleUpdateProjects = async () => {
    await fetchMasters();
    alert('Projects updated successfully!');
  };

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('The uploaded file appears to be empty.');
          e.target.value = '';
          return;
        }

        const res = await leadService.bulkUploadLeads(rows);
        alert(res.message || `File "${file.name}" imported successfully!`);
        await fetchLeads();
      } catch (err: any) {
        console.error('Upload error:', err);
        alert(err?.response?.data?.message || 'Failed to import leads from file.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleDownloadSample = () => {
    const sampleRows = [
      {
        Name: 'Vikram Aditya',
        Phone: '9840110001',
        Email: 'vikram.aditya@example.com',
        Status: 'Fresh',
        Brand: 'Cookscape',
        Project: 'Modular Kitchen',
        Source: 'Google Ads',
        Rating: 5,
        Showroom: 'Chennai - OMR',
        VisitDate: '',
        AppointmentDate: '',
        Location: 'OMR, Chennai',
        AssignedTo: 'Arun Kumar',
        InstructionToPass: 'Share modular kitchen brochure and schedule initial call',
        Comments: 'New inquiry for L-shaped modular kitchen'
      },
      {
        Name: 'Kavitha Krishnan',
        Phone: '9840110002',
        Email: 'kavitha.k@example.com',
        Status: 'Yet To Follow-up',
        Brand: 'Orbix',
        Project: 'Complete Home',
        Source: 'Website',
        Rating: 4,
        Showroom: 'Chennai - Porur',
        VisitDate: '',
        AppointmentDate: '',
        Location: 'Porur, Chennai',
        AssignedTo: 'Deepika S',
        InstructionToPass: 'Call customer between 10 AM and 12 PM tomorrow',
        Comments: 'Requested callback tomorrow morning'
      },
      {
        Name: 'Ramesh Babu',
        Phone: '9840110003',
        Email: 'ramesh.babu@example.com',
        Status: 'Follow-up',
        Brand: 'Cookscape',
        Project: 'Wardrobe',
        Source: 'Facebook',
        Rating: 4,
        Showroom: 'Bangalore - HSR',
        VisitDate: '',
        AppointmentDate: '',
        Location: 'HSR Layout, Bangalore',
        AssignedTo: 'Manoj Ray',
        InstructionToPass: 'Follow up on laminate vs acrylic finish preference',
        Comments: 'Shared initial quotation, following up on material selection'
      },
      {
        Name: 'Lakshmi Narayanan',
        Phone: '9840110004',
        Email: 'lakshmi.n@example.com',
        Status: 'Opportunities',
        Brand: 'Orbix',
        Project: 'Interior Design',
        Source: 'Instagram',
        Rating: 5,
        Showroom: 'Chennai - Nandhanam(MTRS)',
        VisitDate: '',
        AppointmentDate: '',
        Location: 'Adyar, Chennai',
        AssignedTo: 'Priya Mani',
        InstructionToPass: 'Assign senior designer to prepare 3D elevation and BOQ',
        Comments: 'High-value 3BHK full interior opportunity, floor plan received'
      },
      {
        Name: 'Sanjay Subramanian',
        Phone: '9840110005',
        Email: 'sanjay.s@example.com',
        Status: 'Order Booked',
        Brand: 'Cookscape',
        Project: 'Complete Home',
        Source: 'Referral',
        Rating: 5,
        Showroom: 'Chennai - OMR',
        VisitDate: '',
        AppointmentDate: '',
        Location: 'ECR, Chennai',
        AssignedTo: 'Arun Kumar',
        InstructionToPass: 'Coordinate with feasibility team for final site marking',
        Comments: 'Advance payment received, order booked'
      },
      {
        Name: 'Divya Darshini',
        Phone: '9840110006',
        Email: 'divya.d@example.com',
        Status: 'Showroom Visit',
        Brand: 'Cookscape',
        Project: 'Modular Kitchen',
        Source: 'Walk-in',
        Rating: 5,
        Showroom: 'Chennai - OMR',
        VisitDate: '2026-10-30 11:00',
        AppointmentDate: '',
        Location: 'OMR Showroom',
        AssignedTo: 'Suresh G',
        InstructionToPass: 'Prepare acrylic and PU shutter samples for OMR showroom demo',
        Comments: 'Visited Chennai OMR showroom to inspect acrylic finishes'
      },
      {
        Name: 'Prashanth Raj',
        Phone: '9840110007',
        Email: 'prashanth.r@example.com',
        Status: 'Appointment Fix',
        Brand: 'Orbix',
        Project: 'Renovation',
        Source: 'Google Ads',
        Rating: 4,
        Showroom: 'Coimbatore - Covai',
        VisitDate: '',
        AppointmentDate: '2026-10-31 15:30',
        Location: 'RS Puram, Coimbatore',
        AssignedTo: 'Karthik R',
        InstructionToPass: 'Carry laser measurement kit for site measurement at RS Puram',
        Comments: 'Site measurement appointment fixed with client'
      },
      {
        Name: 'Mohan Kumar',
        Phone: '9840110008',
        Email: 'mohan.k@example.com',
        Status: 'Disqualified',
        Brand: 'Cookscape',
        Project: 'Wardrobe',
        Source: 'Facebook',
        Rating: 1,
        Showroom: 'Chennai - Porur',
        VisitDate: '',
        AppointmentDate: '',
        Location: 'Outside Service Area',
        AssignedTo: 'Deepika S',
        InstructionToPass: 'No further action needed - outside serviceable city limits',
        Comments: 'Disqualified - Requirement outside serviceable region'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Leads');
    XLSX.writeFile(workbook, 'sample_leads_all_statuses.xlsx');
  };

  const handleBulkAssign = async () => {
    if (!targetUserId) {
      alert('Please select a user to assign to.');
      return;
    }
    setIsSubmittingBulk(true);
    try {
      await leadService.bulkAssignLeads(selectedLeads, targetUserId);
      alert(`Successfully assigned ${selectedLeads.length} leads.`);
      setSelectedLeads([]);
      setIsBulkModalOpen(false);
      setTargetUserId('');
      fetchLeads();
    } catch (error) {
      console.error('Error in bulk assign:', error);
      alert('Failed to bulk assign leads.');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(l => l.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete lead "${name}"?`)) {
      return;
    }
    try {
      await leadService.deleteLead(id);
      alert('Lead deleted successfully');
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete lead');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedLeads.length} leads?`)) {
      return;
    }
    try {
      await leadService.bulkDeleteLeads(selectedLeads);
      alert(`Successfully deleted ${selectedLeads.length} leads`);
      setSelectedLeads([]);
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete selected leads');
    }
  };

  const columns: Column[] = [
    {
      header: (
        <input 
          type="checkbox" 
          checked={selectedLeads.length > 0 && selectedLeads.length === leads.length}
          onChange={toggleSelectAll}
          className="border-gray-300"
        />
      ),
      accessor: 'id',
      render: (row: Lead) => (
        <input 
          type="checkbox" 
          checked={selectedLeads.includes(row.id)}
          onChange={() => toggleSelectOne(row.id)}
          className="border-gray-300"
        />
      )
    },
    { 
      header: 'Date', 
      accessor: 'createdAt',
      render: (row: Lead) => (
        <div className="flex flex-col">
            <span className="font-bold text-gray-700 text-xs">
                {new Date(row.createdAt).toLocaleDateString('en-GB')}
            </span>
            <span className="text-[9px] text-gray-400 uppercase">
                {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
      )
    },
    { 
        header: 'Lead ID', 
        accessor: 'leadId',
        render: (row: Lead) => <span className="text-xs text-gray-500">#{row.leadId}</span>
    },
    { 
      header: 'Lead Details', 
      accessor: 'name',
      render: (row: Lead) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-700 hover:text-brand cursor-pointer text-[13px]">
            {row.name}
          </span>
          <span className="text-[11px] text-brand font-medium">{row.phone}</span>
        </div>
      )
    },
    { 
        header: 'Context', 
        accessor: 'brand',
        render: (row: Lead) => (
            <div className="flex flex-col">
                <span className="text-[11px] font-bold text-gray-600 uppercase">{row.brand?.name || '-'}</span>
                <span className="text-[10px] text-gray-400">{row.project?.name || '-'}</span>
            </div>
        )
    },
    { 
      header: 'Status & Source', 
      accessor: 'status',
      render: (row: Lead) => (
        <div className="flex flex-col">
          <span className="bg-brand text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-fit">
            {row.status?.name || 'Fresh'}
          </span>
          <span className="text-[9px] text-gray-400 font-bold uppercase mt-1">
            {row.source?.name || 'Manual'}
          </span>
        </div>
      )
    },
    {
        header: 'Assigned To',
        accessor: 'assignedTo',
        render: (row: Lead) => (
            <span className="text-[11px] font-medium text-gray-600">
                {row.assignedTo?.fullName || <span className="text-gray-300 italic">Unassigned</span>}
            </span>
        )
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (row: Lead) => (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              setLeadToEdit(row);
              setIsModalOpen(true);
            }}
            className="text-gray-400 hover:text-brand transition-colors p-1"
            title="Edit Lead"
          >
            <ChevronRight size={16} />
          </button>
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => handleDeleteLead(row.id, row.name)}
              className="text-gray-300 hover:text-red-600 transition-colors p-1"
              title="Delete Lead"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="container-fluid py-4">
      {/* Header Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h4 className="page-title text-xl font-bold text-gray-700 m-0">Lead Hub</h4>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full lg:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
            accept=".csv,.xlsx,.xls"
          />
          <button 
            onClick={handleUpdateProjects}
            className="btn-custom !bg-brand hover:!bg-[#004d30] !rounded-full !px-3 sm:!px-4 !py-1.5 text-[10px] sm:text-[11px] flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <RefreshCw size={14} className="shrink-0" /> <span className="truncate">Update Projects</span>
          </button>
          <button 
            onClick={handleDownloadSample}
            className="btn-custom !bg-[#313a46] hover:!bg-black !rounded-full !px-3 sm:!px-4 !py-1.5 text-[10px] sm:text-[11px] flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <Download size={14} className="shrink-0" /> <span className="truncate">Sample Sheet</span>
          </button>
          <button 
            onClick={handleFileUploadClick}
            className="btn-custom !bg-brand hover:!bg-[#004d30] !rounded-full !px-3 sm:!px-4 !py-1.5 text-[10px] sm:text-[11px] flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <FileUp size={14} className="shrink-0" /> <span className="truncate">Custom Upload</span>
          </button>
          <button 
            onClick={handleFileUploadClick}
            className="btn-custom !bg-brand hover:!bg-[#004d30] !rounded-full !px-3 sm:!px-4 !py-1.5 text-[10px] sm:text-[11px] flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <Upload size={14} className="shrink-0" /> <span className="truncate">Upload Lead</span>
          </button>
          <button 
            onClick={() => {
              setLeadToEdit(undefined);
              setIsModalOpen(true);
            }}
            className="btn-custom !bg-brand hover:!bg-[#004d30] !rounded-full !px-3 sm:!px-4 !py-1.5 text-[10px] sm:text-[11px] flex items-center justify-center gap-1.5 sm:gap-2 col-span-2 sm:col-auto"
          >
            <Plus size={14} className="shrink-0" /> <span className="truncate">Create Lead</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Simplified alert-info style) */}
      <div className="bg-[#d9edf7] border border-[#bce8f1] text-[#31708f] p-3 md:p-4 rounded mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-3 md:gap-4">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Brand</label>
            <select 
              className="form-control !bg-white !w-full md:!w-40 !py-1 !text-[11px]"
              value={tempFilters.brandId}
              onChange={(e) => setTempFilters({ ...tempFilters, brandId: e.target.value })}
            >
              <option value="">-Select-</option>
              {masters?.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Project</label>
            <select 
              className="form-control !bg-white !w-full md:!w-48 !py-1 !text-[11px]"
              value={tempFilters.projectId}
              onChange={(e) => setTempFilters({ ...tempFilters, projectId: e.target.value })}
            >
              <option value="">-Select-</option>
              {masters?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button 
            onClick={handleApplyFilters}
            className="btn-custom !w-full md:!w-auto !rounded !py-1 !px-4 text-[11px] bg-brand hover:bg-[#004d30] text-white uppercase font-bold tracking-widest mt-2 md:mt-0"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedLeads.length > 0 && (
          <div className="bg-gray-800 text-white p-3 rounded mb-4 flex items-center justify-between">
              <span className="text-xs font-bold">{selectedLeads.length} Leads Selected</span>
              <div className="flex gap-3">
                  <button 
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-brand text-white px-3 py-1 rounded text-[10px] font-bold uppercase"
                  >
                    Bulk Assign
                  </button>
                  {currentUser?.role === 'ADMIN' && (
                    <button 
                      onClick={handleBulkDelete}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Bulk Delete
                    </button>
                  )}
                  <button className="text-gray-400 hover:text-white text-[10px] font-bold uppercase" onClick={() => setSelectedLeads([])}>Cancel</button>
              </div>
          </div>
      )}

      {/* Inventory Table Container */}
      <div className="card-box !p-0 overflow-hidden">
          <div className="px-4 py-3 bg-[#f8f9fa] border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase">
                  <Users size={14} /> Lead Inventory
              </div>
              <div className="flex items-center gap-2">
                  <input 
                      type="text" 
                      placeholder="Search..." 
                      className="form-control !w-48 !py-1 !px-3 !text-[11px]"
                      value={activeFilters.search}
                      onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })}
                  />
              </div>
          </div>
          
          <DataTable 
              columns={columns} 
              data={leads} 
              total={total} 
              page={page} 
              onPageChange={setPage} 
              isLoading={isLoading}
          />
      </div>

      <LeadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => { fetchLeads(); setIsModalOpen(false); }} 
        lead={leadToEdit}
      />

      {/* Bulk Assign Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="bg-[#3b3e47] p-6 flex items-center justify-between text-white">
              <h3 className="text-lg font-bold font-rubik uppercase tracking-tight">Bulk Assign Leads</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <ChevronRight className="rotate-90" size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
               <div className="space-y-1.5">
                  <p className="text-sm text-gray-500 mb-4">You are assigning <strong>{selectedLeads.length}</strong> leads to a new user.</p>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Team Member</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                  >
                    <option value="">- Choose Member -</option>
                    {masters?.users.map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                    ))}
                  </select>
               </div>
               <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-6 py-4 rounded-xl border border-gray-200 text-gray-400 font-bold text-[10px] hover:bg-gray-50 transition-all uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmittingBulk || !targetUserId}
                    onClick={handleBulkAssign}
                    className="flex-1 px-6 py-4 rounded-xl bg-brand text-white font-bold text-[10px] hover:bg-[#004d30] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg shadow-brand/20 disabled:opacity-50"
                  >
                    {isSubmittingBulk ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                    ) : (
                      'Confirm Assignment'
                    )}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadHub;
