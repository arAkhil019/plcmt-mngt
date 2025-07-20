// components/attendance-view.jsx
import React from 'react';
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon } from './icons';

export default function AttendanceView({
    company: activity,
    onBack,
    attendance,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
    Button,
    Badge
}) {
    // Calculate present and total counts
    const presentCount = attendance[activity.id]?.length || 0;
    const totalStudents = activity.students?.length || 0;

    return (
        <div className="w-full max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Attendance View</CardTitle>
                            <CardDescription>
                                Viewing attendance for: {activity.companyName} (Read-only)
                            </CardDescription>
                        </div>
                        <Button onClick={onBack} variant="outline" className="h-9 px-3">
                            <ArrowLeftIcon className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Student List</h3>
                        <Badge variant="secondary" className="text-sm">
                            {presentCount} / {totalStudents} Present
                        </Badge>
                    </div>
                    
                    <div className="max-h-[500px] overflow-y-auto pr-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activity.students?.map(student => {
                                    const record = attendance[activity.id]?.find(att => att.studentId === student.id);
                                    return (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-mono text-xs">
                                                {student.id}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {student.name}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {student.department || 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {record ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Badge variant="success" className="flex items-center gap-1.5">
                                                            <CheckCircleIcon className="h-3.5 w-3.5" />
                                                            Present
                                                        </Badge>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(record.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="secondary" className="flex items-center gap-1.5">
                                                        <ClockIcon className="h-3.5 w-3.5" />
                                                        Absent
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {activity.students?.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No students registered for this activity.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
