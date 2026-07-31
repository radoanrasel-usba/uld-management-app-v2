import React, { useState, useEffect } from 'react';
import { STATIONS, ULD } from '../types';
import { Plane, List, RefreshCw, AlertTriangle, UserCheck, Shield, ChevronRight, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface DashboardProps {
  ulds: ULD[];
  user: any;
  userProfile: any;
  onActionClick: (action: 'add' | 'status' | 'send' | 'receive' | 'remove') => void;
  onAdminClick: () => void;
  onLogout: () => void;
  onRefreshData: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info', actionName?: string) => void;
}

export default function Dashboard({
  ulds,
  user,
  userProfile,
  onActionClick,
  onAdminClick,
  onLogout,
  onRefreshData,
  showToast
}: DashboardProps) {
  const [checklistType, setChecklistType] = useState<'total' | 'dhaka' | 'outstation' | null>(null);
  const [checklistSearch, setChecklistSearch] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-GB');
    } catch {
      return '-';
    }
  };

  const downloadPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const subtitle = checklistType === 'total' ? 'Total Fleet Inventory Checklist' :
                     checklistType === 'dhaka' ? 'Dhaka Warehouse Stock Registry' :
                     'Outstation Logistics Stocks Summary';

    // Header Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(14, 165, 233); // Sky-500
    doc.text('US BANGLA AIRLINES', 105, 20, { align: 'center' });

    // Subtitle
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(subtitle, 105, 27, { align: 'center' });

    // Date & Time
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | Operator: ${userProfile?.email || user?.email}`, 105, 33, { align: 'center' });

    // Divider Line
    doc.setDrawColor(203, 213, 225); // border-slate-300
    doc.line(15, 37, 195, 37);

    // Get the filtered ULDs
    const activeUlds = (
      checklistType === 'total' ? ulds :
      checklistType === 'dhaka' ? ulds.filter(u => u.currentStation === 'DAC') :
      ulds.filter(u => u.currentStation !== 'DAC')
    );

    const stationsToInclude = (
      checklistType === 'dhaka' ? ['DAC'] :
      checklistType === 'outstation' ? STATIONS.filter(s => s !== 'DAC') :
      STATIONS
    ).filter((station) => {
      const count = activeUlds.filter(u => u.currentStation === station).length;
      return count > 0;
    });

    let currentY = 45;

    stationsToInclude.forEach((station) => {
      const sAkes = activeUlds.filter(u => u.currentStation === station && u.type === 'AKE').sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }));
      const sPmcs = activeUlds.filter(u => u.currentStation === station && u.type === 'PMC').sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }));
      
      const akeCountStr = sAkes.length.toString().padStart(2, '0');
      const pmcCountStr = sPmcs.length.toString().padStart(2, '0');
      
      // Page space safety check (heading + header + at least 1 row = 25mm)
      if (currentY > 255) {
        doc.addPage();
        currentY = 20;
      }

      // Draw Station Header Banner
      doc.setFillColor(15, 23, 42); // slate-900 (very dark elegant color)
      doc.rect(15, currentY, 180, 8.5, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`STATION-${station} (ake-${akeCountStr}/pmc-${pmcCountStr})`, 20, currentY + 6);
      currentY += 8.5;

      // Draw Side-by-Side Table Headers
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(15, currentY, 180, 7.5, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      
      // Left side headers (AKE)
      doc.text('S/L', 18, currentY + 5);
      doc.text('AKE SERIAL', 30, currentY + 5);
      doc.text('DATE', 75, currentY + 5);
      
      // Vertical separator line in the middle
      doc.setDrawColor(203, 213, 225);
      doc.line(105, currentY, 105, currentY + 7.5);
      
      // Right side headers (PMC)
      doc.text('S/L', 108, currentY + 5);
      doc.text('PMC SERIAL', 120, currentY + 5);
      doc.text('DATE', 165, currentY + 5);
      
      currentY += 7.5;

      const maxRows = Math.max(sAkes.length, sPmcs.length);
      
      if (maxRows === 0) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('No active or damaged units registered at this station.', 20, currentY + 5);
        currentY += 8;
      } else {
        for (let i = 0; i < maxRows; i++) {
          // Page check inside row loop
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
            
            // Draw Continuation Banner
            doc.setFillColor(15, 23, 42);
            doc.rect(15, currentY, 180, 8.5, 'F');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(`STATION-${station} (Continued)`, 20, currentY + 6);
            currentY += 8.5;
            
            // Draw Columns Header again
            doc.setFillColor(241, 245, 249);
            doc.rect(15, currentY, 180, 7.5, 'F');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text('S/L', 18, currentY + 5);
            doc.text('AKE SERIAL', 30, currentY + 5);
            doc.text('DATE', 75, currentY + 5);
            doc.line(105, currentY, 105, currentY + 7.5);
            doc.text('S/L', 108, currentY + 5);
            doc.text('PMC SERIAL', 120, currentY + 5);
            doc.text('DATE', 165, currentY + 5);
            currentY += 7.5;
          }

          // Shading for alternating rows
          if (i % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, currentY, 180, 7, 'F');
          }

          // Draw vertical middle divider line for clean grid
          doc.setDrawColor(241, 245, 249);
          doc.line(105, currentY, 105, currentY + 7);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8.5);
          
          // Draw Left Cell (AKE)
          if (i < sAkes.length) {
            const ake = sAkes[i];
            doc.setTextColor(71, 85, 105);
            doc.text(String(i + 1), 18, currentY + 5);
            
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(ake.number, 30, currentY + 5);
            
            doc.setFont('Helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(formatDate(ake.updatedAt || ake.createdAt), 75, currentY + 5);
          }

          doc.setFont('Helvetica', 'normal');
          
          // Draw Right Cell (PMC)
          if (i < sPmcs.length) {
            const pmc = sPmcs[i];
            doc.setTextColor(71, 85, 105);
            doc.text(String(i + 1), 108, currentY + 5);
            
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(pmc.number, 120, currentY + 5);
            
            doc.setFont('Helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(formatDate(pmc.updatedAt || pmc.createdAt), 165, currentY + 5);
          }

          currentY += 7;
        }
      }
      
      // Leave space between station blocks
      currentY += 8;
    });

    const fileName = `${subtitle.toLowerCase().replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('en-GB', { hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute metrics dynamically from current live database
  const totalAkeActive = ulds.filter(u => u.type === 'AKE' && u.status === 'ACTIVE').length;
  const totalAkeDamaged = ulds.filter(u => u.type === 'AKE' && u.status === 'DAMAGED').length;
  const totalPmcActive = ulds.filter(u => u.type === 'PMC' && u.status === 'ACTIVE').length;
  const totalPmcDamaged = ulds.filter(u => u.type === 'PMC' && u.status === 'DAMAGED').length;

  const dhakaAke = ulds.filter(u => u.currentStation === 'DAC' && u.type === 'AKE').length;
  const dhakaPmc = ulds.filter(u => u.currentStation === 'DAC' && u.type === 'PMC').length;

  const outstationAke = ulds.filter(u => u.currentStation !== 'DAC' && u.type === 'AKE').length;
  const outstationPmc = ulds.filter(u => u.currentStation !== 'DAC' && u.type === 'PMC').length;

  // Compute stock per station for outstation report
  const outstationsList = STATIONS.filter(s => s !== 'DAC');

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 w-full max-w-7xl mx-auto">
      
      {/* Header Title Board */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold font-display text-white tracking-tight">
            SYSTEM CONTROL OVERVIEW
          </h1>
          <p className="text-sm font-semibold text-sky-400 font-mono tracking-widest uppercase mt-1">
            US-BANGLA AIRLINES &bull; FLEET LOGISTICS HUB
          </p>
        </div>

        {/* User profile & dynamic clock metadata rail */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
          <span className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
            <UserCheck className="h-4 w-4 text-sky-400" />
            OPERATOR: {userProfile?.email || user?.email}
          </span>
          <span className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
            ROLE: <span className="text-sky-400 font-bold">{userProfile?.role?.toUpperCase() || 'USER'}</span>
          </span>
          <span className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-amber-500 font-bold">
            SYSTEM TIME: {currentTime}
          </span>
        </div>
      </div>

      {/* Dynamic Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Metric summary dashboards */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TOTAL AKE & PMC CHECKLIST */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
              <span className="font-bold text-sm uppercase tracking-wider text-slate-400 font-mono">TOTAL AKE & PMC STOCKS</span>
              <button
                onClick={() => setChecklistType('total')}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold font-mono text-sm uppercase py-1.5 px-3.5 rounded transition"
              >
                CHECKLIST
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* AKE SUMMARY */}
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/30">
                <h3 className="text-sm font-bold text-slate-400 uppercase font-mono tracking-wider mb-2 text-center">TOTAL AKE UNITS</h3>
                <div className="text-center font-mono py-2 bg-slate-950/40 border border-slate-800/40 rounded-lg">
                  <span className="text-slate-400 text-sm">ACTIVE: </span>
                  <span className="text-lg font-bold text-emerald-400">{totalAkeActive}</span>
                  <span className="text-slate-600 mx-2">|</span>
                  <span className="text-slate-400 text-sm">DAMAGED: </span>
                  <span className="text-lg font-bold text-red-400">{totalAkeDamaged}</span>
                </div>
              </div>

              {/* PMC SUMMARY */}
              <div className="p-5 bg-slate-900/30">
                <h3 className="text-sm font-bold text-slate-400 uppercase font-mono tracking-wider mb-2 text-center">TOTAL PMC UNITS</h3>
                <div className="text-center font-mono py-2 bg-slate-950/40 border border-slate-800/40 rounded-lg">
                  <span className="text-slate-400 text-sm">ACTIVE: </span>
                  <span className="text-lg font-bold text-emerald-400">{totalPmcActive}</span>
                  <span className="text-slate-600 mx-2">|</span>
                  <span className="text-slate-400 text-sm">DAMAGED: </span>
                  <span className="text-lg font-bold text-red-400">{totalPmcDamaged}</span>
                </div>
              </div>
            </div>
          </div>

          {/* STOCKS SPLIT CARDS (Dhaka Stock vs Outstation Stock) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Dhaka Stock Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between">
              <div className="p-5 space-y-4">
                <h3 className="text-center font-bold text-xs uppercase tracking-wider font-mono text-slate-400">DHAKA HEADQUARTERS</h3>
                <div className="text-center font-mono py-3 bg-slate-950/50 border border-slate-800/60 rounded-lg">
                  <span className="text-slate-400 text-xs">AKE: </span>
                  <span className="text-lg font-bold text-white">{dhakaAke}</span>
                  <span className="text-slate-600 mx-3">/</span>
                  <span className="text-slate-400 text-xs">PMC: </span>
                  <span className="text-lg font-bold text-white">{dhakaPmc}</span>
                </div>
              </div>
              <button
                onClick={() => setChecklistType('dhaka')}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold font-mono text-xs uppercase py-2.5 transition border-t border-sky-500/20"
              >
                CHECKLIST
              </button>
            </div>

            {/* Outstation Stock Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between">
              <div className="p-5 space-y-4">
                <h3 className="text-center font-bold text-xs uppercase tracking-wider font-mono text-slate-400">OUTSTATION STATIONS</h3>
                <div className="text-center font-mono py-3 bg-slate-950/50 border border-slate-800/60 rounded-lg">
                  <span className="text-slate-400 text-xs">AKE: </span>
                  <span className="text-lg font-bold text-white">{outstationAke}</span>
                  <span className="text-slate-600 mx-3">/</span>
                  <span className="text-slate-400 text-xs">PMC: </span>
                  <span className="text-lg font-bold text-white">{outstationPmc}</span>
                </div>
              </div>
              <button
                onClick={() => setChecklistType('outstation')}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold font-mono text-xs uppercase py-2.5 transition border-t border-sky-500/20"
              >
                CHECKLIST
              </button>
            </div>

          </div>

          {/* OUTSTATION STOCK REPORT TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5">
            <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono">OUTSTATION STOCK REGISTRY</span>
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <Plane className="h-3.5 w-3.5 text-sky-500" />
                DATE: {new Date().toLocaleDateString('en-GB')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-sm md:text-base font-bold text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs md:text-sm font-bold uppercase tracking-wider">
                    <th className="pb-3">S/L</th>
                    <th className="pb-3">STATION</th>
                    <th className="pb-3">AKE STOCK</th>
                    <th className="pb-3">PMC STOCK</th>
                    <th className="pb-3 text-right">TOTAL CAPACITY</th>
                    <th className="pb-3 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {outstationsList
                    .filter(station => {
                      const totalCount = ulds.filter(u => u.currentStation === station).length;
                      return totalCount > 0;
                    })
                    .map((station, i) => {
                      const sAke = ulds.filter(u => u.currentStation === station && u.type === 'AKE').length;
                      const sPmc = ulds.filter(u => u.currentStation === station && u.type === 'PMC').length;
                      const sTotal = sAke + sPmc;

                      // Get status based on AKE stock count per station: >=21 GOOD, <21 POOR
                      const getStationStatus = (ake: number) => {
                        if (ake >= 21) {
                          return { text: "GOOD", color: "text-emerald-400", dot: "bg-emerald-500" };
                        } else {
                          return { text: "POOR", color: "text-amber-400 font-bold", dot: "bg-amber-400 animate-pulse" };
                        }
                      };

                      const statusInfo = getStationStatus(sAke);

                      return (
                        <tr key={station} className="hover:bg-slate-800/30 text-sm md:text-base font-bold">
                          <td className="py-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-3 font-extrabold text-sky-400">{station}</td>
                          <td className="py-3 text-slate-100 font-extrabold">{sAke}</td>
                          <td className="py-3 text-slate-100 font-extrabold">{sPmc}</td>
                          <td className="py-3 font-extrabold text-white text-right">{sTotal}</td>
                          <td className="py-3 text-right">
                            <span className={`inline-block h-2 w-2 rounded-full mr-2 ${statusInfo.dot}`} />
                            <span className={`text-xs md:text-sm font-extrabold ${statusInfo.color}`}>
                              {statusInfo.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Control Hub Side Action buttons */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-center text-xs text-sky-400 uppercase font-semibold">
            CONTROL PLATFORM HUB
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => onActionClick('add')}
              id="add-new-btn"
              disabled={userProfile?.role !== 'admin'}
              className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs tracking-wider uppercase py-3 rounded-xl shadow-md transition duration-150 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ADD NEW ULD {userProfile?.role !== 'admin' && '🔒 (ADMIN ONLY)'}
            </button>

            <button
              onClick={() => onActionClick('status')}
              id="change-status-btn"
              disabled={userProfile?.role === 'visitor'}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs tracking-wider uppercase py-3 rounded-xl border border-slate-800 transition duration-150 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CHANGE ULD STATUS {userProfile?.role === 'visitor' && '🔒 (FORBIDDEN FOR VISITOR)'}
            </button>

            <button
              onClick={() => onActionClick('send')}
              id="send-btn"
              disabled={userProfile?.role === 'visitor'}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs tracking-wider uppercase py-3 rounded-xl border border-slate-800 transition duration-150 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              SEND TRANSIT (DAC to OUT) {userProfile?.role === 'visitor' && '🔒 (FORBIDDEN FOR VISITOR)'}
            </button>

            <button
              onClick={() => onActionClick('receive')}
              id="receive-btn"
              disabled={userProfile?.role === 'visitor'}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs tracking-wider uppercase py-3 rounded-xl border border-slate-800 transition duration-150 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              RECEIVE TRANSIT (OUT to DAC) {userProfile?.role === 'visitor' && '🔒 (FORBIDDEN FOR VISITOR)'}
            </button>

            <button
              onClick={onRefreshData}
              id="save-update-btn"
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-350 font-bold text-xs tracking-wider uppercase py-3 rounded-xl border border-slate-800 transition duration-150 cursor-pointer text-center flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>SYNC REFRESH</span>
            </button>

            <button
              onClick={() => onActionClick('remove')}
              id="remove-btn"
              disabled={userProfile?.role !== 'admin'}
              className="w-full bg-red-950/40 hover:bg-red-900/30 text-red-400 font-bold text-xs tracking-wider uppercase py-3 rounded-xl border border-red-900/30 transition duration-150 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              DE-REGISTER AKE/PMC {userProfile?.role !== 'admin' && '🔒 (ADMIN ONLY)'}
            </button>

            <button
              onClick={onAdminClick}
              id="admin-panel-btn"
              disabled={userProfile?.role === 'visitor'}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs tracking-wider uppercase py-3 rounded-xl border border-slate-800 transition duration-150 cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Shield className="h-3.5 w-3.5 text-sky-500" />
              <span>SECURITY HUB {userProfile?.role === 'visitor' && '🔒'}</span>
            </button>
          </div>

        </div>

      </div>

      {/* RENDER DYNAMIC STOCKS CHECKLIST MODAL */}
      {checklistType && (() => {
        const modalActiveUlds = (
          checklistType === 'total' ? ulds :
          checklistType === 'dhaka' ? ulds.filter(u => u.currentStation === 'DAC') :
          ulds.filter(u => u.currentStation !== 'DAC')
        );

        const stationsToDisplay = (
          checklistType === 'dhaka' ? ['DAC'] :
          checklistType === 'outstation' ? STATIONS.filter(s => s !== 'DAC') :
          STATIONS
        ).filter(station => {
          return modalActiveUlds.some(u => u.currentStation === station);
        });

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
              
              <div className="border-b border-slate-800 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white uppercase font-mono tracking-wide">
                    {checklistType === 'total' && 'Total Fleet Inventory Checklist'}
                    {checklistType === 'dhaka' && 'Dhaka Warehouse Stock Registry'}
                    {checklistType === 'outstation' && 'Outstation Logistics Stocks Summary'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Active ULD records: {modalActiveUlds.length} units across {stationsToDisplay.length} station(s)
                  </p>
                </div>

                {/* Checklist Search Bar */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      placeholder="Search serial (e.g. AKE-1001, 1005)..."
                      value={checklistSearch}
                      onChange={(e) => setChecklistSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-3 pr-8 py-1.5 text-xs text-yellow-300 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 shadow-inner"
                    />
                    {checklistSearch && (
                      <button
                        onClick={() => setChecklistSearch('')}
                        className="absolute right-2.5 top-1.5 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={downloadPdf}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-[11px] uppercase py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/10 cursor-pointer self-stretch sm:self-center"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Download Report</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 space-y-6 pr-1.5">
                {stationsToDisplay.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-mono text-xs">
                    No active ULD stock records found for this checklist view.
                  </div>
                ) : (
                  stationsToDisplay.map((station) => {
                    const searchQ = checklistSearch.trim().toLowerCase();

                    const stationAkes = modalActiveUlds
                      .filter(u => u.currentStation === station && u.type === 'AKE')
                      .sort((a, b) => {
                        if (searchQ) {
                          const matchA = a.number.toLowerCase().includes(searchQ);
                          const matchB = b.number.toLowerCase().includes(searchQ);
                          if (matchA && !matchB) return -1;
                          if (!matchA && matchB) return 1;
                        }
                        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
                      });

                    const stationPmcs = modalActiveUlds
                      .filter(u => u.currentStation === station && u.type === 'PMC')
                      .sort((a, b) => {
                        if (searchQ) {
                          const matchA = a.number.toLowerCase().includes(searchQ);
                          const matchB = b.number.toLowerCase().includes(searchQ);
                          if (matchA && !matchB) return -1;
                          if (!matchA && matchB) return 1;
                        }
                        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
                      });

                    return (
                      <div key={station} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        {/* Station Header Banner */}
                        <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg flex justify-between items-center font-mono">
                          <span className="font-extrabold text-sky-400 text-sm tracking-wider">
                            STATION-{station}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            AKE: <span className="text-white">{stationAkes.length}</span> | PMC: <span className="text-white">{stationPmcs.length}</span>
                          </span>
                        </div>

                        {/* Two Column Grid for AKE and PMC lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: AKE List */}
                          <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3">
                            <div className="text-xs font-bold font-mono text-slate-300 pb-2 mb-2 border-b border-slate-800 flex justify-between">
                              <span>AKE SERIALS</span>
                              <span className="text-sky-400">{stationAkes.length} UNITS</span>
                            </div>
                            <table className="w-full text-left font-mono text-xs">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase">
                                  <th className="pb-1.5 w-8">S/L</th>
                                  <th className="pb-1.5">SERIAL NO</th>
                                  <th className="pb-1.5">DATE</th>
                                  <th className="pb-1.5 text-right">STATUS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {stationAkes.length === 0 ? (
                                  <tr><td colSpan={4} className="text-center py-3 text-slate-600 text-[11px]">No AKE units at {station}</td></tr>
                                ) : (
                                  stationAkes.map((uld, index) => {
                                    const isSearchMatch = searchQ !== '' && uld.number.toLowerCase().includes(searchQ);
                                    return (
                                      <tr
                                        key={uld.id}
                                        className={`transition-colors ${
                                          isSearchMatch
                                            ? 'bg-amber-950/60 border-l-4 border-amber-400 font-extrabold text-yellow-300'
                                            : 'hover:bg-slate-800/30'
                                        }`}
                                      >
                                        <td className="py-2 text-slate-500 text-[11px] px-1">{index + 1}</td>
                                        <td className={`py-2 font-extrabold text-sm tracking-wider font-mono ${isSearchMatch ? 'text-yellow-300 font-black' : 'text-white'}`}>
                                          {uld.number}
                                        </td>
                                        <td className="py-2 text-slate-300 font-mono text-[11px]">{formatDate(uld.updatedAt || uld.createdAt)}</td>
                                        <td className="py-2 text-right px-1">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                            uld.status === 'ACTIVE'
                                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                                              : 'bg-red-950 text-red-400 border border-red-900/40'
                                          }`}>
                                            {uld.status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Right: PMC List */}
                          <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3">
                            <div className="text-xs font-bold font-mono text-slate-300 pb-2 mb-2 border-b border-slate-800 flex justify-between">
                              <span>PMC SERIALS</span>
                              <span className="text-sky-400">{stationPmcs.length} UNITS</span>
                            </div>
                            <table className="w-full text-left font-mono text-xs">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-800 text-[10px] uppercase">
                                  <th className="pb-1.5 w-8">S/L</th>
                                  <th className="pb-1.5">SERIAL NO</th>
                                  <th className="pb-1.5">DATE</th>
                                  <th className="pb-1.5 text-right">STATUS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {stationPmcs.length === 0 ? (
                                  <tr><td colSpan={4} className="text-center py-3 text-slate-600 text-[11px]">No PMC units at {station}</td></tr>
                                ) : (
                                  stationPmcs.map((uld, index) => {
                                    const isSearchMatch = searchQ !== '' && uld.number.toLowerCase().includes(searchQ);
                                    return (
                                      <tr
                                        key={uld.id}
                                        className={`transition-colors ${
                                          isSearchMatch
                                            ? 'bg-amber-950/60 border-l-4 border-amber-400 font-extrabold text-yellow-300'
                                            : 'hover:bg-slate-800/30'
                                        }`}
                                      >
                                        <td className="py-2 text-slate-500 text-[11px] px-1">{index + 1}</td>
                                        <td className={`py-2 font-extrabold text-sm tracking-wider font-mono ${isSearchMatch ? 'text-yellow-300 font-black' : 'text-white'}`}>
                                          {uld.number}
                                        </td>
                                        <td className="py-2 text-slate-300 font-mono text-[11px]">{formatDate(uld.updatedAt || uld.createdAt)}</td>
                                        <td className="py-2 text-right px-1">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                            uld.status === 'ACTIVE'
                                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                                              : 'bg-red-950 text-red-400 border border-red-900/40'
                                          }`}>
                                            {uld.status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800 mt-4 shrink-0">
                <button
                  onClick={() => setChecklistType(null)}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
                >
                  CLOSE CHECKLIST
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
