// components/dashboard.jsx
import React, { useRef } from "react";
// Import the CheckCircleIcon for displaying the presentee count
import { UsersIcon, QrCodeIcon, UploadIcon, CheckCircleIcon } from "./icons";

export default function Dashboard({
  companies,
  onSelectCompany,
  onFileUpload,
  isXlsxScriptLoaded,
  attendance, // Receive attendance data as a prop
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
}) {
  const fileInputRef = useRef(null);
  const selectedCompanyIdRef = useRef(null);

  const statusStyles = {
    Active:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "In Progress":
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  };

  const handleUploadClick = (companyId) => {
    selectedCompanyIdRef.current = companyId;
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && selectedCompanyIdRef.current) {
      onFileUpload(selectedCompanyIdRef.current, file);
    }
    e.target.value = null; // Reset input to allow re-uploading the same file
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Company Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage placement activities for all companies.
        </p>
      </div>

      {/* Hidden file input accessible via a ref */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
      />

      {/* Responsive Grid Layout for Company Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {companies.map((company) => {
          // Calculate present count for the current company
          const presentCount = attendance[company.id]?.length || 0;

          return (
            <Card key={company.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{company.name}</CardTitle>
                  <Badge
                    variant="secondary"
                    className={`${
                      statusStyles[company.status] || statusStyles["Inactive"]
                    } border-none`}
                  >
                    {company.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-2">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <UsersIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>{company.students.length} Students Registered</span>
                </div>
                <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>{presentCount} Students Present</span>
                </div>
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className={`w-full h-10 px-4 ${
                    !isXlsxScriptLoaded ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => handleUploadClick(company.id)}
                  disabled={!isXlsxScriptLoaded}
                >
                  <UploadIcon className="h-4 w-4 mr-2" />
                  {isXlsxScriptLoaded ? "Upload" : "..."}
                </Button>
                <Button
                  onClick={() => onSelectCompany(company)}
                  className="w-full h-10 px-4"
                >
                  <QrCodeIcon className="h-4 w-4 mr-2" />
                  Scan
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
