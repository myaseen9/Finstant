import { CognitoUserPool, AuthenticationDetails, CognitoUser } from 'amazon-cognito-identity-js';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';


const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_uE4RzWIhm',
  ClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID || '1lqralnuo80d5q9ar1krd2o9ct'
};

const userPool = new CognitoUserPool(poolData);

// Step 1: Sync Cognito user to local DB. Step 2: Fetch user profile.
const syncAndFetchMe = async (token) => {
  let syncRes;
  try {
    syncRes = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (e) {
    throw new Error('Backend server is not reachable at ' + API_BASE + '. Please make sure it is running.');
  }

  if (!syncRes.ok) {
    const body = await syncRes.json().catch(() => ({}));
    throw new Error('Sync failed (' + syncRes.status + '): ' + (body.detail || 'Unknown error'));
  }

  let meRes;
  try {
    meRes = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (e) {
    throw new Error('Backend server is not reachable at ' + API_BASE + '. Please make sure it is running.');
  }

  if (!meRes.ok) {
    throw new Error('Profile fetch failed (' + meRes.status + ')');
  }
  return await meRes.json();
};

export const login = (username, password) => {
  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: async (result) => {
        const token = result.getIdToken().getJwtToken();
        localStorage.setItem('finstant_token', token);
        try {
          const me = await syncAndFetchMe(token);
          resolve(me);
        } catch (e) {
          reject(e);
        }
      },
      onFailure: (err) => {
        reject(new Error(err.message || 'Login failed'));
      },
      newPasswordRequired: (userAttributes) => {
        const customErr = new Error('AWS requires you to set a new password on first login.');
        customErr.code = 'NEW_PASSWORD_REQUIRED';
        customErr.cognitoUser = cognitoUser;
        customErr.userAttributes = userAttributes;
        reject(customErr);
      }
    });
  });
};

export const completeNewPassword = (cognitoUser, newPassword) => {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: async (result) => {
        const token = result.getIdToken().getJwtToken();
        localStorage.setItem('finstant_token', token);
        resolve({ status: "success" });
      },
      onFailure: (err) => reject(new Error(err.message || 'Password update failed'))
    });
  });
};

export const logout = async () => {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
  localStorage.removeItem('finstant_token');
};

export const requestReset = async (username) => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    cognitoUser.forgotPassword({
      onSuccess: () => resolve({ message: 'Password reset email sent' }),
      onFailure: (err) => reject(new Error(err.message || 'Failed to request reset'))
    });
  });
};

export const confirmPasswordReset = async (username, code, newPassword) => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve({ message: 'Password reset successfully' }),
      onFailure: (err) => reject(new Error(err.message || 'Reset failed'))
    });
  });
};

export const getMe = async () => {
  const token = localStorage.getItem('finstant_token');
  if (!token) return null;

  const res = await fetch(`${API_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    localStorage.removeItem('finstant_token');
    return null;
  }
  return await res.json();
};

export const needsSetup = async () => {
  return false;
};

export const getValidToken = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      resolve(localStorage.getItem('finstant_token'));
      return;
    }
    cognitoUser.getSession((err, session) => {
      if (err || !session || !session.isValid()) {
        resolve(localStorage.getItem('finstant_token'));
        return;
      }
      const token = session.getIdToken().getJwtToken();
      localStorage.setItem('finstant_token', token);
      resolve(token);
    });
  });
};

export const authenticatedFetch = async (url, options = {}) => {
  const token = await getValidToken();
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let fullUrl = url;
  if (fullUrl.startsWith('http://127.0.0.1:8000')) {
    fullUrl = fullUrl.replace('http://127.0.0.1:8000', API_BASE);
  } else if (fullUrl.startsWith('http://localhost:8000')) {
    fullUrl = fullUrl.replace('http://localhost:8000', API_BASE);
  } else if (!fullUrl.startsWith('http')) {
    if (!fullUrl.startsWith('/')) fullUrl = '/' + fullUrl;
    fullUrl = `${API_BASE}${fullUrl}`;
  }


  const response = await fetch(fullUrl, { ...options, headers });
  if (response.status === 401 && typeof window !== 'undefined') {
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem('finstant_token');
      window.location.href = '/login';
    }
  }
  return response;
};
