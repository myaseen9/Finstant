import { authenticatedFetch } from '../../api/auth';
import { useState, useEffect, useContext } from 'react';
import { AppContext } from '@/pages/_app';
import styles from './UserManagement.module.css';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessModalUser, setAccessModalUser] = useState(null);
  const [analyticsModalUser, setAnalyticsModalUser] = useState(null);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  const [activeDropdownUser, setActiveDropdownUser] = useState(null);
  const [dropdownPos, setDropdownPos] = useState(null);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [isCustomDesignation, setIsCustomDesignation] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  
  const { user: currentUser, showHUD } = useContext(AppContext);
  
  const [availableSheets, setAvailableSheets] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // New user form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'user',
    designation: 'Accountant'
  });

  const fetchTables = async () => {
    try {
      const res = await authenticatedFetch('/api/admin/tables');
      if (res.ok) {
        const data = await res.json();
        setAvailableSheets(data);
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    const handleCloseDropdown = () => {
      setActiveDropdownUser(null);
      setDropdownPos(null);
    };
    if (activeDropdownUser !== null) {
      document.addEventListener('click', handleCloseDropdown);
      window.addEventListener('scroll', handleCloseDropdown, true);
    }
    return () => {
      document.removeEventListener('click', handleCloseDropdown);
      window.removeEventListener('scroll', handleCloseDropdown, true);
    };
  }, [activeDropdownUser]);

  const handleToggleDropdown = (e, user) => {
    e.stopPropagation();
    if (activeDropdownUser?.id === user.id) {
      setActiveDropdownUser(null);
      setDropdownPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const menuHeight = 220;
    const right = window.innerWidth - rect.right;

    // Viewport-aware calculation:
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      setDropdownPos({
        bottom: window.innerHeight - rect.top + 6,
        right: Math.max(16, right),
        placement: 'up'
      });
    } else {
      setDropdownPos({
        top: rect.bottom + 6,
        right: Math.max(16, right),
        placement: 'down'
      });
    }
    setActiveDropdownUser(user);
  };

  const openAnalyticsModal = async (user) => {
    setAnalyticsModalUser(user);
    setLoadingAnalytics(true);
    try {
      const res = await authenticatedFetch(`/api/admin/user-analytics/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const openAccessModal = async (user) => {
    setAccessModalUser(user);
    try {
      const res = await authenticatedFetch(`/api/admin/user-access/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSheets(data);
      }
    } catch (err) {
      console.error('Failed to fetch user access:', err);
    }
  };

  const saveUserAccess = async () => {
    if (!accessModalUser) return;
    setSavingAccess(true);
    try {
      await authenticatedFetch('/api/admin/user-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: accessModalUser.id, sheets: selectedSheets })
      });
      const grantedCount = selectedSheets.length;
      if (showHUD) {
        showHUD({
          title: grantedCount > 0 ? 'Access Granted' : 'Permissions Revoked',
          subtitle: grantedCount > 0 ? `${grantedCount} dataset permissions active` : 'All dataset permissions cleared',
          type: 'success'
        });
      }
      setAccessModalUser(null);
    } catch (err) {
      console.error('Failed to save access:', err);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSheetToggle = (sheetId) => {
    setSelectedSheets(prev => 
      prev.includes(sheetId) ? prev.filter(id => id !== sheetId) : [...prev, sheetId]
    );
  };


  const fetchUsers = async () => {
    try {
      const res = await authenticatedFetch('/api/users');
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

  const canManage = (targetUser) => {
    if (!currentUser) return false;
    if (currentUser.id === targetUser.id) return false;
    if (currentUser.role === 'superadmin') return true;
    if (currentUser.role === 'admin' && targetUser.role === 'user') return true;
    return false;
  };

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
      const res = await authenticatedFetch('/api/users', {
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
      if (showHUD) {
        showHUD({
          title: 'User Added',
          subtitle: 'AWS Cognito temp password emailed',
          type: 'success'
        });
      }
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: nextStatus } : u));
    
    if (showHUD) {
      showHUD({
        title: nextStatus ? 'Activated' : 'Deactivated',
        subtitle: nextStatus ? 'User account is now active' : 'User access suspended',
        type: 'success'
      });
    }

    try {
      const res = await authenticatedFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: nextStatus })
      });
      
      if (!res.ok) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: currentStatus } : u));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: currentStatus } : u));
    }
  };

  const handleRoleChange = async (user, newRole) => {
    const oldRole = user.role;
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));

    if (showHUD) {
      showHUD({
        title: 'Role Updated',
        subtitle: `Role assigned: ${newRole.toUpperCase()}`,
        type: 'success'
      });
    }

    try {
      const res = await authenticatedFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role: newRole })
      });
      if (!res.ok) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: oldRole } : u));
      }
    } catch (err) {
      console.error('Failed to update role:', err);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: oldRole } : u));
    }
  };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await authenticatedFetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteModalUser.id })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete user');
      }

      if (showHUD) {
        showHUD({
          title: 'User Deleted',
          subtitle: 'Removed from system database',
          type: 'success'
        });
      }

      setDeleteModalUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await authenticatedFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      if (res.ok) {
        setProfileEditOpen(false);
        if (showHUD) {
          showHUD({
            title: 'Profile Updated',
            subtitle: 'Personal details saved',
            type: 'success'
          });
        }
        fetchUsers();
      } else {
        const d = await res.json();
        alert(d.detail || 'Failed to update profile');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setProfileSaving(false);
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add New User
          </button>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {/* 1. Desktop & Tablet Standard Data Table */}
      <div className={`${styles.section} ${styles.desktopTableSection}`}>
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
                  <td data-label="User">
                    <div className={styles.userInfo}>
                      <div className={styles.avatar}>
                        {(user.first_name || user.username || 'U')[0].toUpperCase()}
                        {(user.last_name && user.last_name[0]) ? user.last_name[0].toUpperCase() : ''}
                      </div>
                      <div className={styles.userDetails}>
                        <span className={styles.fullName}>
                          {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username}
                        </span>
                        <span className={styles.username}>{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    <span className={`${styles.badge} ${
                      user.role === 'superadmin' ? styles.badgeSuperadmin :
                      user.role === 'admin' ? styles.badgeAdmin : styles.badgeUser
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td data-label="Designation">{user.designation || '—'}</td>
                  <td data-label="Status">
                    {user.role !== 'superadmin' && (
                      <span className={`${styles.badge} ${user.is_active ? styles.statusActive : styles.statusInactive}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td data-label="Actions">
                    <div className={styles.actionButtons}>
                      {currentUser?.id === user.id && (
                        <button
                          className={styles.btnEditProfile}
                          onClick={() => {
                            setProfileForm({ first_name: user.first_name || '', last_name: user.last_name || '' });
                            setProfileEditOpen(true);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          Edit Profile
                        </button>
                      )}
                      {canManage(user) && (
                        <>
                          <button 
                            className={styles.toggleBtn}
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <div className={styles.dropdownContainer}>
                            <button 
                              className={styles.moreOptionsBtn}
                              onClick={(e) => handleToggleDropdown(e, user)}
                            >
                              More Options
                            </button>
                          </div>
                        </>
                      )}
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

      {/* 2. Mobile Responsive User Cards (< 768px) */}
      <div className={styles.mobileCardsContainer}>
        {users.map(user => (
          <div key={`mobile-${user.id}`} className={styles.mobileUserCard}>
            <div className={styles.cardHeaderRow}>
              <div className={styles.userInfo}>
                <div className={styles.avatar}>
                  {(user.first_name || user.username || 'U')[0].toUpperCase()}
                  {(user.last_name && user.last_name[0]) ? user.last_name[0].toUpperCase() : ''}
                </div>
                <div className={styles.userDetails}>
                  <span className={styles.fullName}>
                    {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username}
                  </span>
                  <span className={styles.username}>{user.username}</span>
                </div>
              </div>
              <span className={`${styles.badge} ${
                user.role === 'superadmin' ? styles.badgeSuperadmin :
                user.role === 'admin' ? styles.badgeAdmin : styles.badgeUser
              }`}>
                {user.role}
              </span>
            </div>

            <div className={styles.cardDetailsRow}>
              <div className={styles.cardMetaItem}>
                <span className={styles.cardMetaLabel}>Designation</span>
                <span className={styles.cardMetaVal}>{user.designation || '—'}</span>
              </div>
              {user.role !== 'superadmin' && (
                <div className={styles.cardMetaItem}>
                  <span className={styles.cardMetaLabel}>Status</span>
                  <span className={`${styles.badge} ${user.is_active ? styles.statusActive : styles.statusInactive}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.cardActionsRow}>
              {currentUser?.id === user.id && (
                <button
                  className={styles.btnEditProfile}
                  onClick={() => {
                    setProfileForm({ first_name: user.first_name || '', last_name: user.last_name || '' });
                    setProfileEditOpen(true);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit Profile
                </button>
              )}
              {canManage(user) && (
                <>
                  <button 
                    className={styles.toggleBtn}
                    onClick={() => toggleUserStatus(user.id, user.is_active)}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button 
                    className={styles.moreOptionsBtn}
                    onClick={(e) => handleToggleDropdown(e, user)}
                  >
                    More Options
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className={styles.emptyState}>No users found.</div>
        )}
      </div>

      {/* Floating Viewport-Anchored Popover Menu (100% immune to table clipping) */}
      {activeDropdownUser && dropdownPos && (
        <div 
          className={`${styles.floatingDropdown} ${dropdownPos.placement === 'up' ? styles.dropupAnim : styles.dropdownAnim}`}
          style={{
            position: 'fixed',
            top: dropdownPos.top !== undefined ? `${dropdownPos.top}px` : 'auto',
            bottom: dropdownPos.bottom !== undefined ? `${dropdownPos.bottom}px` : 'auto',
            right: `${dropdownPos.right}px`,
            zIndex: 99999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => {
            openAccessModal(activeDropdownUser);
            setActiveDropdownUser(null);
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Access Control
          </button>
          
          <button onClick={() => {
            openAnalyticsModal(activeDropdownUser);
            setActiveDropdownUser(null);
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            User Analytics
          </button>

          {currentUser?.role === 'superadmin' && (
            activeDropdownUser.role === 'admin' ? (
              <button onClick={() => { handleRoleChange(activeDropdownUser, 'user'); setActiveDropdownUser(null); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                Remove Admin
              </button>
            ) : (
              <button onClick={() => { handleRoleChange(activeDropdownUser, 'admin'); setActiveDropdownUser(null); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                Make Admin
              </button>
            )
          )}

          <button className={styles.dangerItem} onClick={() => {
            setDeleteModalUser(activeDropdownUser);
            setActiveDropdownUser(null);
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete User
          </button>
        </div>
      )}

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
                <label>Email Address</label>
                <input 
                  type="email" 
                  name="username" 
                  className={styles.input} 
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="user@example.com"
                  required 
                />
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  AWS will automatically email this user a temporary password with login instructions.
                </small>
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
              <div className={styles.sheetListHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Dataset / Sheet Name</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
                  <span>Select All</span>
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={availableSheets.length > 0 && selectedSheets.length === availableSheets.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSheets(availableSheets.map(s => s.id));
                      } else {
                        setSelectedSheets([]);
                      }
                    }}
                  />
                </label>
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
                }}
              >
                Clear Selections
              </button>
              <button 
                type="button" 
                className={styles.btnSubmit} 
                onClick={saveUserAccess}
                disabled={savingAccess}
              >
                {savingAccess ? 'Saving...' : 'Grant Access'}
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
      {/* Analytics Modal */}
      {analyticsModalUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '800px', width: '90%' }}>
            <div className={styles.modalHeader}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                User Analytics: {analyticsModalUser.first_name} {analyticsModalUser.last_name}
              </h3>
              <button className={styles.closeBtn} onClick={() => { setAnalyticsModalUser(null); setAnalyticsData([]); }}>×</button>
            </div>

            <div className={styles.modalBody}>
              {loadingAnalytics ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Loading analytics...</div>
              ) : analyticsData.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No queries have been run by this user.</div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table className={styles.table} style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af', textAlign: 'left' }}>
                        <th style={{ padding: '1rem' }}>Date</th>
                        <th style={{ padding: '1rem' }}>Total Queries</th>
                        <th style={{ padding: '1rem' }}>Lookups</th>
                        <th style={{ padding: '1rem' }}>Aggregations</th>
                        <th style={{ padding: '1rem' }}>Analytical</th>
                        <th style={{ padding: '1rem', color: '#ef4444' }}>Denied</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #1f2937' }}>
                          <td style={{ padding: '1rem' }}>{row.date}</td>
                          <td style={{ padding: '1rem', fontWeight: 'bold' }}>{row.total}</td>
                          <td style={{ padding: '1rem' }}>{row.lookups}</td>
                          <td style={{ padding: '1rem' }}>{row.aggregations}</td>
                          <td style={{ padding: '1rem', color: '#60a5fa' }}>{row.analytical}</td>
                          <td style={{ padding: '1rem', color: '#ef4444' }}>{row.denied}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
              <button type="button" className={styles.btnCancel} onClick={() => { setAnalyticsModalUser(null); setAnalyticsData([]); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit Modal — only for superadmin's own profile */}
      {profileEditOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Edit My Profile</h3>
              <button className={styles.closeBtn} onClick={() => setProfileEditOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm(p => ({ ...p, first_name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm(p => ({ ...p, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setProfileEditOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSubmit} disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
