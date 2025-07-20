// components/ActivityLogs.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function ActivityLogs({
  Card, CardHeader, CardTitle, CardDescription, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      let logsQuery = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      if (filter !== 'all') {
        logsQuery = query(
          collection(db, 'activityLogs'),
          where('action', '==', filter),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      }

      const snapshot = await getDocs(logsQuery);
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    const actionConfig = {
      'login': { variant: 'success', label: 'Login' },
      'logout': { variant: 'secondary', label: 'Logout' },
      'create_activity': { variant: 'default', label: 'Created Activity' },
      'edit_activity': { variant: 'default', label: 'Edited Activity' },
      'mark_attendance': { variant: 'success', label: 'Marked Attendance' },
      'upload_excel': { variant: 'default', label: 'Uploaded Excel' },
      'create_user': { variant: 'default', label: 'Created User' },
      'update_user': { variant: 'default', label: 'Updated User' }
    };
    
    const config = actionConfig[action] || { variant: 'secondary', label: action };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Activity Logs</h1>
          <p className="text-gray-500">Track user activities and system events</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          >
            <option value="all">All Activities</option>
            <option value="login">Logins</option>
            <option value="create_activity">Activity Creation</option>
            <option value="edit_activity">Activity Edits</option>
            <option value="mark_attendance">Attendance</option>
            <option value="upload_excel">Excel Uploads</option>
          </select>
          <Button onClick={fetchLogs} variant="outline">Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Latest 100 activities in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4">Loading activity logs...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.timestamp && new Date(log.timestamp.seconds * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.userName || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{log.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={log.details}>
                        {log.details}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {log.ipAddress || 'Unknown'}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
