import { authenticatedFetch } from '../../api/auth';
import { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '@/pages/_app';
import styles from './UserManagement.module.css';

const formatAnalyticsDate = (raw) => {
  if (!raw) return '—';
  const str = String(raw).trim();
  const parts = str.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${month}/${day}/${year}`;
  }
  return str;
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
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
  const [profileForm, setProfileForm] = useState({ name: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  
  const { user: currentUser, showHUD } = useContext(AppContext);
  
  const [availableSheets, setAvailableSheets] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);

  const [newUserSheets, setNewUserSheets] = useState([]);
  const [isDataAccessDropdownOpen, setIsDataAccessDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isDesignationDropdownOpen, setIsDesignationDropdownOpen] = useState(false);
  const [dropdownPlacement, setDropdownPlacement] = useState('top');
  const dataAccessTriggerRef = useRef(null);
  const dataAccessWrapperRef = useRef(null);
  const roleWrapperRef = useRef(null);
  const designationWrapperRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dataAccessWrapperRef.current && !dataAccessWrapperRef.current.contains(e.target)) {
        setIsDataAccessDropdownOpen(false);
      }
      if (roleWrapperRef.current && !roleWrapperRef.current.contains(e.target)) {
        setIsRoleDropdownOpen(false);
      }
      if (designationWrapperRef.current && !designationWrapperRef.current.contains(e.target)) {
        setIsDesignationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDataAccessDropdown = () => {
    if (!isDataAccessDropdownOpen && dataAccessTriggerRef.current) {
      const rect = dataAccessTriggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const neededHeight = 240;
      // If space below is constrained and space above is sufficient, open upside
      if (spaceBelow < neededHeight && spaceAbove >= 180) {
        setDropdownPlacement('top');
      } else if (spaceBelow >= neededHeight) {
        setDropdownPlacement('bottom');
      } else {
        setDropdownPlacement('top');
      }
    }
    setIsDataAccessDropdownOpen(!isDataAccessDropdownOpen);
  };

  // New user form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
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
    } finally {
      setUsersLoading(false);
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
      const payload = {
        ...formData,
        sheets: formData.role === 'admin' ? [] : newUserSheets
      };

      const res = await authenticatedFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to create user');
      }

      // Success
      setIsModalOpen(false);
      setIsCustomDesignation(false);
      setNewUserSheets([]);
      setIsDataAccessDropdownOpen(false);
      setFormData({
        username: '',
        password: '',
        name: '',
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
        if (showHUD) {
          showHUD({
            title: 'Update Failed',
            subtitle: d.detail || 'Failed to update profile',
            type: 'error'
          });
        }
      }
    } catch (e) {
      if (showHUD) {
        showHUD({
          title: 'Network Error',
          subtitle: 'Connection lost during profile update',
          type: 'error'
        });
      }
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
              {usersLoading ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <tr key={`skeleton-${n}`} className={styles.skeletonRow}>
                    <td>
                      <div className={styles.userInfo}>
                        <div className={styles.skeletonAvatar} />
                        <div className={styles.userDetails} style={{ gap: 6 }}>
                          <div className={styles.skeletonPulse} style={{ width: 130, height: 14 }} />
                          <div className={styles.skeletonPulse} style={{ width: 85, height: 11 }} />
                        </div>
                      </div>
                    </td>
                    <td><div className={styles.skeletonPulse} style={{ width: 70, height: 22, borderRadius: 20 }} /></td>
                    <td><div className={styles.skeletonPulse} style={{ width: 95, height: 14 }} /></td>
                    <td><div className={styles.skeletonPulse} style={{ width: 60, height: 22, borderRadius: 20 }} /></td>
                    <td><div className={styles.skeletonPulse} style={{ width: 110, height: 30, borderRadius: 6 }} /></td>
                  </tr>
                ))
              ) : (
                users.map((user, idx) => (
                  <tr key={user.id} className={styles.animatedRow} style={{ animationDelay: `${idx * 45}ms` }}>
                    <td data-label="User">
                      <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                          {(() => {
                            const raw = (user.name || user.first_name || user.username || 'U').trim();
                            const parts = raw.split(/\s+/).filter(Boolean);
                            return (parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : raw.slice(0, 2)).toUpperCase();
                          })()}
                        </div>
                        <div className={styles.userDetails}>
                          <span className={styles.fullName}>
                            {user.name || user.first_name || user.username}
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
                              setProfileForm({ name: user.name || user.first_name || '' });
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
                    </td>
                  </tr>
                ))
              )}
              {!usersLoading && users.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.emptyState}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Mobile Responsive User Cards (< 768px) */}
      <div className={styles.mobileCardsContainer}>
        {usersLoading ? (
          [1, 2, 3].map((n) => (
            <div key={`mob-skeleton-${n}`} className={styles.mobileUserCard} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className={styles.skeletonAvatar} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div className={styles.skeletonPulse} style={{ width: '50%', height: 14 }} />
                  <div className={styles.skeletonPulse} style={{ width: '30%', height: 10 }} />
                </div>
              </div>
              <div className={styles.skeletonPulse} style={{ width: '75%', height: 12 }} />
            </div>
          ))
        ) : (
          users.map((user, idx) => (
            <div key={`mobile-${user.id}`} className={`${styles.mobileUserCard} ${styles.animatedRow}`} style={{ animationDelay: `${idx * 45}ms` }}>
              <div className={styles.cardHeaderRow}>
                <div className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {(() => {
                      const raw = (user.name || user.first_name || user.username || 'U').trim();
                      const parts = raw.split(/\s+/).filter(Boolean);
                      return (parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : raw.slice(0, 2)).toUpperCase();
                    })()}
                  </div>
                  <div className={styles.userDetails}>
                    <span className={styles.fullName}>
                      {user.name || user.first_name || user.username}
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
                      setProfileForm({ name: user.name || user.first_name || '' });
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
          ))
        )}
        {!usersLoading && users.length === 0 && (
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
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input 
                  type="text" 
                  name="name" 
                  className={styles.input} 
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Dr Sara Khan"
                  required 
                />
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Note: The user can log in with their Name handle or Email address.
                </small>
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
                  <div className={styles.customSelectWrapper} ref={roleWrapperRef}>
                    <button
                      type="button"
                      className={styles.customSelectBtn}
                      onClick={() => {
                        setIsRoleDropdownOpen(!isRoleDropdownOpen);
                        setIsDesignationDropdownOpen(false);
                        setIsDataAccessDropdownOpen(false);
                      }}
                    >
                      <span>{formData.role === 'admin' ? 'Admin' : 'User'}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transform: isRoleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {isRoleDropdownOpen && (
                      <div className={styles.customSelectMenu}>
                        <button
                          type="button"
                          className={`${styles.customOptionItem} ${formData.role === 'user' ? styles.customOptionItemActive : ''}`}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, role: 'user' }));
                            setIsRoleDropdownOpen(false);
                          }}
                        >
                          <span>User</span>
                          {formData.role === 'user' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                        </button>
                        <button
                          type="button"
                          className={`${styles.customOptionItem} ${formData.role === 'admin' ? styles.customOptionItemActive : ''}`}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, role: 'admin' }));
                            setIsRoleDropdownOpen(false);
                          }}
                        >
                          <span>Admin</span>
                          {formData.role === 'admin' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Designation</label>
                  {!isCustomDesignation ? (
                    <div className={styles.customSelectWrapper} ref={designationWrapperRef}>
                      <button
                        type="button"
                        className={styles.customSelectBtn}
                        onClick={() => {
                          setIsDesignationDropdownOpen(!isDesignationDropdownOpen);
                          setIsRoleDropdownOpen(false);
                          setIsDataAccessDropdownOpen(false);
                        }}
                      >
                        <span>{formData.designation || 'Select designation...'}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: isDesignationDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      {isDesignationDropdownOpen && (
                        <div className={styles.customSelectMenu}>
                          {['HR', 'Accountant', 'Finance Manager', 'Executive', 'CEO', 'Analyst'].map(des => (
                            <button
                              key={des}
                              type="button"
                              className={`${styles.customOptionItem} ${formData.designation === des ? styles.customOptionItemActive : ''}`}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, designation: des }));
                                setIsDesignationDropdownOpen(false);
                              }}
                            >
                              <span>{des}</span>
                              {formData.designation === des && <span style={{ color: 'var(--accent)' }}>✓</span>}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`${styles.customOptionItem} ${styles.customOptionCreate}`}
                            onClick={() => {
                              setIsCustomDesignation(true);
                              setFormData(prev => ({ ...prev, designation: '' }));
                              setIsDesignationDropdownOpen(false);
                            }}
                          >
                            <span>+ Create Custom...</span>
                          </button>
                        </div>
                      )}
                    </div>
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

              {/* Data Access (Permissions) Dropdown */}
              <div className={styles.formGroup} style={{ position: 'relative' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Data Access (Permissions)</span>
                  {formData.role === 'user' && newUserSheets.length > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent, #22B8CF)', fontWeight: 600 }}>
                      {newUserSheets.length} sheet{newUserSheets.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                </label>

                {formData.role === 'admin' ? (
                  <div className={styles.adminAccessNotice}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    <span>Admin role has full access to all datasets</span>
                  </div>
                ) : (
                  <div className={styles.dataAccessWrapper} ref={dataAccessWrapperRef}>
                    <button 
                      type="button" 
                      ref={dataAccessTriggerRef}
                      className={styles.dataAccessTriggerBtn}
                      onClick={toggleDataAccessDropdown}
                    >
                      <span className={styles.dataAccessTriggerText}>
                        {newUserSheets.length === 0 
                          ? 'Select accessible sheets...' 
                          : `${newUserSheets.length} sheet${newUserSheets.length > 1 ? 's' : ''} selected (${newUserSheets.map(s => {
                              const match = availableSheets.find(item => (item.id || item.name) === s);
                              return match?.name || s;
                            }).join(', ')})`}
                      </span>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="15" 
                        height="15" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ 
                          transform: isDataAccessDropdownOpen 
                            ? (dropdownPlacement === 'top' ? 'rotate(0deg)' : 'rotate(180deg)')
                            : (dropdownPlacement === 'top' ? 'rotate(180deg)' : 'rotate(0deg)'), 
                          transition: 'transform 0.2s ease', 
                          flexShrink: 0 
                        }}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {isDataAccessDropdownOpen && (
                      <div className={`${styles.dataAccessDropdownMenu} ${dropdownPlacement === 'top' ? styles.dropdownPlacementTop : styles.dropdownPlacementBottom}`}>
                        <div className={styles.dropdownActionRow}>
                          <button 
                            type="button" 
                            className={styles.quickSelectBtn}
                            onClick={() => setNewUserSheets(availableSheets.map(s => s.id || s.name))}
                          >
                            Select All
                          </button>
                          <button 
                            type="button" 
                            className={styles.quickSelectBtn}
                            onClick={() => setNewUserSheets([])}
                          >
                            Clear All
                          </button>
                        </div>

                        <div className={styles.sheetsCheckboxList}>
                          {availableSheets.map(sheet => {
                            const sheetKey = sheet.id || sheet.name;
                            const isChecked = newUserSheets.includes(sheetKey);
                            return (
                              <label key={sheetKey} className={styles.sheetCheckboxLabel}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setNewUserSheets(prev => prev.filter(s => s !== sheetKey));
                                    } else {
                                      setNewUserSheets(prev => [...prev, sheetKey]);
                                    }
                                  }}
                                  className={styles.sheetCheckbox}
                                />
                                <span className={styles.sheetTitleText}>{sheet.name || sheetKey}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

      {/* Access Control Modal */}
      {accessModalUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '620px' }}>
            <div className={styles.modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Access Control</h3>
                  <span className={styles.grantedCountPill}>
                    {selectedSheets.length} of {availableSheets.length} Datasets Granted
                  </span>
                </div>
                <p className={styles.modalSubtitle}>
                  Managing dataset permissions for <strong>{accessModalUser.name || accessModalUser.first_name || accessModalUser.username}</strong> ({accessModalUser.designation || 'User'})
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setAccessModalUser(null)}>×</button>
            </div>
            
            <div className={styles.sheetList}>
              <div className={styles.sheetListHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                  <span>Financial Datasets / Sheets</span>
                </div>
                <button 
                  type="button"
                  className={styles.quickToggleBtn}
                  onClick={() => {
                    if (selectedSheets.length === availableSheets.length) {
                      setSelectedSheets([]);
                    } else {
                      setSelectedSheets(availableSheets.map(s => s.id));
                    }
                  }}
                >
                  {selectedSheets.length === availableSheets.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className={styles.sheetItemsContainer}>
                {availableSheets.map(sheet => {
                  const isGranted = selectedSheets.includes(sheet.id);
                  return (
                    <div 
                      key={sheet.id} 
                      className={`${styles.sheetItem} ${isGranted ? styles.sheetItemGranted : styles.sheetItemRestricted}`}
                      onClick={() => handleSheetToggle(sheet.id)}
                    >
                      <div className={styles.sheetItemName}>
                        <div className={`${styles.sheetItemIcon} ${isGranted ? styles.iconGranted : styles.iconRestricted}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                          <div className={styles.sheetTitle}>{sheet.name}</div>
                          <div className={styles.sheetTableKey}>Dataset key: {sheet.id}</div>
                        </div>
                      </div>
                      
                      <div className={styles.sheetItemStatus}>
                        <span className={`${styles.accessBadge} ${isGranted ? styles.accessGranted : styles.accessRestricted}`}>
                          {isGranted ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              Granted
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              Restricted
                            </>
                          )}
                        </span>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={isGranted}
                          onChange={() => {}} 
                          onClick={(e) => e.stopPropagation()}
                          readOnly
                        />
                      </div>
                    </div>
                  );
                })}
                {availableSheets.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    No dataset tables found in the knowledge base.
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnCancel} onClick={() => setAccessModalUser(null)}>
                Cancel
              </button>
              <button 
                type="button" 
                className={styles.btnRevoke} 
                onClick={() => setSelectedSheets([])}
                disabled={selectedSheets.length === 0}
              >
                Clear All
              </button>
              <button 
                type="button" 
                className={styles.btnSubmit} 
                onClick={saveUserAccess}
                disabled={savingAccess}
              >
                {savingAccess ? 'Saving...' : 'Save Permissions'}
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
              Are you sure you want to permanently delete <strong>{deleteModalUser.name || deleteModalUser.first_name || deleteModalUser.username}</strong>?
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
                User Analytics: {analyticsModalUser.name || analyticsModalUser.first_name || analyticsModalUser.username}
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
                          <td style={{ padding: '1rem' }}>{formatAnalyticsDate(row.date)}</td>
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
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ name: e.target.value })}
                  placeholder="Enter full name"
                  required
                  autoFocus
                />
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
