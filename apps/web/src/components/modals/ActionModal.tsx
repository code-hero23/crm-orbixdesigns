import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  Bell, 
  Activity,
  Send,
  User
} from 'lucide-react';
import { leadService } from '../../services/api';
import type { Lead } from '../../types/crm';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lead: Lead;
  type: 'FOLLOWUP' | 'REMINDER' | 'STATUS' | 'NOTE' | 'APPOINTMENT' | 'SWITCH_USER';
}

const ActionModal: React.FC<ActionModalProps> = ({ isOpen, onClose, onSuccess, lead, type }) => {
  const [formData, setFormData] = useState<any>({
    statusId: lead.statusId || '',
    nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString().split('T')[0] : '',
    content: '',
    type: 'NOTE',
    activityType: '',
    smsContent: '',
    reminderSet: true,
    selfAssign: false,
    reminderAssignTo: lead.assignedToId || '',
    targetUserId: '' // For Switch User
  });
  const [masters, setMasters] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const data = await leadService.getMasters();
        setMasters(data);
      } catch (error) {
        console.error('Error fetching masters:', error);
      }
    };
    if (isOpen) fetchMasters();
  }, [isOpen]);

  useEffect(() => {
    setFormData({
      statusId: lead.statusId || '',
      nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString().split('T')[0] : '',
      content: '',
      type: type === 'FOLLOWUP' ? 'STATUS_CHANGE' : type === 'REMINDER' ? 'NOTE' : 'NOTE',
      activityType: '',
      smsContent: '',
      reminderSet: true,
      reminderAssignTo: lead.assignedToId || '',
      targetUserId: ''
    });
  }, [type, lead, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (type === 'SWITCH_USER') {
        if (!formData.targetUserId) throw new Error('Target user required');
        await leadService.assignLead(lead.id, formData.targetUserId);
        onSuccess();
        onClose();
        return;
      }

      if (type === 'FOLLOWUP' || type === 'STATUS') {
        await leadService.updateLead(lead.id, {
          statusId: formData.statusId,
          nextFollowUp: formData.nextFollowUp || null,
          assignedToId: formData.reminderSet ? (formData.reminderAssignTo || undefined) : undefined
        });
      }

      let activityContent = formData.content;
      if (type === 'FOLLOWUP') {
        const activityLabel = formData.activityType === 'PHONE' ? 'Phone Call' : formData.activityType === 'EMAIL' ? 'Email Sent' : 'Site Visit';
        activityContent = `[${activityLabel}] ${formData.content}`;
        if (formData.smsContent) {
          activityContent += `\n\nSMS Sent: ${formData.smsContent}`;
        }
        if (formData.reminderSet) {
          activityContent += `\n\nNext Reminder: ${formData.nextFollowUp}`;
        }
      }

      if (type === 'APPOINTMENT') {
        await leadService.createAppointment({
          leadId: lead.id,
          appointmentDate: formData.nextFollowUp,
          comments: formData.content
        });
        onSuccess();
        onClose();
        return;
      }

      await leadService.addLeadActivity(lead.id, {
        type: type === 'FOLLOWUP' ? (formData.activityType || 'PHONE') : formData.type || 'NOTE',
        content: activityContent
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error recording action:', error);
      alert('Failed to record action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch (type) {
      case 'FOLLOWUP': return 'Record Follow-up';
      case 'REMINDER': return 'Set Reminder';
      case 'STATUS': return 'Change Status';
      case 'APPOINTMENT': return 'Book Appointment';
      case 'SWITCH_USER': return 'Assign Lead';
      default: return 'Add Internal Note';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'FOLLOWUP': return <Activity className="w-6 h-6" />;
      case 'REMINDER': return <Bell className="w-6 h-6" />;
      case 'STATUS': return <CheckCircle className="w-6 h-6" />;
      case 'APPOINTMENT': return <Calendar className="w-6 h-6" />;
      case 'SWITCH_USER': return <User className="w-6 h-6" />;
      default: return <MessageSquare className="w-6 h-6" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#3b3e47] p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/10 rounded-lg">
                {getIcon()}
             </div>
             <div>
                <h3 className="text-xl font-bold font-rubik uppercase tracking-tight">{getTitle()}</h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Action Matrix Protocol</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex items-center gap-4 mb-4">
             <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <User size={20} />
             </div>
             <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Targeting Lead</p>
                <h4 className="text-sm font-black text-[#313a46]">{lead.name}</h4>
             </div>
          </div>

          {type === 'SWITCH_USER' ? (
            <div className="space-y-4">
               <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  Assign To User <span className="text-brand font-bold">*</span>
                </label>
                <select 
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                  value={formData.targetUserId}
                  onChange={(e) => setFormData({...formData, targetUserId: e.target.value})}
                >
                  <option value="">Select User</option>
                  {masters?.users?.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              {type === 'FOLLOWUP' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      Activity Type <span className="text-brand font-bold">*</span>
                    </label>
                    <select 
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                      value={formData.activityType}
                      onChange={(e) => setFormData({...formData, activityType: e.target.value})}
                    >
                      <option value="">-Select-</option>
                      <option value="PHONE">Phone Call</option>
                      <option value="EMAIL">Email Sent</option>
                      <option value="VISIT">Site Visit</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      Target Status <span className="text-brand font-bold">*</span>
                    </label>
                    <select 
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                      value={formData.statusId}
                      onChange={(e) => setFormData({...formData, statusId: e.target.value})}
                    >
                      <option value="">-Select-</option>
                      {masters?.statuses?.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {type === 'FOLLOWUP' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    SMS Content (Optional)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Draft message for lead..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46] resize-none"
                    value={formData.smsContent}
                    onChange={(e) => setFormData({...formData, smsContent: e.target.value})}
                  />
                </div>
              )}

              {type === 'FOLLOWUP' && (
                 <div className="border-t border-gray-100 pt-6 space-y-6">
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                       <h4 className="text-[11px] font-black text-[#313a46] uppercase tracking-widest font-rubik">Schedule Next Action</h4>
                       <input 
                         type="checkbox" 
                         checked={formData.reminderSet}
                         onChange={(e) => setFormData({...formData, reminderSet: e.target.checked})}
                         className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
                       />
                    </div>

                    {formData.reminderSet && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              Assign Next Task To
                            </label>
                            <select 
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                              value={formData.reminderAssignTo}
                              onChange={(e) => setFormData({...formData, reminderAssignTo: e.target.value})}
                            >
                              <option value="">-Select-</option>
                              {masters?.users?.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              Scheduled Date <span className="text-brand font-bold">*</span>
                            </label>
                            <input 
                              type="date"
                              required
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                              value={formData.nextFollowUp}
                              onChange={(e) => setFormData({...formData, nextFollowUp: e.target.value})}
                            />
                          </div>
                        </div>
                      </>
                    )}
                 </div>
              )}

              {(type === 'STATUS' || type === 'REMINDER' || type === 'APPOINTMENT') && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    {type === 'STATUS' ? 'Transition Schedule Date' : 'Target Schedule Date'}
                  </label>
                  <input 
                    type="date"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46]"
                    value={formData.nextFollowUp}
                    onChange={(e) => setFormData({...formData, nextFollowUp: e.target.value})}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  Action specific Notes / Comment
                </label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Record summary of this interaction..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all font-bold text-[#313a46] resize-none"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                />
              </div>
            </>
          )}

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-4 rounded-xl border border-gray-200 text-gray-400 font-bold text-[10px] hover:bg-gray-50 transition-all uppercase tracking-[0.2em] font-rubik"
            >
              Abort Action
            </button>
            <button 
              disabled={isSubmitting}
              type="submit"
              className="flex-1 px-6 py-4 rounded-xl bg-brand text-white font-bold text-[10px] hover:bg-[#004d30] transition-all uppercase tracking-[0.2em] font-rubik flex items-center justify-center gap-3 shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
              ) : (
                <>Execute Protocol <Send size={14} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActionModal;
