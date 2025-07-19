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
    id: "",
    name: "",
    roll: "",
    department: "",
  });

  if (!isOpen) return null;

  const handleSelectChange = (e, field) => {
    setMapping((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleConfirm = () => {
    // Basic validation
    if (!mapping.id || !mapping.name) {
      alert("Please map at least the 'ID' and 'Name' fields.");
      return;
    }
    onSubmit(mapping);
  };

  const requiredFields = [
    { key: "id", label: "Student ID (Required)" },
    { key: "name", label: "Student Name (Required)" },
    { key: "roll", label: "Roll Number (Optional)" },
    { key: "department", label: "Department (Optional)" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Map Excel Columns</CardTitle>
          <CardDescription>
            Match the columns from your Excel file to the required student data
            fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your Excel file has the following columns: <br />
            {headers.map((h) => (
              <Badge key={h} variant="secondary" className="mr-1 mb-1">
                {h}
              </Badge>
            ))}
          </p>
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
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Mapping</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
