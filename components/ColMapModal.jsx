// components/ColumnMappingModal.jsx
import React, { useState } from "react";

// This component receives UI primitives as props from the main page
export default function ColumnMappingModal({
  isOpen,
  onClose,
  headers,
  onSubmit,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
}) {
  // State to hold the current mapping selections
  const [mapping, setMapping] = useState({
    name: "",
    rollNumber: "",
  });

  if (!isOpen) return null;

  const handleSelectChange = (e, field) => {
    setMapping((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleConfirm = () => {
    // Validate required fields
    const missingFields = [];
    if (!mapping.name || mapping.name === "") {
      missingFields.push("Student Name");
    }
    if (!mapping.rollNumber || mapping.rollNumber === "") {
      missingFields.push("Roll Number");
    }

    if (missingFields.length > 0) {
      alert(`Please map the following required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Check if the same column is mapped to multiple fields
    const usedColumns = Object.values(mapping).filter(val => val !== "");
    const uniqueColumns = [...new Set(usedColumns)];
    if (usedColumns.length !== uniqueColumns.length) {
      alert("Each Excel column can only be mapped to one field. Please check your selections.");
      return;
    }

    onSubmit(mapping);
  };

  const requiredFields = [
    { key: "name", label: "Student Name (Required)" },
    { key: "rollNumber", label: "Roll Number (Required)" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Map Excel Columns</CardTitle>
          <CardDescription>
            Match the columns from your Excel file to the required student data fields.
            The system will automatically find admission numbers using roll numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {headers.length > 0 ? (
            <>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Detected columns from your Excel file:
                </p>
                <div className="flex flex-wrap gap-1">
                  {headers.map((h) => (
                    <Badge key={h} variant="secondary" className="text-xs">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
              {requiredFields.map((field) => (
                <div
                  key={field.key}
                  className="grid grid-cols-3 items-center gap-4"
                >
                  <label className="text-sm font-medium">{field.label}</label>
                  <select
                    value={mapping[field.key]}
                    onChange={(e) => handleSelectChange(e, field.key)}
                    className="col-span-2 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-red-600 dark:text-red-400 font-medium">
                No columns detected in the Excel file
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Please ensure the Excel file has a header row with column names.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={headers.length === 0}
            className={headers.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
          >
            Confirm Mapping
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
