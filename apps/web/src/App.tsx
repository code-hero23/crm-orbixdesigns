import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadHub from './pages/LeadHub';
import Customers from './pages/Customers';
import Tasks from './pages/Tasks';
import ClosedTasks from './pages/ClosedTasks';
import Appointments from './pages/Appointments';
import Visits from './pages/Visits';
import Users from './pages/Users';
import Profile from './pages/Profile';
import SignaturePhoto from './pages/SignaturePhoto';
import Login from './pages/Login';
import MasterDataView from './pages/MasterDataView';
import BankDetails from './pages/BankDetails';
import LeadStatus from './pages/LeadStatus';
import TemplateManagement from './pages/TemplateManagement';
import Report from './pages/Report';
import Reminders from './pages/Reminders';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-[#F4F7FA]">
      <Navbar />
      <div className="wrapper py-4">
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/leadhub" element={<ProtectedRoute><LeadHub /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/closed-tasks" element={<ProtectedRoute><ClosedTasks /></ProtectedRoute>} />
          <Route path="/visits" element={<ProtectedRoute><Visits /></ProtectedRoute>} />
          <Route path="/appointment" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/signature-photos" element={<ProtectedRoute><SignaturePhoto /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
          
          {/* Master Data Routes */}
          <Route path="/master/bank-details" element={<ProtectedRoute><BankDetails /></ProtectedRoute>} />
          <Route path="/master/lead-status" element={<ProtectedRoute><LeadStatus /></ProtectedRoute>} />
          <Route path="/master/stages" element={<ProtectedRoute><MasterDataView title="Stages" type="stage" apiKey="stages" /></ProtectedRoute>} />
          <Route path="/master/source" element={<ProtectedRoute><MasterDataView title="Source" type="source" apiKey="sources" /></ProtectedRoute>} />
          <Route path="/master/split-up" element={<ProtectedRoute><MasterDataView title="Split Up" type="splitUp" apiKey="splitUps" /></ProtectedRoute>} />
          <Route path="/master/activity" element={<ProtectedRoute><MasterDataView title="Activity Types" type="activityType" apiKey="activityTypes" /></ProtectedRoute>} />
          <Route path="/master/salutation" element={<ProtectedRoute><MasterDataView title="Salutation" type="salutation" apiKey="salutations" /></ProtectedRoute>} />
          <Route path="/master/lead-tag" element={<ProtectedRoute><MasterDataView title="Lead Tags" type="leadTag" apiKey="leadTags" /></ProtectedRoute>} />
          <Route path="/master/showroom" element={<ProtectedRoute><MasterDataView title="Showroom" type="showroom" apiKey="showrooms" /></ProtectedRoute>} />
          <Route path="/master/scope-of-work" element={<ProtectedRoute><MasterDataView title="Scope of Work" type="scopeOfWork" apiKey="scopeOfWorks" /></ProtectedRoute>} />
          <Route path="/master/vendor-source" element={<ProtectedRoute><MasterDataView title="Vendor Source" type="vendorSource" apiKey="vendorSources" /></ProtectedRoute>} />
          <Route path="/master/payment-mode" element={<ProtectedRoute><MasterDataView title="Payment Mode" type="paymentMode" apiKey="paymentModes" /></ProtectedRoute>} />
          <Route path="/master/production-hold" element={<ProtectedRoute><MasterDataView title="Production Hold" type="productionHold" apiKey="productionHolds" /></ProtectedRoute>} />
          <Route path="/master/work-notification" element={<ProtectedRoute><MasterDataView title="Work Notification" type="workNotification" apiKey="workNotifications" /></ProtectedRoute>} />
          <Route path="/master/project" element={<ProtectedRoute><MasterDataView title="Projects" type="project" apiKey="projects" /></ProtectedRoute>} />
          <Route path="/master/brand" element={<ProtectedRoute><MasterDataView title="Brands" type="brand" apiKey="brands" /></ProtectedRoute>} />
          <Route path="/master/sms-template" element={<ProtectedRoute><TemplateManagement title="SMS Templates" type="smsTemplate" /></ProtectedRoute>} />
          <Route path="/master/email-template" element={<ProtectedRoute><TemplateManagement title="Email Templates" type="emailTemplate" /></ProtectedRoute>} />
          
          <Route path="*" element={<ProtectedRoute><div className="p-10 text-center text-gray-400 font-bold uppercase tracking-widest bg-white border border-gray-100 shadow-sm mt-10">Module Under Construction</div></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
