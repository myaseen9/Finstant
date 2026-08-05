import { useState, useEffect } from 'react';
import styles from './UserManagement.module.css';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessModalUser, setAccessModalUser] = useState(null);
  const [activeDropdownUserId, setActiveDropdownUserId] = useState(null);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [isCustomDesignation, setIsCustomDesignation] = useState(false);
  
  // Available sheets from Prisma Schema
  const availableSheets = [
    { id: 'capital_expenditures', name: 'Capital Expenditures' },
    { id: 'cash_inflows', name: 'Cash Inflows' },
    { id: 'dashboard_summary', name: 'Dashboard Summary' },
    { id: 'debt_and_interest_schedule', name: 'Debt & Interest' },
    { id: 'employee_directory', name: 'Employee Directory (HR)' },
    { id: 'payroll_logs', name: 'Payroll Logs (HR/Accountant)' },
    { id: 'saas_and_subscriptions', name: 'SaaS & Subscriptions' },
    { id: 'tax_ledger', name: 'Tax Ledger' },
    { id: 'travel_and_expense', name: 'Travel & Expense' },
    { id: 'utility_bills', name: 'Utility Bills' },
    { id: 'vendor_directory', name: 'Vendor Directory' },
    { id: 'vendor_payments', name: 'Vendor Payments' }
  ];

  // Mock function to open the access modal
  const openAccessModal = (user) => {
    setAccessModalUser(user);
    // In the future, this will fetch the user's current permissions.
    // For now, we'll pre-select some sheets based on designation as a mockup.
    if (user.designation === 'HR') {
      setSelectedSheets(['employee_directory', 'payroll_logs']);
    } else {
      setSelectedSheets([]);
    }
  };

  const handleSheetToggle = (sheetId) => {
    setSelectedSheets(prev => 
      prev.includes(sheetId) ? prev.filter(id => id !== sheetId) : [...prev, sheetId]
    );
  };
  
  // New user form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'user',
    designation: 'Accountant'
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'designation_select') {
      if (value === 'Custom') {
        setIsCustomDesignation(true);
        setFormData(prev => ({ ...prev, designation: '' }));
      } else {
        setIsCustomDesignation(false);
        setFormData(prev => ({ ...prev, designation: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create user');
      }

      // Success
      setIsModalOpen(false);
      setIsCustomDesignation(false);
      setFormData({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'user',
        designation: 'Accountant'
      });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus })
      });
      
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteModalUser.id })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete user');
      }

      setDeleteModalUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if e.target exists and has the closest method (prevents crash on text nodes or unmounted SVGs)
      if (e.target && typeof e.target.closest === 'function') {
        if (!e.target.closest(`.${styles.dropdownContainer}`)) {
          setActiveDropdownUserId(null);
        }
      } else {
        // If it doesn't have closest, safely assume it's outside and close
        setActiveDropdownUserId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.subtitle}>Manage team access, roles, and designations.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add New User
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userInfo}>
                      <div className={styles.avatar}>
                        {user.first_name[0]}{(user.last_name && user.last_name[0]) ? user.last_name[0] : ''}
                      </div>
                      <div className={styles.userDetails}>
                        <span className={styles.fullName}>{user.first_name} {user.last_name}</span>
                        <span className={styles.username}>@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${
                      user.role === 'superadmin' ? styles.badgeSuperadmin :
                      user.role === 'admin' ? styles.badgeAdmin : styles.badgeUser
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.designation}</td>
                  <td>
                    <span className={`${styles.badge} ${user.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      {user.role !== 'superadmin' && (
                        <button 
                          className={styles.toggleBtn}
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      
                      <div className={styles.dropdownContainer}>
                        <button 
                          className={styles.moreOptionsBtn}
                          onClick={() => setActiveDropdownUserId(activeDropdownUserId === user.id ? null : user.id)}
                        >
                          More Options
                        </button>
                        
                        {activeDropdownUserId === user.id && (
                          <div className={styles.dropdownMenu}>
                            <button onClick={() => {
                              openAccessModal(user);
                              setActiveDropdownUserId(null);
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                              Access Control
                            </button>
                            {user.role !== 'superadmin' && (
                              <button className={styles.dangerItem} onClick={() => {
                                setDeleteModalUser(user);
                                setActiveDropdownUserId(null);
                              }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                Delete User
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Create New User</h3>
              <button className={styles.closeBtn} onClick={() => { setIsModalOpen(false); setIsCustomDesignation(false); }}>×</button>
            </div>
            
            {error && <div className={styles.errorMessage}>{error}</div>}
            
            <form onSubmit={handleCreateUser}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name</label>
                  <input 
                    type="text" 
                    name="first_name" 
                    className={styles.input} 
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name (Optional)</label>
                  <input 
                    type="text" 
                    name="last_name" 
                    className={styles.input} 
                    value={formData.last_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Username</label>
                <input 
                  type="text" 
                  name="username" 
                  className={styles.input} 
                  value={formData.username}
                  onChange={handleInputChange}
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label>Password</label>
                <input 
                  type="password" 
                  name="password" 
                  className={styles.input} 
                  value={formData.password}
                  onChange={handleInputChange}
                  required 
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Role</label>
                  <select 
                    name="role" 
                    className={styles.input}
                    value={formData.role}
                    onChange={handleInputChange}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Designation</label>
                  {!isCustomDesignation ? (
                    <select 
                      name="designation_select" 
                      className={styles.input}
                      value={formData.designation}
                      onChange={handleInputChange}
                    >
                      <option value="HR">HR</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Finance Manager">Finance Manager</option>
                      <option value="Executive">Executive</option>
                      <option value="CEO">CEO</option>
                      <option value="Analyst">Analyst</option>
                      <option value="Custom" style={{ fontWeight: 'bold' }}>+ Create Custom...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        name="designation"
                        className={styles.input}
                        value={formData.designation}
                        onChange={handleInputChange}
                        placeholder="Custom designation"
                        required
                        autoFocus
                      />
                      <button 
                        type="button" 
                        onClick={() => { setIsCustomDesignation(false); setFormData(prev => ({...prev, designation: 'Accountant'})); }}
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0 0.5rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Control Modal Mockup */}
      {accessModalUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Access Control</h3>
                <p className={styles.modalSubtitle}>
                  Managing permissions for <strong>{accessModalUser.first_name} {accessModalUser.last_name}</strong> ({accessModalUser.designation})
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setAccessModalUser(null)}>×</button>
            </div>
            
            <div className={styles.sheetList}>
              <div className={styles.sheetListHeader}>
                <span>Dataset / Sheet Name</span>
                <span>Access Granted</span>
              </div>
              <div className={styles.sheetItemsContainer}>
                {availableSheets.map(sheet => (
                  <label key={sheet.id} className={styles.sheetItem}>
                    <div className={styles.sheetItemName}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--color-primary)'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      {sheet.name}
                    </div>
                    <input 
                      type="checkbox" 
                      className={styles.checkbox}
                      checked={selectedSheets.includes(sheet.id)}
                      onChange={() => handleSheetToggle(sheet.id)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnCancel} onClick={() => setAccessModalUser(null)}>
                Cancel
              </button>
              <button 
                type="button" 
                className={styles.btnRevoke} 
                onClick={() => {
                  setSelectedSheets([]);
                  alert("Mockup: All access revoked.");
                }}
              >
                Revoke All Access
              </button>
              <button 
                type="button" 
                className={styles.btnSubmit} 
                onClick={() => {
                  setAccessModalUser(null);
                  alert("Mockup: Access permissions granted and saved.");
                }}
              >
                Grant Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteModalUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Permanently Delete User
              </h3>
              <button className={styles.closeBtn} onClick={() => setDeleteModalUser(null)}>×</button>
            </div>
            
            <p className={styles.warningText}>
              Are you sure you want to permanently delete <strong>{deleteModalUser.first_name} {deleteModalUser.last_name}</strong>?
            </p>
            <p className={styles.warningTextSub}>
              This action cannot be undone. User history and logs will be deleted permanently.
            </p>

            {error && <div className={styles.errorMessage}>{error}</div>}

            <form onSubmit={handleDeleteUser}>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setDeleteModalUser(null)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnDeleteSolid} disabled={loading}>
                  {loading ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
