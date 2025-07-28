// components/UserManagement.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import AdminUserForm from "./AdminUserForm";

export default function UserManagement({
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const { createUser, userProfile } = useAuth();

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "placement_coordinator",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    } catch (error) {
      // Error fetching users - continue with empty list
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(newUser.email, newUser.password, {
        name: newUser.name,
        role: newUser.role,
      });

      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "placement_coordinator",
      });
      setShowCreateUser(false);
      fetchUsers();
      alert("User created successfully!");
    } catch (error) {
      alert("Failed to create user: " + error.message);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus,
      });
      fetchUsers();
    } catch (error) {
      alert("Failed to update user status");
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { variant: "default", label: "Admin" },
      placement_coordinator: { variant: "secondary", label: "PC" },
      attendance_marker: { variant: "success", label: "Marker" },
    };

    const config = roleConfig[role] || {
      variant: "secondary",
      label: "Unknown",
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (userProfile?.role !== "admin") {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          Access denied. Admin privileges required.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage users and their roles in the system
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowCreateAdmin(true)}
            variant="outline"
            className="px-6 py-2.5"
          >
            <span className="mr-2">+</span>
            Create Admin
          </Button>
          <Button
            onClick={() => setShowCreateUser(true)}
            className="px-6 py-2.5"
          >
            <span className="mr-2">+</span>
            Create User
          </Button>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateUser && (
        <Card className="shadow-lg border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl text-gray-900 dark:text-white">
              Create New User
            </CardTitle>
            <CardDescription className="text-base text-gray-600 dark:text-gray-400">
              Add a new user to the system with specific role permissions
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateUser}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                    required
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    required
                    minLength={6}
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    User Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, role: e.target.value }))
                    }
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="placement_coordinator">
                      Placement Coordinator
                    </option>
                    <option value="attendance_marker">Attendance Marker</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateUser(false)}
                className="px-6 py-2.5"
              >
                Cancel
              </Button>
              <Button type="submit" className="px-6 py-2.5">
                Create User
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create Admin User
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateAdmin(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ×
              </Button>
            </div>
            <div className="p-6">
              <AdminUserForm
                Button={Button}
                onSuccess={() => {
                  setShowCreateAdmin(false);
                  fetchUsers(); // Refresh users list after admin creation
                }}
                onCancel={() => setShowCreateAdmin(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <Card className="shadow-lg border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl text-gray-900 dark:text-white">
            System Users
          </CardTitle>
          <CardDescription className="text-base text-gray-600 dark:text-gray-400">
            Overview of all users and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-600 dark:text-gray-400">
                  Loading users...
                </span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-gray-700">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                      Name
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                      Email
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                      Role
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                      Last Login
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-white py-4 px-6">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6">
                        {user.email}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge
                          variant={user.isActive ? "success" : "secondary"}
                          className="font-medium"
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6">
                        {user.lastLogin
                          ? new Date(
                              user.lastLogin.seconds * 1000
                            ).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleToggleUserStatus(user.id, user.isActive)
                          }
                          className="px-4 py-2"
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
