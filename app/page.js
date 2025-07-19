// app/page.js
"use client";

import React, { useState, useCallback } from "react";
import Script from "next/script";
import { initialCompanies } from "../lib/data";
import { QrCodeIcon } from "../components/icons";
import Dashboard from "../components/dashboard";
import BarcodeScannerPage from "../components/scanner";
import ColumnMappingModal from "../components/ColMapModal";

// For simplicity, we define the UI components here. In a real project, you'd use the shadcn-cli.
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm ${className}`}
  >
    {children}
  </div>
);
const CardHeader = ({ children, className = "" }) => (
  <div className={`p-6 flex flex-col space-y-1.5 ${className}`}>{children}</div>
);
const CardTitle = ({ children, className = "" }) => (
  <h3
    className={`text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white ${className}`}
  >
    {children}
  </h3>
);
const CardDescription = ({ children, className = "" }) => (
  <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
    {children}
  </p>
);
const CardContent = ({ children, className = "" }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);
const CardFooter = ({ children, className = "" }) => (
  <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>
);
const Button = ({
  children,
  onClick,
  className = "",
  variant = "default",
  as: Component = "button",
  disabled,
}) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950";
  const variantClasses = {
    default:
      "bg-gray-900 text-white hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90",
    outline:
      "border border-gray-200 bg-transparent hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-50",
  };
  return (
    <Component
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </Component>
  );
};
const Table = ({ children, className = "" }) => (
  <div className="relative w-full overflow-auto">
    <table className={`w-full caption-bottom text-sm ${className}`}>
      {children}
    </table>
  </div>
);
const TableHeader = ({ children, className = "" }) => (
  <thead className={`[&_tr]:border-b ${className}`}>{children}</thead>
);
const TableBody = ({ children, className = "" }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`}>
    {children}
  </tbody>
);
const TableRow = ({ children, className = "" }) => (
  <tr
    className={`border-b transition-colors hover:bg-gray-100/50 data-[state=selected]:bg-gray-100 dark:hover:bg-gray-800/50 dark:data-[state=selected]:bg-gray-800 ${className}`}
  >
    {children}
  </tr>
);
const TableHead = ({ children, className = "" }) => (
  <th
    className={`h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0 dark:text-gray-400 ${className}`}
  >
    {children}
  </th>
);
const TableCell = ({ children, className = "" }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </td>
);
const Badge = ({ children, className = "", variant = "default" }) => {
  const variantClasses = {
    default:
      "border-transparent bg-gray-900 text-gray-50 hover:bg-gray-900/80 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/80",
    success:
      "border-transparent bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    secondary:
      "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-800/80",
  };
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

const uiComponents = {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
};

export default function Home() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState(initialCompanies);
  const [attendance, setAttendance] = useState({});
  const [isScannerScriptLoaded, setIsScannerScriptLoaded] = useState(false);
  const [isXlsxScriptLoaded, setIsXlsxScriptLoaded] = useState(false);
  const [modalData, setModalData] = useState({
    isOpen: false,
    companyId: null,
    file: null,
    headers: [],
  });

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setCurrentPage("scanner");
  };

  const handleBackToDashboard = () => {
    setCurrentPage("dashboard");
    setSelectedCompany(null);
  };

  const handleMarkAttendance = useCallback(
    (companyId, studentId) => {
      const company = companies.find((c) => c.id === companyId);
      if (!company?.students.some((s) => s.id === studentId)) {
        console.warn(
          `Student ID ${studentId} not found for company ${company.name}`
        );
        return;
      }
      setAttendance((prev) => {
        const companyAttendance = prev[companyId] || [];
        if (companyAttendance.some((att) => att.studentId === studentId))
          return prev;
        const newAttendance = [
          ...companyAttendance,
          { studentId, timestamp: new Date().toISOString() },
        ];
        return { ...prev, [companyId]: newAttendance };
      });
    },
    [companies]
  );

  const handleFileUpload = (companyId, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = json[0] || [];
        setModalData({ isOpen: true, companyId, file, headers });
      } catch (error) {
        console.error("Error reading Excel file headers:", error);
        alert(
          "Failed to read the Excel file. It might be corrupted or in an unsupported format."
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleModalClose = () => {
    setModalData({ isOpen: false, companyId: null, file: null, headers: [] });
  };

  const handleColumnMappingSubmit = (mapping) => {
    const { companyId, file } = modalData;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet);

        const newStudents = json.map((row, index) => ({
          id: String(row[mapping.id] || `MISSING_ID_${index}`),
          name: String(row[mapping.name] || "N/A"),
          roll: String(row[mapping.roll] || ""),
          department: String(row[mapping.department] || ""),
        }));

        setCompanies((prevCompanies) =>
          prevCompanies.map((company) =>
            company.id === companyId
              ? { ...company, students: newStudents }
              : company
          )
        );
        alert(
          `Successfully uploaded and mapped ${newStudents.length} students.`
        );
        handleModalClose();
      } catch (error) {
        console.error("Error parsing Excel file with mapping:", error);
        alert(
          "Failed to parse the Excel file. Please ensure the file and mapping are correct."
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const DashboardWithUI = (props) => <Dashboard {...props} {...uiComponents} />;
  const BarcodeScannerPageWithUI = (props) => (
    <BarcodeScannerPage {...props} {...uiComponents} />
  );
  const ColumnMappingModalWithUI = (props) => (
    <ColumnMappingModal {...props} {...uiComponents} />
  );

  return (
    <>
      <Script
        src="https://unpkg.com/html5-qrcode"
        strategy="afterInteractive"
        onLoad={() => setIsScannerScriptLoaded(true)}
      />
      <Script
        src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"
        strategy="afterInteractive"
        onLoad={() => setIsXlsxScriptLoaded(true)}
      />

      <ColumnMappingModalWithUI
        isOpen={modalData.isOpen}
        onClose={handleModalClose}
        headers={modalData.headers}
        onSubmit={handleColumnMappingSubmit}
      />

      <div className="bg-gray-50 dark:bg-black min-h-screen text-gray-800 dark:text-gray-200 font-sans">
        <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
          <nav className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCodeIcon className="h-6 w-6 text-gray-900 dark:text-white" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Placement Attendance
              </h1>
            </div>
          </nav>
        </header>

        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          {currentPage === "dashboard" && (
            <DashboardWithUI
              companies={companies}
              onSelectCompany={handleSelectCompany}
              onFileUpload={handleFileUpload}
              isXlsxScriptLoaded={isXlsxScriptLoaded}
              attendance={attendance}
            />
          )}
          {currentPage === "scanner" && selectedCompany && (
            <BarcodeScannerPageWithUI
              company={selectedCompany}
              onBack={handleBackToDashboard}
              attendance={attendance}
              onMarkAttendance={handleMarkAttendance}
              isScriptLoaded={isScannerScriptLoaded}
            />
          )}
        </main>
      </div>
    </>
  );
}
